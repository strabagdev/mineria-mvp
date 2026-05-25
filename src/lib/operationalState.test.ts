import { describe, expect, it } from "vitest";
import { buildOperationalState } from "./operationalState";

describe("operational state model", () => {
  it("keeps the current online/offline semaphore as the network state", () => {
    expect(buildOperationalState({ network: "online", hasSession: true })).toMatchObject({
      primary: "online",
      network: "online",
      severity: "nominal",
      canRead: true,
      canWriteOnline: true,
    });
  });

  it("distinguishes backend unreachable from plain offline", () => {
    const state = buildOperationalState({
      network: "offline",
      backendReachable: false,
      hasSession: true,
    });

    expect(state.primary).toBe("backend-unreachable");
    expect(state.states).toEqual(["offline", "backend-unreachable"]);
    expect(state.severity).toBe("warning");
  });

  it("marks offline cache and no snapshot as different read states", () => {
    expect(
      buildOperationalState({
        network: "offline",
        hasSession: true,
        hasLocalSnapshot: true,
        expectsLocalSnapshot: true,
      })
    ).toMatchObject({
      primary: "offline-cache",
      canRead: true,
    });

    expect(
      buildOperationalState({
        network: "offline",
        hasSession: true,
        hasLocalSnapshot: false,
        expectsLocalSnapshot: true,
      })
    ).toMatchObject({
      primary: "offline-no-snapshot",
      severity: "critical",
      canRead: false,
    });
  });

  it("prioritizes conflicts over pending and syncing states", () => {
    const state = buildOperationalState({
      network: "online",
      hasSession: true,
      pendingSyncCount: 3,
      conflictCount: 1,
      syncing: true,
    });

    expect(state.primary).toBe("sync-conflict");
    expect(state.states).toEqual(["online", "sync-pending", "syncing", "sync-conflict"]);
    expect(state.hasPendingSync).toBe(true);
    expect(state.hasConflict).toBe(true);
  });

  it("supports degraded reads after refresh failures", () => {
    expect(
      buildOperationalState({
        network: "online",
        hasSession: true,
        hasLocalSnapshot: true,
        refreshFailed: true,
      })
    ).toMatchObject({
      primary: "degraded-read",
      severity: "info",
    });
  });
});
