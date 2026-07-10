import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApprovedUser: vi.fn(),
  requireAdminUser: vi.fn(),
  requireOperationalUser: vi.fn(),
  getPlanningCatalog: vi.fn(),
  getOperationalHeaderConfig: vi.fn(),
  createOperationalHeaderDependencyDefinition: vi.fn(),
  createOperationalHeaderFieldDefinition: vi.fn(),
  createOperationalHeaderOptionDefinition: vi.fn(),
  deleteOperationalHeaderDependencyDefinition: vi.fn(),
  deleteUnusedOperationalHeaderFieldDefinition: vi.fn(),
  deleteUnusedOperationalHeaderOptionDefinition: vi.fn(),
  updateOperationalHeaderFieldDefinition: vi.fn(),
  updateOperationalHeaderOptionDefinition: vi.fn(),
  slugifyPlanningCatalogValue: vi.fn(),
  createCatalogDetail: vi.fn(),
  createCatalogLevel: vi.fn(),
  createCatalogType: vi.fn(),
  deleteCatalogDetail: vi.fn(),
  deleteCatalogLevel: vi.fn(),
  deleteCatalogType: vi.fn(),
  updateCatalogDetail: vi.fn(),
  updateCatalogLevel: vi.fn(),
  updateCatalogType: vi.fn(),
  getAssignmentsForTarget: vi.fn(),
  getPlanningAssignments: vi.fn(),
  getPlanningAssignmentsForPlanningItems: vi.fn(),
  saveAssignmentsForTarget: vi.fn(),
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

vi.mock("@/modules/operational-header/contracts/operational-header", () => ({
  isOperationalHeaderInputType: (value: string) => value === "text" || value === "select",
}));

vi.mock("@/server/services/planning-catalog.service", () => ({
  createCatalogDetail: mocks.createCatalogDetail,
  createCatalogLevel: mocks.createCatalogLevel,
  createCatalogType: mocks.createCatalogType,
  deleteCatalogDetail: mocks.deleteCatalogDetail,
  deleteCatalogLevel: mocks.deleteCatalogLevel,
  deleteCatalogType: mocks.deleteCatalogType,
  getPlanningCatalog: mocks.getPlanningCatalog,
  slugifyPlanningCatalogValue: mocks.slugifyPlanningCatalogValue,
  updateCatalogDetail: mocks.updateCatalogDetail,
  updateCatalogLevel: mocks.updateCatalogLevel,
  updateCatalogType: mocks.updateCatalogType,
}));

vi.mock("@/server/services/operational-header.service", () => ({
  createOperationalHeaderDependencyDefinition: mocks.createOperationalHeaderDependencyDefinition,
  createOperationalHeaderFieldDefinition: mocks.createOperationalHeaderFieldDefinition,
  createOperationalHeaderOptionDefinition: mocks.createOperationalHeaderOptionDefinition,
  deleteOperationalHeaderDependencyDefinition: mocks.deleteOperationalHeaderDependencyDefinition,
  deleteUnusedOperationalHeaderFieldDefinition: mocks.deleteUnusedOperationalHeaderFieldDefinition,
  deleteUnusedOperationalHeaderOptionDefinition: mocks.deleteUnusedOperationalHeaderOptionDefinition,
  getOperationalHeaderConfig: mocks.getOperationalHeaderConfig,
  slugifyOperationalHeaderField: (value: string) =>
    value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
  slugifyOperationalHeaderOptionValue: (value: string) =>
    value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
  updateOperationalHeaderFieldDefinition: mocks.updateOperationalHeaderFieldDefinition,
  updateOperationalHeaderOptionDefinition: mocks.updateOperationalHeaderOptionDefinition,
}));

