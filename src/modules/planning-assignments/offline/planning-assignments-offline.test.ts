import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/localOfflineStore", () => ({
  buildPlanningAssignmentsCacheKey: (planningItemId: number) => `planning-assignments:${planningItemId}`,
  OFFLINE_KEYS: {
    assignmentTargetsPrefix: "assignments",
    planningAssignmentTypes: "planning-assignment-types",
  },
  readKeyValueCache: vi.fn(),
  saveKeyValueCache: vi.fn(),
}));

describe("planning assignments offline helpers", () => {
  it("builds target-aware cache keys for planning items", async () => {
    const { buildAssignmentCacheKey } = await import("./planning-assignments-offline");

    expect(buildAssignmentCacheKey({ target_kind: "planning_item", target_id: 42 })).toBe(
      "assignments:planning_item:42"
    );
  });

  it("builds target-aware cache keys for execution segments", async () => {
    const { buildAssignmentCacheKey } = await import("./planning-assignments-offline");

    expect(buildAssignmentCacheKey({ target_kind: "execution_segment", target_id: 77 })).toBe(
      "assignments:execution_segment:77"
    );
  });

  it("keeps legacy planning item wrappers callable", async () => {
    const { readPlanningAssignmentsCache, savePlanningAssignmentsCache } = await import("./planning-assignments-offline");

    expect(typeof readPlanningAssignmentsCache).toBe("function");
    expect(typeof savePlanningAssignmentsCache).toBe("function");
  });
});
