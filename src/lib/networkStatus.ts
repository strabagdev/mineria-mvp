export const NETWORK_ERROR_MESSAGE =
  "Sin conexion. Usando informacion local disponible.";

export type OperationalStatus = "online" | "offline";

const NETWORK_STATUS_EVENT = "mineria-network-status";
const NETWORK_HEALTH_TIMEOUT_MS = 2000;
const NETWORK_HEARTBEAT_INTERVAL_MS = 5000;

let backendOnline = false;
let networkListenersReady = false;
let heartbeatInFlight = false;
let heartbeatTimer: number | null = null;
let heartbeatController: AbortController | null = null;
let heartbeatPromise: Promise<boolean> | null = null;

type NetworkStatusChangeDetail = {
  previousStatus: OperationalStatus;
  nextStatus: OperationalStatus;
  reason: string;
  healthOk?: boolean;
  healthStatus?: number;
};

function getCurrentOperationalStatus(): OperationalStatus {
  return backendOnline ? "online" : "offline";
}

function logNetworkStatusChange(detail: NetworkStatusChangeDetail) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[networkStatus]", detail);
}

function logHeartbeat(detail: { event: "start" | "end" | "timeout" | "success" | "failure" | "cancel"; reason: string; healthStatus?: number }) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[networkStatus heartbeat]", {
    currentStatus: getCurrentOperationalStatus(),
    ...detail,
  });
}

function emitNetworkStatusChange(detail: NetworkStatusChangeDetail) {
  if (typeof window === "undefined") {
    return;
  }

  logNetworkStatusChange(detail);
  window.dispatchEvent(new CustomEvent<NetworkStatusChangeDetail>(NETWORK_STATUS_EVENT, { detail }));
}

function ensureNetworkListeners() {
  if (typeof window === "undefined" || networkListenersReady) {
    return;
  }

  networkListenersReady = true;

  window.addEventListener("offline", () => {
    enterOfflineFromNavigator("navigator-offline");
  });

  window.addEventListener("online", () => {
    startHeartbeat("navigator-online");
  });

  window.addEventListener("focus", () => {
    startHeartbeat("window-focus");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      startHeartbeat("visibility-visible");
    }
  });

  if (hasBrowserConnectivity()) {
    startHeartbeat("initial-browser-online");
  } else {
    enterOfflineFromNavigator("initial-navigator-offline");
  }
}

export function isBrowserOffline() {
  ensureNetworkListeners();
  if (!hasBrowserConnectivity()) {
    enterOfflineFromNavigator("navigator-offline-read");
    return true;
  }

  return !backendOnline;
}

export function getNetworkStatusSnapshot(): OperationalStatus {
  return getCurrentOperationalStatus();
}

function setBackendOnline(
  nextBackendOnline: boolean,
  options: { reason: string; healthOk?: boolean; healthStatus?: number }
) {
  if (backendOnline !== nextBackendOnline) {
    const previousStatus = getCurrentOperationalStatus();
    backendOnline = nextBackendOnline;
    emitNetworkStatusChange({
      previousStatus,
      nextStatus: getCurrentOperationalStatus(),
      reason: options.reason,
      healthOk: options.healthOk,
      healthStatus: options.healthStatus,
    });
  }

}

function hasBrowserConnectivity() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function cancelActiveHeartbeat(reason: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (heartbeatController) {
    logHeartbeat({ event: "cancel", reason });
    heartbeatController.abort();
    heartbeatController = null;
  }
}

function enterOfflineFromNavigator(reason: string) {
  cancelActiveHeartbeat(reason);
  setBackendOnline(false, { reason });
}

function startHeartbeat(reason: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (!hasBrowserConnectivity()) {
    enterOfflineFromNavigator(`${reason}-navigator-offline`);
    return;
  }

  if (heartbeatTimer === null) {
    heartbeatTimer = window.setInterval(() => {
      void runHealthCheck("heartbeat-interval");
    }, NETWORK_HEARTBEAT_INTERVAL_MS);
  }

  void runHealthCheck(reason);
}

export async function probeNetworkRestored() {
  ensureNetworkListeners();
  return runHealthCheck("manual-probe");
}

async function runHealthCheck(reason: string) {
  if (typeof window === "undefined") {
    return false;
  }

  if (!hasBrowserConnectivity()) {
    enterOfflineFromNavigator(`${reason}-navigator-offline`);
    return false;
  }

  if (heartbeatInFlight && heartbeatPromise) {
    return heartbeatPromise;
  }

  heartbeatInFlight = true;
  heartbeatPromise = (async () => {
    const controller = new AbortController();
    heartbeatController = controller;
    logHeartbeat({ event: "start", reason });

    const timeout = window.setTimeout(() => {
      logHeartbeat({ event: "timeout", reason });
      controller.abort();
    }, NETWORK_HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/health?ts=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.ok) {
        logHeartbeat({ event: "success", reason, healthStatus: response.status });
        setBackendOnline(true, { reason: "health-ok", healthOk: true, healthStatus: response.status });
        return true;
      }

      logHeartbeat({ event: "failure", reason, healthStatus: response.status });
      setBackendOnline(false, { reason: "health-not-ok", healthOk: false, healthStatus: response.status });
      return false;
    } catch {
      logHeartbeat({ event: "failure", reason });
      setBackendOnline(false, { reason: "health-error", healthOk: false });
      return false;
    } finally {
      window.clearTimeout(timeout);
      if (heartbeatController === controller) {
        heartbeatController = null;
      }
      heartbeatInFlight = false;
      heartbeatPromise = null;
      logHeartbeat({ event: "end", reason });
    }
  })();

  return heartbeatPromise;
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
    setBackendOnline(false, { reason: "network-request-error" });
    if (hasBrowserConnectivity()) {
      startHeartbeat("network-request-error");
    }
  }

  return isNetworkError;
}

export function assertBrowserOnline() {
  if (isBrowserOffline()) {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}
