import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getUserPermissionSummary: vi.fn(),
  setUserPermissionOverride: vi.fn(),
  deleteUserPermissionOverride: vi.fn(),
}));

const TEST_PERMISSIONS = {
  RECORDS_VIEW: "records.view",
  RECORDS_CREATE: "records.create",
  RECORDS_EDIT: "records.edit",
  RECORDS_DELETE: "records.delete",
  CATALOG_DATA_READ: "catalog.data.read",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  REPORTS_VIEW: "reports.view",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  AUDIT_VIEW: "audit.view",
  OPERATIONAL_HEADER_DATA_READ: "operational_header.data.read",
  OPERATIONAL_HEADER_VIEW: "operational_header.view",
  OPERATIONAL_HEADER_MANAGE: "operational_header.manage",
  ASSIGNMENTS_VIEW: "assignments.view",
  ASSIGNMENTS_MANAGE: "assignments.manage",
} as const;

vi.mock("server-only", () => ({}));

vi.mock("@/lib/accessControl", () => ({
  PERMISSIONS: TEST_PERMISSIONS,
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/errorMessage", () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Unknown error",
  getErrorStatus: (error: unknown) => {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
    if (status && status >= 400 && status <= 599) return status;
    return error instanceof Error && /permisos para/i.test(error.message) ? 403 : 500;
  },
}));

vi.mock("@/server/services/user-permissions.service", () => ({
  getUserPermissionSummary: mocks.getUserPermissionSummary,
  setUserPermissionOverride: mocks.setUserPermissionOverride,
  deleteUserPermissionOverride: mocks.deleteUserPermissionOverride,
  resolvePermissionOrThrow: (value: string) => {
    if ((Object.values(TEST_PERMISSIONS) as string[]).includes(value)) {
      return value;
    }

    throw Object.assign(new Error("Permiso no soportado."), { status: 400 });
  },
  resolvePermissionEffectOrThrow: (value: string) => {
    if (value === "allow" || value === "deny") {
      return value;
    }

    throw Object.assign(new Error("El efecto del permiso debe ser allow o deny."), { status: 400 });
  },
}));

const adminActor = {
  user: { id: "admin-1", email: "admin@example.com" },
  profile: {
    user_id: "admin-1",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin",
    active: true,
    approval_status: "approved",
  },
} as const;

function jsonRequest(method: "GET" | "POST" | "DELETE", body?: unknown, url = "http://local.test/api/users/permissions") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("user permissions API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requirePermission.mockResolvedValue(adminActor);
    mocks.getUserPermissionSummary.mockResolvedValue({
      user_id: "user-1",
      role: "operator",
      base_permissions: ["records.view"],
      overrides: [],
      effective_permissions: ["records.view"],
    });
    mocks.setUserPermissionOverride.mockResolvedValue({
      user_id: "user-1",
      role: "operator",
      base_permissions: ["records.view"],
      overrides: [{ permission: "catalog.manage", effect: "allow" }],
      effective_permissions: ["records.view", "catalog.manage"],
    });
    mocks.deleteUserPermissionOverride.mockResolvedValue({
      user_id: "user-1",
      role: "operator",
      base_permissions: ["records.view"],
      overrides: [],
      effective_permissions: ["records.view"],
    });
  });

  it("requires users.manage to consult user permission summaries", async () => {
    const { GET } = await import("../app/api/users/permissions/route");

    const response = await GET(jsonRequest("GET", undefined, "http://local.test/api/users/permissions?user_id=user-1"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      user_id: "user-1",
      role: "operator",
      overrides: [],
    });
    expect(json.effective_permissions).toContain("records.view");
    expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Request), "users.manage");
  });

  it("does not let users without users.manage modify overrides", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Necesitas permisos para users.manage."));
    const { POST } = await import("../app/api/users/permissions/route");

    const response = await POST(jsonRequest("POST", {
      user_id: "user-1",
      permission: "catalog.manage",
      effect: "allow",
    }));

    expect(response.status).toBe(403);
    expect(mocks.setUserPermissionOverride).not.toHaveBeenCalled();
  });

  it("does not let users with only users.view manage permission summaries or overrides", async () => {
    mocks.requirePermission.mockImplementation(async (_req: Request, permission: string) => {
      if (permission === "users.manage") {
        throw new Error("Necesitas permisos para users.manage.");
      }

      return adminActor;
    });
    const { GET, POST, DELETE } = await import("../app/api/users/permissions/route");

    const getResponse = await GET(jsonRequest("GET", undefined, "http://local.test/api/users/permissions?user_id=user-1"));
    const postResponse = await POST(jsonRequest("POST", {
      user_id: "user-1",
      permission: "catalog.manage",
      effect: "allow",
    }));
    const deleteResponse = await DELETE(jsonRequest("DELETE", {
      user_id: "user-1",
      permission: "catalog.manage",
    }));

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
    expect(deleteResponse.status).toBe(403);
    expect(mocks.getUserPermissionSummary).not.toHaveBeenCalled();
    expect(mocks.setUserPermissionOverride).not.toHaveBeenCalled();
    expect(mocks.deleteUserPermissionOverride).not.toHaveBeenCalled();
  });

  it("sets allow and deny overrides for known permissions", async () => {
    const { POST } = await import("../app/api/users/permissions/route");

    const allowResponse = await POST(jsonRequest("POST", {
      user_id: "user-1",
      permission: "catalog.manage",
      effect: "allow",
    }));
    const denyResponse = await POST(jsonRequest("POST", {
      user_id: "user-1",
      permission: "records.edit",
      effect: "deny",
    }));

    expect(allowResponse.status).toBe(200);
    expect(denyResponse.status).toBe(200);
    expect(mocks.setUserPermissionOverride).toHaveBeenNthCalledWith(1, {
      actor: adminActor,
      userId: "user-1",
      permission: "catalog.manage",
      effect: "allow",
    });
    expect(mocks.setUserPermissionOverride).toHaveBeenNthCalledWith(2, {
      actor: adminActor,
      userId: "user-1",
      permission: "records.edit",
      effect: "deny",
    });
  });

  it("rejects unknown permissions and invalid effects", async () => {
    const { POST } = await import("../app/api/users/permissions/route");

    const unknownPermissionResponse = await POST(jsonRequest("POST", {
      user_id: "user-1",
      permission: "admin.everything",
      effect: "allow",
    }));
    const invalidEffectResponse = await POST(jsonRequest("POST", {
      user_id: "user-1",
      permission: "catalog.manage",
      effect: "maybe",
    }));

    expect(unknownPermissionResponse.status).toBe(400);
    expect(invalidEffectResponse.status).toBe(400);
    expect(mocks.setUserPermissionOverride).not.toHaveBeenCalled();
  });

  it("deletes overrides so the user inherits from the role again", async () => {
    const { DELETE } = await import("../app/api/users/permissions/route");

    const response = await DELETE(jsonRequest("DELETE", {
      user_id: "user-1",
      permission: "catalog.manage",
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.overrides).toEqual([]);
    expect(json.effective_permissions).not.toContain("catalog.manage");
    expect(mocks.deleteUserPermissionOverride).toHaveBeenCalledWith({
      actor: adminActor,
      userId: "user-1",
      permission: "catalog.manage",
    });
  });
});
