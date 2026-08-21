// resili — Console Service Worker (Mobile & Offline UX).
//
// PURPOSE
// Keeps the Console usable for county officers and ward chiefs working on
// low-bandwidth or intermittent links along the Lake Victoria Basin.
// We cache the app shell and the last-seen ward-risk payloads on device so
// the map and ward cards still render when the network drops, and we always
// return a well-formed JSON envelope for API calls that fail — so the UI can
// fall back to its cached/demo state instead of throwing.
//
// STRATEGY
//   • Navigations / static assets: stale-while-revalidate (fast, self-healing).
//   • API GETs (ward risk, ledger, alerts): network-first so officers see the
//     freshest figures when online, falling back to the cached copy, and
//     finally to a signed "offline" JSON envelope when both miss.

const CACHE_VERSION = "v2";
const SHELL_CACHE = `resili-shell-${CACHE_VERSION}`;
const API_CACHE = `resili-api-${CACHE_VERSION}`;

const SHELL_URLS = ["/", "/manifest.json", "/favicon.ico"];

// API paths we mirror for offline read-only use. These are risk/ledger/alert
// reads only — never trigger or payout actions, which must be online + audited.
const API_PATH_HINTS = ["/api/v1/wards", "/api/v1/ledger", "/api/v1/alerts"];

function isApiRequest(url) {
  return API_PATH_HINTS.some((hint) => url.pathname.startsWith(hint));
}

// A predictable JSON envelope the Console can detect and treat as "degraded".
function offlineJson(pathname) {
  return new Response(
    JSON.stringify({
      status: "offline",
      notice:
        "resili is operating in cached mode — no network. Figures may be " +
        "stale. Likelihoods only; defer to KMD/NDMA and county directives.",
      path: pathname,
      generated_at: new Date().toISOString(),
    }),
    {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "X-Resili-Offline": "1",
        "Cache-Control": "no-store",
      },
    }
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, API_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GETs are cacheable/replayable. Never intercept trigger/payout POSTs —
  // those must reach the audited gateway online.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, url));
    return;
  }

  // Same-origin shell & assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirst(request, url) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Both network and cache missed — return a proper JSON envelope so the
    // Console falls back gracefully rather than surfacing a fetch error.
    return offlineJson(url.pathname);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const networked = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || networked;
}
