import { afterEach, describe, expect, it } from "vitest";
import { isPlanningRealtimeEnabled } from "./featureFlags";

describe("feature flags", () => {
  const previousValue = process.env.NEXT_PUBLIC_ENABLE_PLANNING_REALTIME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_PLANNING_REALTIME = previousValue;
  });

  it("keeps planning Realtime enabled by default", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_PLANNING_REALTIME;

    expect(isPlanningRealtimeEnabled()).toBe(true);
  });

  it("disables planning Realtime only with the explicit false value", () => {
    process.env.NEXT_PUBLIC_ENABLE_PLANNING_REALTIME = "false";

    expect(isPlanningRealtimeEnabled()).toBe(false);
  });
});
