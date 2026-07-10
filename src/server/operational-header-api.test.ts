import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOperationalHeaderDependencyDefinition: vi.fn(),
  createOperationalHeaderFieldDefinition: vi.fn(),
  createOperationalHeaderOptionDefinition: vi.fn(),
  deleteOperationalHeaderDependencyDefinition: vi.fn(),
  deleteUnusedOperationalHeaderFieldDefinition: vi.fn(),
  deleteUnusedOperationalHeaderOptionDefinition: vi.fn(),
  getOperationalHeaderConfig: vi.fn(),
  requireAdminUser: vi.fn(),
  requireApprovedUser: vi.fn(),
  updateOperationalHeaderFieldDefinition: vi.fn(),
  updateOperationalHeaderOptionDefinition: vi.fn(),
}));

vi.mock("@/lib/accessControl", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireApprovedUser: mocks.requireApprovedUser,
}));

vi.mock("@/lib/errorMessage", () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Unknown error",
  getErrorStatus: (error: unknown) => {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;

    if (status && status >= 400 && status <= 599) {
      return status;
    }

    return error instanceof Error && /permisos de administrador/i.test(error.message) ? 403 : 500;
  },
}));

vi.mock("@/modules/operational-header/contracts/operational-header", () => ({
  isOperationalHeaderInputType: (value: string) => value === "text" || value === "select",
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

function jsonRequest(method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown, url = "http://local.test/api/operational-header") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("operational header API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireApprovedUser.mockResolvedValue({ user: { id: "user-1" } });
    mocks.requireAdminUser.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getOperationalHeaderConfig.mockResolvedValue({ fields: [], dependencies: [] });
  });

  it("keeps GET available to approved users", async () => {
    const { GET } = await import("../app/api/operational-header/route");

    const response = await GET(jsonRequest("GET", undefined, "http://local.test/api/operational-header?active=false"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ fields: [], dependencies: [] });
    expect(mocks.requireApprovedUser).toHaveBeenCalled();
    expect(mocks.getOperationalHeaderConfig).toHaveBeenCalledWith({ activeOnly: false });
  });

  it("lets admin users create fields", async () => {
    mocks.createOperationalHeaderFieldDefinition.mockResolvedValue({ id: 10, slug: "area", label: "Area", options: [] });
    const { POST } = await import("../app/api/operational-header/route");

    const response = await POST(jsonRequest("POST", {
      slug: "area",
      label: "Area",
      input_type: "text",
      active: true,
      sort_order: 30,
    }));

    expect(response.status).toBe(201);
    expect(mocks.requireAdminUser).toHaveBeenCalled();
    expect(mocks.createOperationalHeaderFieldDefinition).toHaveBeenCalledWith(expect.objectContaining({
      slug: "area",
      label: "Area",
      inputType: "text",
      active: true,
      sortOrder: 30,
    }));
  });

  it("lets admin users edit fields", async () => {
    mocks.updateOperationalHeaderFieldDefinition.mockResolvedValue({ id: 10, slug: "area", label: "Area Mina", options: [] });
    const { PATCH } = await import("../app/api/operational-header/route");

    const response = await PATCH(jsonRequest("PATCH", {
      id: 10,
      label: "Area Mina",
      groupable: true,
    }));

    expect(response.status).toBe(200);
    expect(mocks.requireAdminUser).toHaveBeenCalled();
    expect(mocks.updateOperationalHeaderFieldDefinition).toHaveBeenCalledWith({
      id: 10,
      updates: {
        label: "Area Mina",
        groupable: true,
      },
    });
  });

  it("lets admin users delete unused fields", async () => {
    mocks.deleteUnusedOperationalHeaderFieldDefinition.mockResolvedValue({
      deleted: true,
      reason: null,
      valueCount: 0,
      optionCount: 0,
    });
    const { DELETE } = await import("../app/api/operational-header/route");

    const response = await DELETE(jsonRequest("DELETE", { id: 10 }));

    expect(response.status).toBe(200);
    expect(mocks.requireAdminUser).toHaveBeenCalled();
    expect(mocks.deleteUnusedOperationalHeaderFieldDefinition).toHaveBeenCalledWith({ id: 10 });
  });

  it("blocks delete when fields have values or options", async () => {
    mocks.deleteUnusedOperationalHeaderFieldDefinition.mockResolvedValue({
      deleted: false,
      reason: "options",
      valueCount: 0,
      optionCount: 2,
    });
    const { DELETE } = await import("../app/api/operational-header/route");

    const response = await DELETE(jsonRequest("DELETE", { id: 10 }));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("No se puede eliminar este campo");
  });

  it("does not allow viewer/operator users to mutate fields", async () => {
    mocks.requireAdminUser.mockRejectedValue(new Error("Necesitas permisos de administrador."));
    const { POST, PATCH, DELETE } = await import("../app/api/operational-header/route");

    await expect(POST(jsonRequest("POST", { label: "Area", input_type: "text" })))
      .resolves.toHaveProperty("status", 403);
    await expect(PATCH(jsonRequest("PATCH", { id: 1, label: "Area" })))
      .resolves.toHaveProperty("status", 403);
    await expect(DELETE(jsonRequest("DELETE", { id: 1 })))
      .resolves.toHaveProperty("status", 403);
    await expect(POST(jsonRequest("POST", { entity: "option", field_id: 1, value: "nti", label: "NTI" })))
      .resolves.toHaveProperty("status", 403);
    await expect(PATCH(jsonRequest("PATCH", { entity: "option", id: 10, active: false })))
      .resolves.toHaveProperty("status", 403);
    await expect(DELETE(jsonRequest("DELETE", { entity: "option", id: 10 })))
      .resolves.toHaveProperty("status", 403);
    await expect(POST(jsonRequest("POST", {
      entity: "dependency",
      field_id: 2,
      option_id: 20,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    }))).resolves.toHaveProperty("status", 403);
    await expect(DELETE(jsonRequest("DELETE", { entity: "dependency", id: 10 })))
      .resolves.toHaveProperty("status", 403);
    expect(mocks.createOperationalHeaderFieldDefinition).not.toHaveBeenCalled();
    expect(mocks.updateOperationalHeaderFieldDefinition).not.toHaveBeenCalled();
    expect(mocks.deleteUnusedOperationalHeaderFieldDefinition).not.toHaveBeenCalled();
    expect(mocks.createOperationalHeaderOptionDefinition).not.toHaveBeenCalled();
    expect(mocks.updateOperationalHeaderOptionDefinition).not.toHaveBeenCalled();
    expect(mocks.deleteUnusedOperationalHeaderOptionDefinition).not.toHaveBeenCalled();
    expect(mocks.createOperationalHeaderDependencyDefinition).not.toHaveBeenCalled();
    expect(mocks.deleteOperationalHeaderDependencyDefinition).not.toHaveBeenCalled();
  });

  it("lets admin users create options", async () => {
    mocks.createOperationalHeaderOptionDefinition.mockResolvedValue({ id: 20, field_id: 1, value: "nti", label: "NTI" });
    const { POST } = await import("../app/api/operational-header/route");

    const response = await POST(jsonRequest("POST", {
      entity: "option",
      field_id: 1,
      value: "NTI",
      label: "NTI",
      active: true,
      sort_order: 10,
      metadata: { color: "blue" },
    }));

    expect(response.status).toBe(201);
    expect(mocks.createOperationalHeaderOptionDefinition).toHaveBeenCalledWith({
      fieldId: 1,
      value: "nti",
      label: "NTI",
      active: true,
      sortOrder: 10,
      metadata: { color: "blue" },
    });
  });

  it("lets admin users edit and deactivate options", async () => {
    mocks.updateOperationalHeaderOptionDefinition.mockResolvedValue({ id: 20, field_id: 1, active: false });
    const { PATCH } = await import("../app/api/operational-header/route");

    const response = await PATCH(jsonRequest("PATCH", {
      entity: "option",
      id: 20,
      label: "NTI actualizado",
      active: false,
    }));

    expect(response.status).toBe(200);
    expect(mocks.updateOperationalHeaderOptionDefinition).toHaveBeenCalledWith({
      id: 20,
      updates: {
        label: "NTI actualizado",
        active: false,
      },
    });
  });

  it("lets admin users delete unused options", async () => {
    mocks.deleteUnusedOperationalHeaderOptionDefinition.mockResolvedValue({
      deleted: true,
      reason: null,
      usageCount: 0,
    });
    const { DELETE } = await import("../app/api/operational-header/route");

    const response = await DELETE(jsonRequest("DELETE", { entity: "option", id: 20 }));

    expect(response.status).toBe(200);
    expect(mocks.deleteUnusedOperationalHeaderOptionDefinition).toHaveBeenCalledWith({ id: 20 });
  });

  it("blocks deleting used options", async () => {
    mocks.deleteUnusedOperationalHeaderOptionDefinition.mockResolvedValue({
      deleted: false,
      reason: "used",
      usageCount: 2,
    });
    const { DELETE } = await import("../app/api/operational-header/route");

    const response = await DELETE(jsonRequest("DELETE", { entity: "option", id: 20 }));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("No se puede eliminar esta opcion");
  });

  it("blocks invalid option metadata", async () => {
    const { POST } = await import("../app/api/operational-header/route");

    const response = await POST(jsonRequest("POST", {
      entity: "option",
      field_id: 1,
      value: "nti",
      label: "NTI",
      metadata: "not-json-object",
    }));

    expect(response.status).toBe(400);
    expect(mocks.createOperationalHeaderOptionDefinition).not.toHaveBeenCalled();
  });

  it("lets admin users create dependencies", async () => {
    mocks.createOperationalHeaderDependencyDefinition.mockResolvedValue({
      id: 300,
      field_id: 2,
      option_id: 20,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    });
    const { POST } = await import("../app/api/operational-header/route");

    const response = await POST(jsonRequest("POST", {
      entity: "dependency",
      field_id: 2,
      option_id: 20,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    }));

    expect(response.status).toBe(201);
    expect(mocks.createOperationalHeaderDependencyDefinition).toHaveBeenCalledWith({
      fieldId: 2,
      optionId: 20,
      dependsOnFieldId: 1,
      dependsOnOptionId: 10,
    });
  });

  it("lets admin users delete dependencies", async () => {
    mocks.deleteOperationalHeaderDependencyDefinition.mockResolvedValue({ deleted: true });
    const { DELETE } = await import("../app/api/operational-header/route");

    const response = await DELETE(jsonRequest("DELETE", { entity: "dependency", id: 300 }));

    expect(response.status).toBe(200);
    expect(mocks.deleteOperationalHeaderDependencyDefinition).toHaveBeenCalledWith({ id: 300 });
  });
});
