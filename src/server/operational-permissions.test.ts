import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApprovedUser: vi.fn(),
  requireOperationalUser: vi.fn(),
  deletePlanningItem: vi.fn(),
}));

vi.mock("@/lib/accessControl", () => ({
  requireApprovedUser: mocks.requireApprovedUser,
  requireOperationalUser: mocks.requireOperationalUser,
}));

vi.mock("@/lib/errorMessage", () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Unknown error",
  getErrorStatus: (error: unknown) =>
    error instanceof Error && /permisos operativos/i.test(error.message) ? 403 : 500,
}));

vi.mock("@/modules/planning/contracts/planning-items", () => ({
  isPlanningCategoryDto: vi.fn(),
  isPlanningShiftDto: vi.fn(),
  isPlanningTrackingTypeDto: vi.fn(),
  normalizePlanningItemMutationPayload: vi.fn(),
}));

vi.mock("@/server/repositories/planning-catalog.repository", () => ({
  findPlanningCatalogDetailByTypeAndLabel: vi.fn(),
  findPlanningCatalogTypeByCategoryAndLabel: vi.fn(),
  findPlanningLevelByLabel: vi.fn(),
}));

vi.mock("@/server/repositories/planning-items.repository", () => ({
  findPlannedItemSummaryByActivityGroupId: vi.fn(),
}));

vi.mock("@/server/repositories/planning-segments.repository", () => ({
  listSegmentsForOverlap: vi.fn(),
}));

vi.mock("@/server/services/planning-items.service", () => ({
  createPlannedPlanningItem: vi.fn(),
  createRealPlanningSegments: vi.fn(),
  deletePlanningItem: mocks.deletePlanningItem,
  listPlanningItems: vi.fn(),
  updatePlannedPlanningItem: vi.fn(),
  updateRealPlanningSegment: vi.fn(),
}));

function jsonRequest(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  return new Request("http://local.test/api/planning-items", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("operational permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 when viewer users try to create planning items", async () => {
    mocks.requireOperationalUser.mockRejectedValue(new Error("Necesitas permisos operativos."));
    const { POST } = await import("../app/api/planning-items/route");

    const response = await POST(jsonRequest("POST", { tracking_type: "programado" }));

    expect(response?.status).toBe(403);
  });

  it("returns 403 when viewer users try to edit planning items", async () => {
    mocks.requireOperationalUser.mockRejectedValue(new Error("Necesitas permisos operativos."));
    const { PATCH } = await import("../app/api/planning-items/route");

    const response = await PATCH(jsonRequest("PATCH", { id: 10, tracking_type: "programado" }));

    expect(response?.status).toBe(403);
  });

  it("returns 403 when viewer users try to delete planning items", async () => {
    mocks.requireOperationalUser.mockRejectedValue(new Error("Necesitas permisos operativos."));
    const { DELETE } = await import("../app/api/planning-items/route");

    const response = await DELETE(jsonRequest("DELETE", { id: 10, tracking_type: "programado" }));

    expect(response.status).toBe(403);
    expect(mocks.deletePlanningItem).not.toHaveBeenCalled();
  });
});
