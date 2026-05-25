import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOperationalEvents,
  getOperationalEvents,
  recordOperationalEvent,
} from "./logger";

describe("operational observability logger", () => {
  beforeEach(() => {
    clearOperationalEvents();
    vi.restoreAllMocks();
  });

  it("buffers structured events in memory", () => {
    recordOperationalEvent({
      name: "sync.replay_started",
      source: "test",
      metadata: { pendingCount: 2 },
    });

    expect(getOperationalEvents()).toMatchObject([
      {
        level: "info",
        name: "sync.replay_started",
        source: "test",
        metadata: { pendingCount: 2 },
      },
    ]);
  });

  it("removes sensitive metadata keys", () => {
    recordOperationalEvent({
      level: "warn",
      name: "auth.profile_sync_failed",
      source: "test",
      metadata: {
        reason: "not-ok",
        accessToken: "secret-token",
        authorization: "Bearer secret",
      },
    });

    expect(getOperationalEvents()[0].metadata).toEqual({ reason: "not-ok" });
  });

  it("caps the memory buffer", () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    for (let index = 0; index < 160; index += 1) {
      recordOperationalEvent({
        name: "network.heartbeat",
        source: "test",
        metadata: { index },
      });
    }

    const events = getOperationalEvents();

    expect(events).toHaveLength(150);
    expect(events[0].metadata).toMatchObject({ index: 10 });
    expect(events.at(-1)?.metadata).toMatchObject({ index: 159 });
  });
});
