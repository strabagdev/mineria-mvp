export type OperationalStatus = "online" | "offline";

export type OperationalStateCode =
  | OperationalStatus
  | "backend-unreachable"
  | "auth-required"
  | "offline-cache"
  | "offline-no-snapshot"
  | "sync-pending"
  | "syncing"
  | "sync-conflict"
  | "degraded-read"
  | "refresh-failed"
  | "realtime-deferred";

export type OperationalSeverity = "nominal" | "info" | "warning" | "critical";

export type OperationalState = {
  primary: OperationalStateCode;
  network: OperationalStatus;
  states: OperationalStateCode[];
  severity: OperationalSeverity;
  canRead: boolean;
  canWriteOnline: boolean;
  hasPendingSync: boolean;
  hasConflict: boolean;
};

export type BuildOperationalStateInput = {
  network: OperationalStatus;
  backendReachable?: boolean | null;
  hasSession?: boolean;
  hasOfflineProfile?: boolean;
  hasLocalSnapshot?: boolean;
  expectsLocalSnapshot?: boolean;
  pendingSyncCount?: number;
  conflictCount?: number;
  syncing?: boolean;
  refreshFailed?: boolean;
  realtimeDeferred?: boolean;
};

function uniqueStates(states: OperationalStateCode[]) {
  return Array.from(new Set(states));
}

function deriveSeverity(states: OperationalStateCode[]): OperationalSeverity {
  if (states.includes("sync-conflict") || states.includes("offline-no-snapshot") || states.includes("auth-required")) {
    return "critical";
  }

  if (states.includes("offline") || states.includes("backend-unreachable") || states.includes("refresh-failed")) {
    return "warning";
  }

  if (
    states.includes("offline-cache") ||
    states.includes("degraded-read") ||
    states.includes("sync-pending") ||
    states.includes("syncing") ||
    states.includes("realtime-deferred")
  ) {
    return "info";
  }

  return "nominal";
}

function choosePrimary(states: OperationalStateCode[]): OperationalStateCode {
  const priority: OperationalStateCode[] = [
    "sync-conflict",
    "auth-required",
    "offline-no-snapshot",
    "backend-unreachable",
    "offline-cache",
    "syncing",
    "sync-pending",
    "degraded-read",
    "refresh-failed",
    "realtime-deferred",
    "offline",
    "online",
  ];

  return priority.find((state) => states.includes(state)) ?? "online";
}

export function buildOperationalState(input: BuildOperationalStateInput): OperationalState {
  const pendingSyncCount = input.pendingSyncCount ?? 0;
  const conflictCount = input.conflictCount ?? 0;
  const hasPendingSync = pendingSyncCount > 0;
  const hasConflict = conflictCount > 0;
  const states: OperationalStateCode[] = [input.network];

  if (input.network === "offline" && input.backendReachable === false) {
    states.push("backend-unreachable");
  }

  if (!input.hasSession && !input.hasOfflineProfile) {
    states.push("auth-required");
  }

  if (input.network === "offline" && input.hasLocalSnapshot) {
    states.push("offline-cache");
  }

  if (input.network === "offline" && input.expectsLocalSnapshot && !input.hasLocalSnapshot) {
    states.push("offline-no-snapshot");
  }

  if (hasPendingSync) {
    states.push("sync-pending");
  }

  if (input.syncing) {
    states.push("syncing");
  }

  if (hasConflict) {
    states.push("sync-conflict");
  }

  if (input.refreshFailed) {
    states.push(input.hasLocalSnapshot ? "degraded-read" : "refresh-failed");
  }

  if (input.realtimeDeferred) {
    states.push("realtime-deferred");
  }

  const normalizedStates = uniqueStates(states);
  const canRead = input.network === "online" || Boolean(input.hasLocalSnapshot);
  const canWriteOnline = input.network === "online" && Boolean(input.hasSession);

  return {
    primary: choosePrimary(normalizedStates),
    network: input.network,
    states: normalizedStates,
    severity: deriveSeverity(normalizedStates),
    canRead,
    canWriteOnline,
    hasPendingSync,
    hasConflict,
  };
}
