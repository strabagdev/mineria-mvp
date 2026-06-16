import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthSessionUser: vi.fn(),
  findProfileForAuthUser: vi.fn(),
  upsertAccessProfile: vi.fn(),
  upsertLegacyAuthProfile: vi.fn(),
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
});
