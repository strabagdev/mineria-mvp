import { describe, expect, it, vi } from "vitest";

import { clearOperationalEvents, getOperationalEvents } from "../lib/observability/logger";
import { buildInternalEventIdempotencyKey } from "./contracts";
import { InProcessEventBus } from "./event-bus";

describe("in-process event bus", () => {
  it("publishes typed events to subscribed handlers", async () => {
    clearOperationalEvents();
    const bus = new InProcessEventBus();
    const handler = vi.fn();

    bus.subscribe("debug.event_published", handler);

    const result = await bus.publish({
      name: "debug.event_published",
      payload: { message: "probe" },
      metadata: { sourceModule: "events.test", correlationId: "corr-1" },
    });

    expect(result.handlerCount).toBe(1);
    expect(result.failures).toHaveLength(0);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: "debug.event_published" }));
    expect(getOperationalEvents().at(-1)).toMatchObject({
      name: "event_bus.published",
      metadata: { eventName: "debug.event_published", handlerCount: 1 },
    });
  });

  it("unsubscribes handlers", async () => {
    const bus = new InProcessEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("cache.invalidated", handler);

    unsubscribe();

    const result = await bus.publish({
      name: "cache.invalidated",
      payload: { dataset: "reports" },
      metadata: { sourceModule: "events.test" },
    });

    expect(result.handlerCount).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it("captures handler failures without stopping remaining handlers", async () => {
    const bus = new InProcessEventBus();
    const successfulHandler = vi.fn();

    bus.subscribe("notification.requested", () => {
      throw new Error("handler failed");
    });
    bus.subscribe("notification.requested", successfulHandler);

    const result = await bus.publish({
      name: "notification.requested",
      payload: { channel: "email", priority: "normal" },
      metadata: { sourceModule: "events.test" },
    });

    expect(result.handlerCount).toBe(2);
    expect(result.failures).toHaveLength(1);
    expect(successfulHandler).toHaveBeenCalled();
  });

  it("builds stable event idempotency keys", () => {
    expect(buildInternalEventIdempotencyKey("report.generated", ["2026-05-01", "2026-05-07", "", null, 18])).toBe(
      "report.generated:2026-05-01:2026-05-07:18"
    );
  });
});
