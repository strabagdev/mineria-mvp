import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApprovedUser: vi.fn(),
  requireOperationalUser: vi.fn(),
  deletePlanningItem: vi.fn(),
  isPlanningCategoryDto: vi.fn(),
  isPlanningShiftDto: vi.fn(),
  isPlanningTrackingTypeDto: vi.fn(),
  normalizePlanningItemMutationPayload: vi.fn(),
  findPlanningCatalogDetailByTypeAndLabel: vi.fn(),
  findPlanningCatalogTypeByCategoryAndLabel: vi.fn(),
  findPlannedItemSummaryByActivityGroupId: vi.fn(),
  prepareOperationalHeaderMutationValues: vi.fn(),
  createPlannedPlanningItem: vi.fn(),
  createRealPlanningSegments: vi.fn(),
  listPlanningItems: vi.fn(),
  updatePlannedPlanningItem: vi.fn(),
  updateRealPlanningSegment: vi.fn(),
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
  isPlanningCategoryDto: mocks.isPlanningCategoryDto,
  isPlanningShiftDto: mocks.isPlanningShiftDto,
  isPlanningTrackingTypeDto: mocks.isPlanningTrackingTypeDto,
  normalizePlanningItemMutationPayload: mocks.normalizePlanningItemMutationPayload,
}));

vi.mock("@/server/repositories/planning-catalog.repository", () => ({
  findPlanningCatalogDetailByTypeAndLabel: mocks.findPlanningCatalogDetailByTypeAndLabel,
  findPlanningCatalogTypeByCategoryAndLabel: mocks.findPlanningCatalogTypeByCategoryAndLabel,
}));

vi.mock("@/server/repositories/planning-items.repository", () => ({
  findPlannedItemSummaryByActivityGroupId: mocks.findPlannedItemSummaryByActivityGroupId,
}));

vi.mock("@/server/repositories/planning-segments.repository", () => ({
  listSegmentsForOverlap: vi.fn(),
}));

vi.mock("@/server/services/operational-header.service", () => ({
  prepareOperationalHeaderMutationValues: mocks.prepareOperationalHeaderMutationValues,
}));

vi.mock("@/server/services/planning-items.service", () => ({
  createPlannedPlanningItem: mocks.createPlannedPlanningItem,
  createRealPlanningSegments: mocks.createRealPlanningSegments,
  deletePlanningItem: mocks.deletePlanningItem,
  listPlanningItems: mocks.listPlanningItems,
  updatePlannedPlanningItem: mocks.updatePlannedPlanningItem,
  updateRealPlanningSegment: mocks.updateRealPlanningSegment,
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
    mocks.isPlanningCategoryDto.mockImplementation((value: string) =>
      value === "actividad" || value === "interferencia"
    );
    mocks.isPlanningTrackingTypeDto.mockImplementation((value: string) =>
      value === "programado" || value === "real"
    );
    mocks.isPlanningShiftDto.mockImplementation((value: string) =>
      value === "Dia" || value === "Noche"
    );
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

  it("accepts planned interferences when category, type and description exist in catalog", async () => {
    const payload = {
      activity_group_id: "group-1",
      client_mutation_id: null,
      item_date: "2026-06-16",
      start_time: "08:00",
      end_time: "09:00",
      shift: "Dia",
      category: "interferencia",
      tracking_type: "programado",
      item_type: "Administrativa",
      description: "Permiso interno",
      notes: null,
      operational_header_values: [
        { field_id: 1, value: "NTI", option_id: 10 },
        { field_id: 2, value: "GT1", option_id: 20 },
      ],
    };
    mocks.requireOperationalUser.mockResolvedValue({
      user: { id: "user-1" },
      profile: { id: "profile-1" },
    });
    mocks.normalizePlanningItemMutationPayload.mockReturnValue(payload);
    mocks.prepareOperationalHeaderMutationValues.mockResolvedValue({
      values: payload.operational_header_values,
    });
    mocks.findPlanningCatalogTypeByCategoryAndLabel.mockResolvedValue({ id: 20 });
    mocks.findPlanningCatalogDetailByTypeAndLabel.mockResolvedValue({ id: 200 });
    mocks.createPlannedPlanningItem.mockResolvedValue({
      status: "created",
      item: { id: 99, ...payload },
    });
    const { POST } = await import("../app/api/planning-items/route");

    const response = await POST(jsonRequest("POST", payload));

    expect(response?.status).toBe(201);
    expect(mocks.findPlanningCatalogTypeByCategoryAndLabel).toHaveBeenCalledWith(
      "interferencia",
      "Administrativa"
    );
    expect(mocks.findPlanningCatalogDetailByTypeAndLabel).toHaveBeenCalledWith(20, "Permiso interno");
    expect(mocks.createPlannedPlanningItem).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          category: "interferencia",
          tracking_type: "programado",
          item_type: "Administrativa",
          description: "Permiso interno",
        }),
      })
    );
  });
});
