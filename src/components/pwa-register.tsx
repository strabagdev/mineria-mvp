"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
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
