"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const isLocalhost = window.location.hostname === "localhost";
    const isDevelopment = process.env.NODE_ENV !== "production";
    const isSecureContext = window.location.protocol === "https:" || isLocalhost;

    async function cleanupServiceWorkersAndCaches() {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("mineria-"))
            .map((cacheName) => caches.delete(cacheName))
        );
      }
    }

    if (isDevelopment || isLocalhost) {
      void cleanupServiceWorkersAndCaches().catch((error: unknown) => {
        console.error(
          "Service worker cleanup failed:",
          error instanceof Error ? error.message : error
        );
      });
      return;
    }

    if (!isSecureContext) {
      return;
    }

    function activateWaitingWorker(registration: ServiceWorkerRegistration) {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    }

    function cacheCriticalRoutes(registration?: ServiceWorkerRegistration) {
      if (!navigator.onLine) {
        return;
      }

      const worker = registration?.active ?? navigator.serviceWorker.controller;
      worker?.postMessage({
        type: "CACHE_CRITICAL_ROUTES",
        routes: ["/dashboard", "/reports", "/admin/users", "/admin/audit"],
      });
    }

    function registerServiceWorker() {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        void registration.update();
        activateWaitingWorker(registration);
        cacheCriticalRoutes(registration);

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          installingWorker?.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              activateWaitingWorker(registration);
            }
          });
        });
      }).catch((error: unknown) => {
        console.error(
          "Service worker registration failed:",
          error instanceof Error ? error.message : error
        );
      });
    }

    function reloadOnceAfterControllerChange() {
      const reloadKey = "mineria-sw-controller-reload-v2";

      if (window.sessionStorage.getItem(reloadKey) === "1") {
        return;
      }

      window.sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    }

    function cacheRoutesWhenOnline() {
      cacheCriticalRoutes();
    }

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnceAfterControllerChange);
    window.addEventListener("online", cacheRoutesWhenOnline);

    if (document.readyState === "complete") {
      registerServiceWorker();
      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", reloadOnceAfterControllerChange);
        window.removeEventListener("online", cacheRoutesWhenOnline);
      };
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnceAfterControllerChange);
      window.removeEventListener("online", cacheRoutesWhenOnline);
    };
  }, []);

  return null;
}
