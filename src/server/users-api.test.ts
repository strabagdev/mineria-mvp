import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminUser: vi.fn(),
  createUser: vi.fn(),
  deleteUserPermanently: vi.fn(),
  listUsers: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUserAccess: vi.fn(),
}));

vi.mock("@/lib/accessControl", () => ({
  requireAdminUser: mocks.requireAdminUser,
  resolveRole: (value: string) =>
    value === "admin" || value === "operator" || value === "viewer" ? value : "viewer",
  USER_ROLES: {
    ADMIN: "admin",
    OPERATOR: "operator",
    VIEWER: "viewer",
  },
}));

vi.mock("@/lib/errorMessage", () => ({
  getErrorMessage: (error: unknown) => error instanceof Error ? error.message : "Unknown error",
  getErrorStatus: (error: unknown) =>
    error instanceof Error && /permisos de administrador/i.test(error.message) ? 403 : 500,
}));

vi.mock("@/server/services/users.service", () => ({
  createUser: mocks.createUser,
  deleteUserPermanently: mocks.deleteUserPermanently,
  listUsers: mocks.listUsers,
  resetUserPassword: mocks.resetUserPassword,
  updateUserAccess: mocks.updateUserAccess,
  USER_DELETE_BLOCKED_BY_ACTIVITY_MESSAGE:
    "Este usuario no puede eliminarse porque tiene actividad registrada. Puedes desactivar su acceso para conservar la trazabilidad.",
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

function jsonRequest(method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  return new Request("http://local.test/api/users", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("users API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireAdminUser.mockResolvedValue(adminActor);
    mocks.listUsers.mockResolvedValue({ users: [] });
  });

  it("passes the current user to list users so deletion eligibility can exclude self", async () => {
    const { GET } = await import("../app/api/users/route");

    const response = await GET(jsonRequest("GET"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ users: [] });
    expect(mocks.listUsers).toHaveBeenCalledWith({ currentUserId: "admin-1" });
  });

  it("deletes a user permanently when the service allows it", async () => {
    mocks.deleteUserPermanently.mockResolvedValue({ status: "deleted" });
    const { DELETE } = await import("../app/api/users/route");

    const response = await DELETE(jsonRequest("DELETE", { user_id: "user-1" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(mocks.deleteUserPermanently).toHaveBeenCalledWith({
      actor: adminActor,
      userId: "user-1",
    });
  });

  it("blocks deletion when the user has operational or audit activity", async () => {
    mocks.deleteUserPermanently.mockResolvedValue({
      status: "has-activity",
      references: {
        planningItems: 1,
        executionSegments: 0,
        auditLogs: 2,
      },
    });
    const { DELETE } = await import("../app/api/users/route");

    const response = await DELETE(jsonRequest("DELETE", { user_id: "user-1" }));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json).toEqual({
      error:
        "Este usuario no puede eliminarse porque tiene actividad registrada. Puedes desactivar su acceso para conservar la trazabilidad.",
      references: {
        planningItems: 1,
        executionSegments: 0,
        auditLogs: 2,
      },
    });
  });

  it("blocks self deletion and last admin deletion", async () => {
    const { DELETE } = await import("../app/api/users/route");

    mocks.deleteUserPermanently.mockResolvedValueOnce({ status: "self-delete-blocked" });
    await expect(DELETE(jsonRequest("DELETE", { user_id: "admin-1" })))
      .resolves.toHaveProperty("status", 400);

    mocks.deleteUserPermanently.mockResolvedValueOnce({ status: "last-admin-blocked" });
    const response = await DELETE(jsonRequest("DELETE", { user_id: "admin-2" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("ultimo administrador");
  });

  it("reports auth deletion failures without deleting through PATCH", async () => {
    mocks.deleteUserPermanently.mockResolvedValue({ status: "auth-error", error: new Error("auth") });
    const { DELETE } = await import("../app/api/users/route");

    const response = await DELETE(jsonRequest("DELETE", { user_id: "user-1" }));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toContain("Supabase Auth");
    expect(mocks.updateUserAccess).not.toHaveBeenCalled();
  });

  it("reports the administrable profile deletion failure after Auth was deleted", async () => {
    mocks.deleteUserPermanently.mockResolvedValue({
      status: "profile-delete-error",
      error: new Error("profile"),
    });
    const { DELETE } = await import("../app/api/users/route");

    const response = await DELETE(jsonRequest("DELETE", { user_id: "user-1" }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("perfil quedo inactivo");
  });

  it("does not allow operator or viewer users to delete users", async () => {
    mocks.requireAdminUser.mockRejectedValue(new Error("Necesitas permisos de administrador."));
    const { DELETE } = await import("../app/api/users/route");

    const response = await DELETE(jsonRequest("DELETE", { user_id: "user-1" }));

    expect(response.status).toBe(403);
    expect(mocks.deleteUserPermanently).not.toHaveBeenCalled();
  });
});
