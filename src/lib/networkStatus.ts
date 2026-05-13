export const NETWORK_ERROR_MESSAGE =
  "⚠️ No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; vuelve a intentar cuando recuperes conexion.";

const NETWORK_STATUS_EVENT = "mineria-network-status";

let degradedNetwork = false;
let networkListenersReady = false;

function emitNetworkStatusChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(NETWORK_STATUS_EVENT));
}

function ensureNetworkListeners() {
  if (typeof window === "undefined" || networkListenersReady) {
    return;
  }

  networkListenersReady = true;

  window.addEventListener("offline", () => {
    degradedNetwork = true;
    emitNetworkStatusChange();
  });

  window.addEventListener("online", () => {
    degradedNetwork = false;
    emitNetworkStatusChange();
  });
}

export function isBrowserOffline() {
  ensureNetworkListeners();
  return (typeof navigator !== "undefined" && !navigator.onLine) || degradedNetwork;
}

export function isBrowserDisconnected() {
  ensureNetworkListeners();
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function markNetworkDegraded() {
  if (!degradedNetwork) {
    degradedNetwork = true;
    emitNetworkStatusChange();
  }
}

export function markNetworkRestored() {
  if (degradedNetwork) {
    degradedNetwork = false;
    emitNetworkStatusChange();
  }
}

export function subscribeNetworkStatus(listener: () => void) {
  ensureNetworkListeners();

  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(NETWORK_STATUS_EVENT, listener);

  return () => {
    window.removeEventListener(NETWORK_STATUS_EVENT, listener);
  };
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
