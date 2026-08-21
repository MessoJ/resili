"use client";

import { useEffect } from "react";

/**
 * Registers the Console service worker once, on window load, so the offline
 * app-shell + cached ward-risk data are available to field officers on flaky
 * links. Registration is deferred to the `load` event so it never competes
 * with first paint, and is a no-op in browsers without service-worker support
 * or during local dev over plain HTTP on a non-localhost host.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Non-fatal: the Console still works online without the SW.
        console.warn("resili: service worker registration failed", err);
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
