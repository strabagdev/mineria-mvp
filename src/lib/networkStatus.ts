export const NETWORK_ERROR_MESSAGE =
  "⚠️ No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; vuelve a intentar cuando recuperes conexion.";

let degradedNetwork = false;
let networkListenersReady = false;

function ensureNetworkListeners() {
  if (typeof window === "undefined" || networkListenersReady) {
    return;
  }

  networkListenersReady = true;
  window.addEventListener("offline", () => {
    degradedNetwork = true;
  });
  window.addEventListener("online", () => {
    degradedNetwork = false;
  });
}

export function isBrowserOffline() {
  ensureNetworkListeners();
  return (typeof navigator !== "undefined" && !navigator.onLine) || degradedNetwork;
}

export function markNetworkDegraded() {
  degradedNetwork = true;
}

export function markNetworkRestored() {
  degradedNetwork = false;
}

export function isNetworkRequestError(error: unknown) {
  const isNetworkError =
    error instanceof Error && /failed to fetch|fetch failed|load failed|networkerror/i.test(error.message);

  if (isNetworkError) {
    markNetworkDegraded();
  }

  return isNetworkError;
}

export function assertBrowserOnline() {
  if (isBrowserOffline()) {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}
