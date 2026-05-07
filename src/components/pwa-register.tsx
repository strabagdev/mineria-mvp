"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => {
          if (!("caches" in window)) {
            return undefined;
          }

          return caches
            .keys()
            .then((cacheNames) =>
              Promise.all(
                cacheNames
                  .filter((cacheName) => cacheName.startsWith("mineria-"))
                  .map((cacheName) => caches.delete(cacheName))
              )
            );
        })
        .catch((error: unknown) => {
          console.error(
            "Service worker cleanup failed:",
            error instanceof Error ? error.message : error
          );
        });
      return;
    }

    const isLocalhost = window.location.hostname === "localhost";
    const isSecureContext = window.location.protocol === "https:" || isLocalhost;

    if (!isSecureContext) {
      return;
    }

    function registerServiceWorker() {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error(
          "Service worker registration failed:",
          error instanceof Error ? error.message : error
        );
      });
    }

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
