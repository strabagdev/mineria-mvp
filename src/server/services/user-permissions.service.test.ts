import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
  getUserProfile: vi.fn(),
  listUserPermissionRows: vi.fn(),
  getUserPermissionRow: vi.fn(),
  upsertUserPermissionRow: vi.fn(),
  deleteUserPermissionRow: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auditLog", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/server/repositories/users.repository", () => ({
  getUserProfile: mocks.getUserProfile,
}));

vi.mock("@/server/repositories/user-permissions.repository", () => ({
  listUserPermissionRows: mocks.listUserPermissionRows,
  getUserPermissionRow: mocks.getUserPermissionRow,
  upsertUserPermissionRow: mocks.upsertUserPermissionRow,
  deleteUserPermissionRow: mocks.deleteUserPermissionRow,
}));

vi.mock("./access.service", () => ({
  getPermissionsForRole: (role: string) =>
    role === "operator"
      ? ["records.view", "records.create", "records.edit", "records.delete", "catalog.view"]
      : ["records.view"],
  getEffectivePermissionsForProfile: (
    profile: { role: string },
    overrides: Array<{ permission: string; effect: "allow" | "deny" }>
  ) => {
    const permissions = new Set(
      profile.role === "operator"
        ? ["records.view", "records.create", "records.edit", "records.delete", "catalog.view"]
        : ["records.view"]
    );
    for (const override of overrides) {
      if (override.effect === "allow") permissions.add(override.permission);
      if (override.effect === "deny") permissions.delete(override.permission);
    }
    return [...permissions];
  },
  resolvePermission: (value: string) =>
    [
      "records.view",
      "records.create",
      "records.edit",
      "records.delete",
      "catalog.view",
      "catalog.manage",
    ].includes(value)
      ? value
      : null,
  resolveRole: (role: string) => role,
}));

const actor = {
  user: { id: "admin-1", email: "admin@example.com" },
  profile: { user_id: "admin-1", email: "admin@example.com" },
};

const operatorProfile = {
  user_id: "user-1",
  email: "operator@example.com",
  full_name: "Operator",
  role: "operator",
  active: true,
  approval_status: "approved",
};

describe("user permissions service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUserProfile.mockResolvedValue(operatorProfile);
    mocks.listUserPermissionRows.mockResolvedValue([]);
    mocks.getUserPermissionRow.mockResolvedValue(null);
  });

  it("returns base and effective permissions with stored overrides", async () => {
    mocks.listUserPermissionRows.mockResolvedValue([
      { id: 1, user_id: "user-1", permission: "catalog.manage", effect: "allow" },
    ]);
    const { getUserPermissionSummary } = await import("./user-permissions.service");

    const summary = await getUserPermissionSummary("user-1");

    expect(summary.role).toBe("operator");
    expect(summary.base_permissions).toContain("records.create");
    expect(summary.overrides).toEqual([{ permission: "catalog.manage", effect: "allow" }]);
    expect(summary.effective_permissions).toContain("catalog.manage");
  });

  it("audits allow and deny override changes", async () => {
    mocks.upsertUserPermissionRow.mockResolvedValue({
      id: 10,
      user_id: "user-1",
      permission: "records.edit",
      effect: "deny",
    });
    const { setUserPermissionOverride } = await import("./user-permissions.service");

    await setUserPermissionOverride({
      actor,
      userId: "user-1",
      permission: "records.edit",
      effect: "deny",
    });

    expect(mocks.upsertUserPermissionRow).toHaveBeenCalledWith({
      userId: "user-1",
      permission: "records.edit",
      effect: "deny",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor,
      action: "user_permission.override_set",
      entityType: "user_permission",
      entityId: 10,
      metadata: expect.objectContaining({
        target_user_id: "user-1",
        permission: "records.edit",
        effect: "deny",
      }),
    }));
  });

  it("audits override deletion and falls back to inherited role permissions", async () => {
    mocks.getUserPermissionRow.mockResolvedValue({
      id: 10,
      user_id: "user-1",
      permission: "catalog.manage",
      effect: "allow",
    });
    const { deleteUserPermissionOverride } = await import("./user-permissions.service");

    const summary = await deleteUserPermissionOverride({
      actor,
      userId: "user-1",
      permission: "catalog.manage",
    });

    expect(mocks.deleteUserPermissionRow).toHaveBeenCalledWith({
      userId: "user-1",
      permission: "catalog.manage",
    });
    expect(summary.effective_permissions).not.toContain("catalog.manage");
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actor,
      action: "user_permission.override_deleted",
      entityType: "user_permission",
      entityId: 10,
    }));
  });
});