vi.mock("@/server/services/planning-assignments.service", () => ({
  getAssignmentsForTarget: mocks.getAssignmentsForTarget,
  getPlanningAssignments: mocks.getPlanningAssignments,
  getPlanningAssignmentsForPlanningItems: mocks.getPlanningAssignmentsForPlanningItems,
  saveAssignmentsForTarget: mocks.saveAssignmentsForTarget,
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

  it("passes dynamic operational header filters to reports", async () => {
    mocks.requireApprovedUser.mockResolvedValue(viewerActor);
    mocks.getReport.mockResolvedValue({
      filters: {},
      summary: {},
      breakdowns: {},
      rows: [],
    });
    const { GET } = await import("../app/api/reports/route");

    const response = await GET(new Request(
      "http://local.test/api/reports?date_from=2026-01-01&date_to=2026-01-07&header_departamento=Mineria&header_especialidad=Perforaci%C3%B3n&shift=Dia"
    ));

    expect(response.status).toBe(200);
    expect(mocks.getReport).toHaveBeenCalledWith(expect.objectContaining({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-07",
      shift: "Dia",
      operational_header_filters: {
        departamento: "Mineria",
        especialidad: "Perforación",
      },
    }));
  });

  it("uses dynamic operational header filters in reports", async () => {
    mocks.requireApprovedUser.mockResolvedValue(viewerActor);
    mocks.getReport.mockResolvedValue({
      filters: {},
      summary: {},
      breakdowns: {},
      rows: [],
    });
    const { GET } = await import("../app/api/reports/route");

    const response = await GET(new Request("http://local.test/api/reports?header_nivel=NTI&header_frente=Frente%202"));

    expect(response.status).toBe(200);
    expect(mocks.getReport).toHaveBeenCalledWith(expect.objectContaining({
      operational_header_filters: {
        nivel: "NTI",
        frente: "Frente 2",
      },
    }));
  });

  it("allows approved viewer users to read operational header metadata", async () => {
    mocks.requireApprovedUser.mockResolvedValue(viewerActor);
    mocks.getOperationalHeaderConfig.mockResolvedValue({
      fields: [
        {
          id: 1,
          slug: "nivel",
          label: "Nivel",
          input_type: "select",
          required: true,
          active: true,
          sort_order: 10,
          groupable: true,
          filterable: true,
          visible_in_gantt: true,
          exportable: true,
          options: [
            {
              id: 10,
              field_id: 1,
              value: "nti",
              label: "NTI",
              active: true,
              sort_order: 10,
              metadata: {},
            },
          ],
        },
      ],
      dependencies: [
        {
          id: 100,
          field_id: 1,
          option_id: 10,
          depends_on_field_id: 1,
          depends_on_option_id: 10,
        },
      ],
    });
    const route = await import("../app/api/operational-header/route");

    const response = await route.GET(new Request("http://local.test/api/operational-header"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.requireApprovedUser).toHaveBeenCalledTimes(1);
    expect(mocks.getOperationalHeaderConfig).toHaveBeenCalledWith({ activeOnly: true });
    expect(json.fields[0]).toMatchObject({
      slug: "nivel",
      sort_order: 10,
      visible_in_gantt: true,
      options: [expect.objectContaining({ label: "NTI" })],
    });
    expect(json.dependencies).toEqual([
      {
        id: 100,
        field_id: 1,
        option_id: 10,
        depends_on_field_id: 1,
        depends_on_option_id: 10,
      },
    ]);
  });

  it("requires admin users for operational header mutations", async () => {
    mocks.requireAdminUser.mockRejectedValue(new Error("Necesitas permisos de administrador."));
    const route = await import("../app/api/operational-header/route");

    await expect(route.POST(jsonRequest("http://local.test/api/operational-header", {
      label: "Area",
      input_type: "text",
    }))).resolves.toHaveProperty("status", 403);
    await expect(route.PATCH(new Request("http://local.test/api/operational-header", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, label: "Area" }),
    }))).resolves.toHaveProperty("status", 403);
    await expect(route.DELETE(new Request("http://local.test/api/operational-header", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1 }),
    }))).resolves.toHaveProperty("status", 403);
    expect(mocks.createOperationalHeaderFieldDefinition).not.toHaveBeenCalled();
    expect(mocks.updateOperationalHeaderFieldDefinition).not.toHaveBeenCalled();
    expect(mocks.deleteUnusedOperationalHeaderFieldDefinition).not.toHaveBeenCalled();
  });

  it("blocks unapproved users from reading operational header metadata", async () => {
    mocks.requireApprovedUser.mockRejectedValue(new Error("Necesitas una cuenta aprobada."));
    const { GET } = await import("../app/api/operational-header/route");

    const response = await GET(new Request("http://local.test/api/operational-header"));

    expect(response.status).toBe(500);
    expect(mocks.getOperationalHeaderConfig).not.toHaveBeenCalled();
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

  it("allows admin users to create catalog details", async () => {
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    mocks.createCatalogDetail.mockResolvedValue({ id: 10, type_id: 1, label: "Avance" });
    const { POST } = await import("../app/api/planning-catalog/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-catalog", {
      entity: "detail",
      type_id: 1,
      label: "Avance",
    }));

    expect(response.status).toBe(201);
    expect(mocks.createCatalogDetail).toHaveBeenCalledWith({
      actor: adminActor,
      typeId: 1,
      label: "Avance",
    });
  });

  it("rejects removed planning level creation as unsupported", async () => {
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    const { POST } = await import("../app/api/planning-catalog/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-catalog", {
      entity: "level",
      label: "NTI",
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Entidad no soportada. Usa type o detail." });
  });

  it("rejects removed planning level updates as unsupported", async () => {
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    const { PATCH } = await import("../app/api/planning-catalog/route");

    const response = await PATCH(new Request("http://local.test/api/planning-catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "level",
        id: 1,
        label: "NNM",
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Entidad no soportada. Usa type o detail." });
  });

  it("rejects removed planning level deletes as unsupported", async () => {
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    const { DELETE } = await import("../app/api/planning-catalog/route");

    const response = await DELETE(new Request("http://local.test/api/planning-catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "level",
        id: 1,
      }),
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: "Entidad no soportada. Usa type o detail." });
  });

  it("allows admin users to update and delete non-level catalog entities", async () => {
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    mocks.slugifyPlanningCatalogValue.mockReturnValue("actividad-editada");
    mocks.updateCatalogType.mockResolvedValue({
      id: 1,
      category: "actividad",
      slug: "actividad-editada",
      label: "Actividad editada",
    });
    mocks.deleteCatalogDetail.mockResolvedValue(undefined);
    const route = await import("../app/api/planning-catalog/route");

    const patchResponse = await route.PATCH(new Request("http://local.test/api/planning-catalog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "type",
        id: 1,
        category: "actividad",
        label: "Actividad editada",
      }),
    }));
    const deleteResponse = await route.DELETE(new Request("http://local.test/api/planning-catalog", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entity: "detail",
        id: 10,
      }),
    }));

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(mocks.updateCatalogType).toHaveBeenCalledWith({
      actor: adminActor,
      id: 1,
      category: "actividad",
      slug: "actividad-editada",
      label: "Actividad editada",
    });
    expect(mocks.deleteCatalogDetail).toHaveBeenCalledWith({
      actor: adminActor,
      id: 10,
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

  it("keeps planning item assignments writable with the legacy payload", async () => {
    mocks.requireOperationalUser.mockResolvedValue(operatorActor);
    mocks.savePlanningAssignments.mockResolvedValue([]);
    const { POST } = await import("../app/api/planning-assignments/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-assignments", {
      planning_item_id: 123,
      assignments: [],
    }));

    expect(response.status).toBe(200);
    expect(mocks.savePlanningAssignments).toHaveBeenCalledWith({
      actor: operatorActor,
      planningItemId: 123,
      assignments: [],
    });
    expect(mocks.saveAssignmentsForTarget).not.toHaveBeenCalled();
  });

  it("supports execution segment assignments with a target-aware payload", async () => {
    mocks.requireOperationalUser.mockResolvedValue(operatorActor);
    mocks.saveAssignmentsForTarget.mockResolvedValue([]);
    const { POST } = await import("../app/api/planning-assignments/route");

    const response = await POST(jsonRequest("http://local.test/api/planning-assignments", {
      target: { target_kind: "execution_segment", target_id: 456 },
      assignments: [],
    }));

    expect(response.status).toBe(200);
    expect(mocks.saveAssignmentsForTarget).toHaveBeenCalledWith({
      actor: operatorActor,
      target: { target_kind: "execution_segment", target_id: 456 },
      assignments: [],
    });
  });
});
