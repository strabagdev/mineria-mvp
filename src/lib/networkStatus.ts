export const NETWORK_ERROR_MESSAGE =
  "⚠️ No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; vuelve a intentar cuando recuperes conexion.";

let networkListenersReady = false;

function ensureNetworkListeners() {
  if (typeof window === "undefined" || networkListenersReady) {
    return;
  }

  networkListenersReady = true;
}

export function isBrowserOffline() {
  ensureNetworkListeners();
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function markNetworkDegraded() {
  // El estado offline global debe venir del navegador; los errores de fetch se manejan por request.
}

export function markNetworkRestored() {
  // Mantener la API permite que los snapshots marquen exito sin reintroducir estado global persistente.
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
