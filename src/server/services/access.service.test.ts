import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthSessionUser: vi.fn(),
  findProfileForAuthUser: vi.fn(),
  upsertAccessProfile: vi.fn(),
  upsertLegacyAuthProfile: vi.fn(),
  listUserPermissionRows: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/auth/auth-session", () => ({
  requireAuthSessionUser: mocks.requireAuthSessionUser,
}));

vi.mock("@/server/auth/contracts", () => ({
  getAuthenticatedUserDisplayName: (user: { user_metadata?: { full_name?: string | null }; email?: string | null }) =>
    user.user_metadata?.full_name ?? user.email ?? "",
}));

vi.mock("@/server/repositories/access.repository", () => ({
  findProfileForAuthUser: mocks.findProfileForAuthUser,
  upsertAccessProfile: mocks.upsertAccessProfile,
  upsertLegacyAuthProfile: mocks.upsertLegacyAuthProfile,
}));

vi.mock("@/server/repositories/user-permissions.repository", () => ({
  listUserPermissionRows: mocks.listUserPermissionRows,
}));

const authUser = {
  id: "user-1",
  email: "user@example.com",
  user_metadata: { full_name: "User One" },
};

function approvedProfile(role: "admin" | "operator" | "viewer") {
  return {
    user_id: authUser.id,
    email: authUser.email,
    full_name: "User One",
    role,
    active: true,
    approval_status: "approved",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

async function mockApprovedRole(role: "admin" | "operator" | "viewer") {
  mocks.requireAuthSessionUser.mockResolvedValue({ user: authUser, token: "token-1" });
  mocks.findProfileForAuthUser.mockResolvedValue(approvedProfile(role));
  mocks.upsertAccessProfile.mockImplementation((profile) => Promise.resolve(profile));
}

describe("access service roles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.listUserPermissionRows.mockResolvedValue([]);
    delete process.env.ADMIN_EMAIL;
  });

  it("resolves operator and falls back unknown roles to viewer", async () => {
    const { resolveRole, USER_ROLES } = await import("./access.service");

    expect(resolveRole("admin")).toBe(USER_ROLES.ADMIN);
    expect(resolveRole("operator")).toBe(USER_ROLES.OPERATOR);
    expect(resolveRole("viewer")).toBe(USER_ROLES.VIEWER);
    expect(resolveRole("unknown")).toBe(USER_ROLES.VIEWER);
  });

  it("allows admin users as operational users", async () => {
    await mockApprovedRole("admin");
    const { requireOperationalUser } = await import("./access.service");

    const auth = await requireOperationalUser(new Request("http://local.test"));

    expect(auth.profile.role).toBe("admin");
  });

  it("allows operator users as operational users", async () => {
    await mockApprovedRole("operator");
    const { requireOperationalUser } = await import("./access.service");

    const auth = await requireOperationalUser(new Request("http://local.test"));

    expect(auth.profile.role).toBe("operator");
  });

  it("blocks viewer users as operational users", async () => {
    await mockApprovedRole("viewer");
    const { requireOperationalUser } = await import("./access.service");

    await expect(requireOperationalUser(new Request("http://local.test"))).rejects.toThrow(
      "Necesitas permisos operativos."
    );
  });

  it("maps admin users to every current permission", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("admin");

    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(profile, permission)).toBe(true);
    }
  });

  it("keeps operator access to records, assignments and read-only catalog", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("operator");

    expect(hasPermission(profile, PERMISSIONS.RECORDS_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_CREATE)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_EDIT)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_DELETE)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.ASSIGNMENTS_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.ASSIGNMENTS_MANAGE)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.CATALOG_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.CATALOG_MANAGE)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.USERS_MANAGE)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.AUDIT_VIEW)).toBe(false);
  });

  it("allows user-specific permissions to add capabilities to operator users", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("operator");

    expect(hasPermission(profile, PERMISSIONS.CATALOG_MANAGE, [
      { permission: PERMISSIONS.CATALOG_MANAGE, effect: "allow" },
    ])).toBe(true);
  });

  it("lets user-specific deny overrides remove inherited operator permissions", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("operator");

    expect(hasPermission(profile, PERMISSIONS.RECORDS_VIEW, [
      { permission: PERMISSIONS.RECORDS_EDIT, effect: "deny" },
    ])).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_EDIT, [
      { permission: PERMISSIONS.RECORDS_EDIT, effect: "deny" },
    ])).toBe(false);
  });

  it("returns to role defaults when a user-specific override is removed", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("operator");

    expect(hasPermission(profile, PERMISSIONS.CATALOG_MANAGE, [
      { permission: PERMISSIONS.CATALOG_MANAGE, effect: "allow" },
    ])).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.CATALOG_MANAGE)).toBe(false);
  });

  it("keeps viewer users read-only", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("viewer");

    expect(hasPermission(profile, PERMISSIONS.RECORDS_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.CATALOG_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.REPORTS_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.OPERATIONAL_HEADER_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.ASSIGNMENTS_VIEW)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_CREATE)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_EDIT)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_DELETE)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.ASSIGNMENTS_MANAGE)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.CATALOG_MANAGE)).toBe(false);
  });

  it("requires explicit permissions while reusing approved-user validation", async () => {
    await mockApprovedRole("operator");
    const { PERMISSIONS, requirePermission } = await import("./access.service");

    await expect(requirePermission(new Request("http://local.test"), PERMISSIONS.RECORDS_CREATE))
      .resolves.toMatchObject({ profile: { role: "operator" } });
    await expect(requirePermission(new Request("http://local.test"), PERMISSIONS.USERS_MANAGE))
      .rejects.toThrow("Necesitas permisos para users.manage.");
  });

  it("uses user-specific allow overrides in requirePermission", async () => {
    await mockApprovedRole("operator");
    mocks.listUserPermissionRows.mockResolvedValue([
      { id: 1, user_id: "user-1", permission: "catalog.manage", effect: "allow" },
    ]);
    const { PERMISSIONS, requirePermission } = await import("./access.service");

    await expect(requirePermission(new Request("http://local.test"), PERMISSIONS.CATALOG_MANAGE))
      .resolves.toMatchObject({
        profile: { role: "operator" },
        permissions: expect.arrayContaining([PERMISSIONS.CATALOG_MANAGE]),
      });
  });

  it("includes effective permissions in synced profiles", async () => {
    await mockApprovedRole("viewer");
    mocks.listUserPermissionRows.mockResolvedValue([
      { id: 1, user_id: "user-1", permission: "records.create", effect: "allow" },
    ]);
    const { PERMISSIONS, syncProfileForAuthUser } = await import("./access.service");

    await expect(syncProfileForAuthUser(authUser)).resolves.toMatchObject({
      status: "approved",
      profile: {
        role: "viewer",
        effective_permissions: expect.arrayContaining([
          PERMISSIONS.RECORDS_VIEW,
          PERMISSIONS.RECORDS_CREATE,
        ]),
      },
    });
  });

  it("uses user-specific deny overrides in requirePermission", async () => {
    await mockApprovedRole("operator");
    mocks.listUserPermissionRows.mockResolvedValue([
      { id: 1, user_id: "user-1", permission: "records.edit", effect: "deny" },
    ]);
    const { PERMISSIONS, requirePermission } = await import("./access.service");

    await expect(requirePermission(new Request("http://local.test"), PERMISSIONS.RECORDS_VIEW))
      .resolves.toMatchObject({ profile: { role: "operator" } });
    await expect(requirePermission(new Request("http://local.test"), PERMISSIONS.RECORDS_EDIT))
      .rejects.toThrow("Necesitas permisos para records.edit.");
  });

  it("keeps admin permissions stable even when deny overrides exist", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("admin");

    expect(hasPermission(profile, PERMISSIONS.USERS_MANAGE, [
      { permission: PERMISSIONS.USERS_MANAGE, effect: "deny" },
    ])).toBe(true);
  });

  it("gives viewer users exactly the explicitly allowed extra capability", async () => {
    const { PERMISSIONS, hasPermission } = await import("./access.service");
    const profile = approvedProfile("viewer");
    const overrides = [{ permission: PERMISSIONS.CATALOG_MANAGE, effect: "allow" }] as const;

    expect(hasPermission(profile, PERMISSIONS.CATALOG_VIEW, overrides)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.CATALOG_MANAGE, overrides)).toBe(true);
    expect(hasPermission(profile, PERMISSIONS.USERS_MANAGE, overrides)).toBe(false);
    expect(hasPermission(profile, PERMISSIONS.RECORDS_CREATE, overrides)).toBe(false);
  });
});
