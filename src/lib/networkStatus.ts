export const NETWORK_ERROR_MESSAGE =
  "Sin conexion. Usando informacion local disponible.";

const NETWORK_STATUS_EVENT = "mineria-network-status";
const NETWORK_PROBE_TIMEOUT_MS = 2500;
const NETWORK_PROBE_RETRY_MS = 4000;

let degradedNetwork = false;
let networkListenersReady = false;
let probeInFlight = false;
let probeRetryTimer: number | null = null;

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
    scheduleNetworkProbeRetry();
  });

  window.addEventListener("online", () => {
    void probeNetworkRestored();
  });

  window.addEventListener("focus", () => {
    if (degradedNetwork) {
      void probeNetworkRestored();
    }
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

  scheduleNetworkProbeRetry();
}

export function markNetworkRestored() {
  if (degradedNetwork) {
    degradedNetwork = false;
    emitNetworkStatusChange();
  }

  if (probeRetryTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(probeRetryTimer);
    probeRetryTimer = null;
  }
}

function scheduleNetworkProbeRetry() {
  if (typeof window === "undefined" || probeRetryTimer !== null) {
    return;
  }

  probeRetryTimer = window.setTimeout(() => {
    probeRetryTimer = null;
    void probeNetworkRestored();
  }, NETWORK_PROBE_RETRY_MS);
}

export async function probeNetworkRestored() {
  ensureNetworkListeners();

  if (typeof window === "undefined" || probeInFlight) {
    return false;
  }

  probeInFlight = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), NETWORK_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/health?ts=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.ok) {
      markNetworkRestored();
      return true;
    }

    markNetworkDegraded();
    scheduleNetworkProbeRetry();
    return false;
  } catch {
    markNetworkDegraded();
    scheduleNetworkProbeRetry();
    return false;
  } finally {
    window.clearTimeout(timeout);
    probeInFlight = false;
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
