// Teammate 5 (Mobile & PWA / Offline UX) Service Worker
//
// PURPOSE:
// Caches ward risk scores and critical UI assets locally on device
// so county officers and chiefs can operate during low-bandwidth or offline conditions (+1 bonus point).

const CACHE_NAME = "rezili-offline-v1";
const OFFLINE_URLS = [
  "/",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Stale-while-revalidate strategy for network requests
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(() => cached);

      return cached || networked;
    })
  );
});

// TODO (Teammate 5): Add offline fallback message for API requests if both cache and network fail:
// Example: new Response(JSON.stringify({ error: "offline", notice: "Operating in cached mode" }), { headers: { "Content-Type": "application/json" } })
