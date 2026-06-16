import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApprovedUser: vi.fn(),
  requireAdminUser: vi.fn(),
  requireOperationalUser: vi.fn(),
  getPlanningCatalog: vi.fn(),
  slugifyPlanningCatalogValue: vi.fn(),
  createCatalogType: vi.fn(),
  getCustomFieldValues: vi.fn(),
  getCustomFieldValuesForPlanningItems: vi.fn(),
  saveCustomFieldValues: vi.fn(),
  getPlanningAssignments: vi.fn(),
  getPlanningAssignmentsForPlanningItems: vi.fn(),
  savePlanningAssignments: vi.fn(),
  getReport: vi.fn(),
}));

vi.mock("@/lib/accessControl", () => ({
  requireApprovedUser: mocks.requireApprovedUser,
  requireAdminUser: mocks.requireAdminUser,
  requireOperationalUser: mocks.requireOperationalUser,
}));

vi.mock("@/lib/errorMessage", () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Unknown error",
  getErrorStatus: (error: unknown) =>
    error instanceof Error && /permisos de administrador|permisos operativos/i.test(error.message) ? 403 : 500,
}));

vi.mock("@/server/services/planning-catalog.service", () => ({
  createCatalogDetail: vi.fn(),
  createCatalogLevel: vi.fn(),
  createCatalogType: mocks.createCatalogType,
  deleteCatalogDetail: vi.fn(),
  deleteCatalogLevel: vi.fn(),
  deleteCatalogType: vi.fn(),
  getPlanningCatalog: mocks.getPlanningCatalog,
  slugifyPlanningCatalogValue: mocks.slugifyPlanningCatalogValue,
  updateCatalogDetail: vi.fn(),
  updateCatalogLevel: vi.fn(),
  updateCatalogType: vi.fn(),
}));

vi.mock("@/server/services/planning-custom-fields.service", () => ({
  getCustomFieldValues: mocks.getCustomFieldValues,
  getCustomFieldValuesForPlanningItems: mocks.getCustomFieldValuesForPlanningItems,
  saveCustomFieldValues: mocks.saveCustomFieldValues,
}));

vi.mock("@/server/services/planning-assignments.service", () => ({
  getPlanningAssignments: mocks.getPlanningAssignments,
  getPlanningAssignmentsForPlanningItems: mocks.getPlanningAssignmentsForPlanningItems,
  savePlanningAssignments: mocks.savePlanningAssignments,
}));

vi.mock("@/server/services/reports.service", () => ({
  getReport: mocks.getReport,
}));

const adminActor = {
  user: { id: "admin-user", email: "admin@example.com" },
  profile: {
    user_id: "admin-user",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin",
    active: true,
    approval_status: "approved",
  },
} as const;

const viewerActor = {
  user: { id: "viewer-user", email: "viewer@example.com" },
  profile: {
    user_id: "viewer-user",
    email: "viewer@example.com",
    full_name: "Operativo",
    role: "viewer",
    active: true,
    approval_status: "approved",
  },
} as const;

const operatorActor = {
  user: { id: "operator-user", email: "operator@example.com" },
  profile: {
    user_id: "operator-user",
    email: "operator@example.com",
    full_name: "Operativo",
    role: "operator",
    active: true,
    approval_status: "approved",
  },
} as const;

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("catalog permissions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("allows approved viewer users to read the planning catalog", async () => {
    mocks.requireApprovedUser.mockResolvedValue(viewerActor);
    mocks.getPlanningCatalog.mockResolvedValue({ categories: [], levels: [] });
    const { GET } = await import("../app/api/planning-catalog/route");

    const response = await GET(new Request("http://local.test/api/planning-catalog"));

    expect(response.status).toBe(200);
    expect(mocks.requireApprovedUser).toHaveBeenCalledTimes(1);
    expect(mocks.getPlanningCatalog).toHaveBeenCalledTimes(1);
  });

  it("allows approved viewer users to read reports", async () => {
    mocks.requireApprovedUser.mockResolvedValue(viewerActor);
    mocks.getReport.mockResolvedValue({
      filters: {},
      summary: {},
      breakdowns: {},
      rows: [],
    });
    const { GET } = await import("../app/api/reports/route");

    const response = await GET(new Request("http://local.test/api/reports?date_from=2026-01-01&date_to=2026-01-01"));

    expect(response.status).toBe(200);
    expect(mocks.requireApprovedUser).toHaveBeenCalledTimes(1);
    expect(mocks.getReport).toHaveBeenCalledTimes(1);
  });

  it("allows admin users to create catalog definitions", async () => {
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    mocks.slugifyPlanningCatalogValue.mockReturnValue("actividad");
    mocks.createCatalogType.mockResolvedValue({ id: 1, category: "actividad", slug: "actividad", label: "Actividad" });
    const { POST } = await import("../app/api/planning-catalog/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-catalog", {
      entity: "type",
      category: "actividad",
      label: "Actividad",
    }));

    expect(response.status).toBe(201);
    expect(mocks.requireAdminUser).toHaveBeenCalledTimes(1);
    expect(mocks.createCatalogType).toHaveBeenCalledWith({
      actor: adminActor,
      category: "actividad",
      slug: "actividad",
      label: "Actividad",
    });
  });

  it("returns 403 when viewer users try to write catalog definitions", async () => {
    mocks.requireAdminUser.mockRejectedValue(new Error("Necesitas permisos de administrador."));
    const { POST } = await import("../app/api/planning-catalog/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-catalog", {
      entity: "type",
      category: "actividad",
      label: "Actividad",
    }));

    expect(response.status).toBe(403);
    expect(mocks.createCatalogType).not.toHaveBeenCalled();
  });

  it("keeps operational custom field values writable for operator users", async () => {
    mocks.requireOperationalUser.mockResolvedValue(operatorActor);
    mocks.saveCustomFieldValues.mockResolvedValue([{ id: 10, field_id: 2, value: "Turno preparado" }]);
    const { POST } = await import("../app/api/planning-custom-field-values/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-custom-field-values", {
      planning_item_id: 123,
      values: [{ field_id: 2, value: "Turno preparado" }],
    }));

    expect(response.status).toBe(200);
    expect(mocks.requireOperationalUser).toHaveBeenCalledTimes(1);
    expect(mocks.saveCustomFieldValues).toHaveBeenCalledWith({
      actor: operatorActor,
      target: {
        planningItemId: 123,
        executionSegmentId: null,
        activityGroupId: null,
      },
      values: [{ field_id: 2, value: "Turno preparado" }],
    });
  });

  it("returns 403 when viewer users try to write operational custom field values", async () => {
    mocks.requireOperationalUser.mockRejectedValue(new Error("Necesitas permisos operativos."));
    const { POST } = await import("../app/api/planning-custom-field-values/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-custom-field-values", {
      planning_item_id: 123,
      values: [{ field_id: 2, value: "Turno preparado" }],
    }));

    expect(response.status).toBe(403);
    expect(mocks.saveCustomFieldValues).not.toHaveBeenCalled();
  });

  it("returns 403 when viewer users try to write planning assignments", async () => {
    mocks.requireOperationalUser.mockRejectedValue(new Error("Necesitas permisos operativos."));
    const { POST } = await import("../app/api/planning-assignments/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-assignments", {
      planning_item_id: 123,
      assignments: [],
    }));

    expect(response.status).toBe(403);
    expect(mocks.savePlanningAssignments).not.toHaveBeenCalled();
  });
});
