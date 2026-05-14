const CACHE_VERSION = "mineria-shell-v14";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ROUTE_PATH_HEADER = "x-mineria-route-path";

// Estrategia offline deliberadamente acotada:
// - /api/ nunca se cachea; IndexedDB/snapshots son la fuente local de datos.
// - /_next/static/ usa network-first para mantener assets actualizados y caer a cache si no hay red.
// - fuentes/imagenes usan cache-first.
// - navegaciones usan network-first solo para rutas shell ya visitadas; no se cachea todo el arbol App Router.
const SHELL_URLS = [
  "/",
  "/login",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];
const CRITICAL_ROUTE_URLS = ["/dashboard", "/reports", "/admin/users"];

self.addEventListener("install", (event) => {
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
            .filter((cacheName) => cacheName.startsWith("mineria-") && !cacheName.startsWith(CACHE_VERSION))
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

  if (url.pathname.startsWith("/api/")) {
    return true;
  }

  return url.pathname.startsWith("/_next/") && !url.pathname.startsWith("/_next/static/");
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

async function assetNetworkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error("Asset unavailable offline.");
  }
}

function getRequestPath(request) {
  return new URL(request.url).pathname;
}

function canUseRouteCache(request, response) {
  const requestPath = getRequestPath(request);
  const cachedPath = response.headers.get(ROUTE_PATH_HEADER);

  if (cachedPath) {
    return cachedPath === requestPath;
  }

  return requestPath === "/" || requestPath === "/login" || requestPath === "/offline";
}

async function withRouteHeader(response, path) {
  const headers = new Headers(response.headers);
  headers.set(ROUTE_PATH_HEADER, path);

  return new Response(await response.clone().blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function cacheRoutePath(path) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    return;
  }

  const cache = await caches.open(SHELL_CACHE);
  await cache.put(path, await withRouteHeader(response, path));
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, await withRouteHeader(response, getRequestPath(request)));
    }

    return response;
  } catch {
    const cachedResponse = await caches.match(request, { ignoreSearch: true });

    if (cachedResponse && canUseRouteCache(request, cachedResponse)) {
      return cachedResponse;
    }

    const cachedOffline = await caches.match("/offline");
    if (cachedOffline) {
      return cachedOffline;
    }

    return new Response(
      "Sin conexion. Revisa la red e intenta nuevamente.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (shouldBypass(request)) {
    return;
  }

  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/") || ["script", "style"].includes(request.destination)) {
    event.respondWith(assetNetworkFirst(request));
    return;
  }

  if (["font", "image"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "CACHE_CRITICAL_ROUTES") {
    event.waitUntil(
      Promise.allSettled(
        (event.data.routes ?? CRITICAL_ROUTE_URLS).map((route) => cacheRoutePath(route))
      )
    );
  }
});
