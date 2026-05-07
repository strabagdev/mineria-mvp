const CACHE_VERSION = "mineria-shell-v2";
const IS_LOCALHOST = self.location.hostname === "localhost";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const SHELL_URLS = ["/", "/login", "/reports", "/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];

self.addEventListener("install", (event) => {
  if (IS_LOCALHOST) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
              IS_LOCALHOST
                ? cacheName.startsWith("mineria-")
                : !cacheName.startsWith(CACHE_VERSION)
            )
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

function shouldBypass(request) {
  if (request.method !== "GET") {
    return true;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return true;
  }

  return url.pathname.startsWith("/api/");
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return caches.match("/login");
  }
}

self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST) {
    return;
  }

  const { request } = event;

  if (shouldBypass(request)) {
    return;
  }

  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/") || ["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});
