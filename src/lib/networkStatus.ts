export const NETWORK_ERROR_MESSAGE =
  "⚠️ No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; vuelve a intentar cuando recuperes conexion.";

export function isBrowserOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function isNetworkRequestError(error: unknown) {
  return error instanceof Error && /failed to fetch|fetch failed|load failed|networkerror/i.test(error.message);
}

export function assertBrowserOnline() {
  if (isBrowserOffline()) {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}
