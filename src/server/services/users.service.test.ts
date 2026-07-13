import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
  createAuthUser: vi.fn(),
  deleteAuthUser: vi.fn(),
  updateAuthUserById: vi.fn(),
  countActiveApprovedAdmins: vi.fn(),
  countAuditLogsByActor: vi.fn(),
  countExecutionSegmentsCreatedBy: vi.fn(),
  countPlanningItemsCreatedBy: vi.fn(),
  deleteUserProfile: vi.fn(),
  getUserProfile: vi.fn(),
  insertLegacyUserProfile: vi.fn(),
  insertUserProfile: vi.fn(),
  listLegacyProfiles: vi.fn(),
  listProfiles: vi.fn(),
  updateUserProfile: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auditLog", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/server/auth/auth-admin", () => ({
  createAuthUser: mocks.createAuthUser,
  deleteAuthUser: mocks.deleteAuthUser,
  updateAuthUserById: mocks.updateAuthUserById,
}));

vi.mock("@/server/services/access.service", () => ({
  APPROVAL_STATUS: {
    APPROVED: "approved",
    PENDING: "pending",
    REJECTED: "rejected",
  },
  USER_ROLES: {
    ADMIN: "admin",
    OPERATOR: "operator",
    VIEWER: "viewer",
  },
  isMissingAccessColumns: () => false,
  resolveApprovalStatus: (value: string) =>
    value === "approved" || value === "rejected" || value === "pending" ? value : "pending",
  resolveRole: (value: string) =>
    value === "admin" || value === "operator" || value === "viewer" ? value : "viewer",
}));

vi.mock("@/server/repositories/users.repository", () => ({
  countActiveApprovedAdmins: mocks.countActiveApprovedAdmins,
  countAuditLogsByActor: mocks.countAuditLogsByActor,
  countExecutionSegmentsCreatedBy: mocks.countExecutionSegmentsCreatedBy,
  countPlanningItemsCreatedBy: mocks.countPlanningItemsCreatedBy,
  deleteUserProfile: mocks.deleteUserProfile,
  getUserProfile: mocks.getUserProfile,
  insertLegacyUserProfile: mocks.insertLegacyUserProfile,
  insertUserProfile: mocks.insertUserProfile,
  listLegacyProfiles: mocks.listLegacyProfiles,
  listProfiles: mocks.listProfiles,
  updateUserProfile: mocks.updateUserProfile,
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

const targetProfile = {
  user_id: "user-1",
  email: "user@example.com",
  full_name: "User",
  role: "viewer",
  active: true,
  approval_status: "approved",
} as const;

describe("users service permanent deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.countActiveApprovedAdmins.mockResolvedValue(2);
    mocks.countPlanningItemsCreatedBy.mockResolvedValue(0);
    mocks.countExecutionSegmentsCreatedBy.mockResolvedValue(0);
    mocks.countAuditLogsByActor.mockResolvedValue(0);
    mocks.getUserProfile.mockResolvedValue(targetProfile);
    mocks.deleteAuthUser.mockResolvedValue({ error: null });
    mocks.deleteUserProfile.mockResolvedValue(undefined);
  });

  it("deletes auth identity and profile when the user has no activity", async () => {
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result).toEqual({ status: "deleted" });
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("user-1");
    expect(mocks.deleteUserProfile).toHaveBeenCalledWith("user-1");
  });

  it("blocks deletion when planning items reference the user", async () => {
    mocks.countPlanningItemsCreatedBy.mockResolvedValue(1);
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result).toEqual({
      status: "has-activity",
      references: {
        planningItems: 1,
        executionSegments: 0,
        auditLogs: 0,
      },
    });
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
    expect(mocks.deleteUserProfile).not.toHaveBeenCalled();
  });

  it("blocks deletion when execution segments reference the user", async () => {
    mocks.countExecutionSegmentsCreatedBy.mockResolvedValue(2);
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result.status).toBe("has-activity");
    expect(result).toMatchObject({
      references: {
        planningItems: 0,
        executionSegments: 2,
        auditLogs: 0,
      },
    });
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("blocks deletion when audit logs reference the user", async () => {
    mocks.countAuditLogsByActor.mockResolvedValue(3);
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result.status).toBe("has-activity");
    expect(result).toMatchObject({
      references: {
        planningItems: 0,
        executionSegments: 0,
        auditLogs: 3,
      },
    });
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("blocks self deletion", async () => {
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "admin-1",
    });

    expect(result).toEqual({ status: "self-delete-blocked" });
    expect(mocks.getUserProfile).not.toHaveBeenCalled();
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("blocks deleting the last active approved admin", async () => {
    mocks.getUserProfile.mockResolvedValue({
      ...targetProfile,
      role: "admin",
      active: true,
      approval_status: "approved",
    });
    mocks.countActiveApprovedAdmins.mockResolvedValue(1);
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result).toEqual({ status: "last-admin-blocked" });
    expect(mocks.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("returns an auth error without deleting the profile", async () => {
    const authError = new Error("auth failed");
    mocks.deleteAuthUser.mockResolvedValue({ error: authError });
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result).toEqual({ status: "auth-error", error: authError });
    expect(mocks.deleteUserProfile).not.toHaveBeenCalled();
  });

  it("deactivates the profile when profile deletion fails after auth deletion", async () => {
    const profileError = new Error("profile failed");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.deleteUserProfile.mockRejectedValue(profileError);
    mocks.updateUserProfile.mockResolvedValue({ ...targetProfile, active: false, approval_status: "rejected" });
    const { deleteUserPermanently } = await import("./users.service");

    const result = await deleteUserPermanently({
      actor: adminActor,
      userId: "user-1",
    });

    expect(result).toEqual({ status: "profile-delete-error", error: profileError });
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith("user-1");
    expect(mocks.updateUserProfile).toHaveBeenCalledWith("user-1", expect.objectContaining({
      active: false,
      approval_status: "rejected",
    }));
    errorSpy.mockRestore();
  });

  it("marks only users without activity, self or last-admin risk as deletion eligible", async () => {
    mocks.listProfiles.mockResolvedValue([
      { ...adminActor.profile },
      { ...targetProfile },
      { ...targetProfile, user_id: "busy-1", email: "busy@example.com" },
    ]);
    mocks.countActiveApprovedAdmins.mockResolvedValue(1);
    mocks.countPlanningItemsCreatedBy.mockImplementation((userId: string) =>
      Promise.resolve(userId === "busy-1" ? 1 : 0)
    );
    mocks.countExecutionSegmentsCreatedBy.mockResolvedValue(0);
    mocks.countAuditLogsByActor.mockResolvedValue(0);
    const { listUsers } = await import("./users.service");

    const result = await listUsers({ currentUserId: "admin-1" });

    expect(result.users).toEqual([
      expect.objectContaining({ user_id: "admin-1", deletion_eligible: false }),
      expect.objectContaining({ user_id: "user-1", deletion_eligible: true }),
      expect.objectContaining({ user_id: "busy-1", deletion_eligible: false }),
    ]);
  });
});
