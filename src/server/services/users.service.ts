import "server-only";

import { writeAuditLog } from "@/lib/auditLog";
import { createAuthUser, deleteAuthUser, updateAuthUserById } from "@/server/auth/auth-admin";
import {
  APPROVAL_STATUS,
  USER_ROLES,
  isMissingAccessColumns,
  resolveApprovalStatus,
  resolveRole,
} from "@/server/services/access.service";
import {
  countActiveApprovedAdmins,
  countAuditLogsByActor,
  countExecutionSegmentsCreatedBy,
  countPlanningItemsCreatedBy,
  deleteUserProfile,
  getUserProfile,
  insertLegacyUserProfile,
  insertUserProfile,
  listLegacyProfiles,
  listProfiles,
  updateUserProfile,
  type LegacyProfileRow,
  type ProfileRow,
} from "@/server/repositories/users.repository";

type AuditActor = Parameters<typeof writeAuditLog>[0]["actor"];

export const USER_DELETE_BLOCKED_BY_ACTIVITY_MESSAGE =
  "Este usuario no puede eliminarse porque tiene actividad registrada. Puedes desactivar su acceso para conservar la trazabilidad.";

export function legacyUser(row: LegacyProfileRow) {
  const bootstrapAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isBootstrapAdmin = row.email.trim().toLowerCase() === bootstrapAdminEmail;

  return {
    ...row,
    role: isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
    active: true,
    approval_status: isBootstrapAdmin ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.PENDING,
  };
}

async function withDeletionEligibility(
  profiles: ProfileRow[],
  currentUserId?: string | null
) {
  const activeApprovedAdmins = await countActiveApprovedAdmins();

  return Promise.all(profiles.map(async (profile) => {
    const [planningItems, executionSegments, auditLogs] = await Promise.all([
      countPlanningItemsCreatedBy(profile.user_id),
      countExecutionSegmentsCreatedBy(profile.user_id),
      countAuditLogsByActor(profile.user_id),
    ]);
    const hasActivity = planningItems > 0 || executionSegments > 0 || auditLogs > 0;
    const isSelf = currentUserId === profile.user_id;
    const isLastActiveApprovedAdmin =
      profile.role === USER_ROLES.ADMIN &&
      profile.active &&
      profile.approval_status === APPROVAL_STATUS.APPROVED &&
      activeApprovedAdmins <= 1;

    return {
      ...profile,
      deletion_eligible: !hasActivity && !isSelf && !isLastActiveApprovedAdmin,
    };
  }));
}

export async function listUsers(input: { currentUserId?: string | null } = {}) {
  try {
    return { users: await withDeletionEligibility(await listProfiles(), input.currentUserId) };
  } catch (error: unknown) {
    if (!isMissingAccessColumns(error)) {
      throw error;
    }

    const legacyProfiles = await listLegacyProfiles();
    return { users: legacyProfiles.map(legacyUser) };
  }
}

export async function createUser(input: {
  actor: AuditActor;
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const { data: createdAuthUser, error: authError } = await createAuthUser({
    email: input.email,
    password: input.password,
    name: input.name,
  });

  if (authError || !createdAuthUser.user) {
    return { status: "auth-error" as const };
  }

  try {
    const profileRow = await insertUserProfile({
      user_id: createdAuthUser.user.id,
      email: input.email,
      full_name: input.name,
      role: resolveRole(input.role),
      active: true,
      approval_status: APPROVAL_STATUS.APPROVED,
    });

    await writeAuditLog({
      actor: input.actor,
      action: "user.created",
      entityType: "profile",
      entityId: profileRow.user_id,
      after: profileRow,
      metadata: {
        created_email: input.email,
      },
    });

    return { status: "created" as const, user: profileRow };
  } catch (error: unknown) {
    if (isMissingAccessColumns(error)) {
      try {
        const legacyProfile = await insertLegacyUserProfile({
          user_id: createdAuthUser.user.id,
          email: input.email,
          full_name: input.name,
        });

        return { status: "created" as const, user: legacyUser(legacyProfile) };
      } catch (legacyError: unknown) {
        await deleteAuthUser(createdAuthUser.user.id).catch(() => undefined);
        throw legacyError;
      }
    }

    await deleteAuthUser(createdAuthUser.user.id).catch(() => undefined);
    throw error;
  }
}

export async function resetUserPassword(input: {
  actor: AuditActor;
  userId: string;
  password: string;
}) {
  const { error } = await updateAuthUserById(input.userId, {
    password: input.password,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  await writeAuditLog({
    actor: input.actor,
    action: "user.password_reset",
    entityType: "profile",
    entityId: input.userId,
    metadata: {
      target_user_id: input.userId,
    },
  });
}

export async function updateUserAccess(input: {
  actor: AuditActor;
  userId: string;
  action: "update-role" | "toggle-active" | "update-approval-status";
  role?: string;
  active?: boolean;
  approvalStatus?: string;
}) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.action === "update-role") {
    updates.role = resolveRole(String(input.role ?? USER_ROLES.VIEWER));
  } else if (input.action === "toggle-active") {
    updates.active = Boolean(input.active);
  } else {
    updates.approval_status = resolveApprovalStatus(
      String(input.approvalStatus ?? APPROVAL_STATUS.PENDING)
    );
  }

  const beforeData = await getUserProfile(input.userId);
  let profileRow: ProfileRow;

  try {
    profileRow = await updateUserProfile(input.userId, updates);
  } catch (error: unknown) {
    if (isMissingAccessColumns(error)) {
      return { status: "missing-access-columns" as const };
    }

    throw error;
  }

  await writeAuditLog({
    actor: input.actor,
    action:
      input.action === "update-role"
        ? "user.role_updated"
        : input.action === "toggle-active"
          ? "user.active_toggled"
          : "user.approval_status_updated",
    entityType: "profile",
    entityId: profileRow.user_id,
    before: beforeData,
    after: profileRow,
  });

  return { status: "updated" as const, user: profileRow };
}

export async function getUserDeletionEligibility(userId: string) {
  const profile = await getUserProfile(userId);

  if (!profile) {
    return {
      eligible: false as const,
      profile: null,
      reason: "not-found" as const,
      references: {
        planningItems: 0,
        executionSegments: 0,
        auditLogs: 0,
      },
    };
  }

  const [planningItems, executionSegments, auditLogs] = await Promise.all([
    countPlanningItemsCreatedBy(userId),
    countExecutionSegmentsCreatedBy(userId),
    countAuditLogsByActor(userId),
  ]);
  const hasActivity = planningItems > 0 || executionSegments > 0 || auditLogs > 0;

  return {
    eligible: !hasActivity,
    profile,
    reason: hasActivity ? "has-activity" as const : null,
    references: {
      planningItems,
      executionSegments,
      auditLogs,
    },
  };
}

export async function deleteUserPermanently(input: {
  actor: AuditActor;
  userId: string;
}) {
  const actorUserId = input.actor?.profile?.user_id ?? input.actor?.user?.id ?? null;

  if (input.userId === actorUserId) {
    return { status: "self-delete-blocked" as const };
  }

  const eligibility = await getUserDeletionEligibility(input.userId);

  if (!eligibility.profile) {
    return { status: "not-found" as const };
  }

  if (!eligibility.eligible) {
    return {
      status: "has-activity" as const,
      references: eligibility.references,
    };
  }

  if (
    eligibility.profile.role === USER_ROLES.ADMIN &&
    eligibility.profile.active &&
    eligibility.profile.approval_status === APPROVAL_STATUS.APPROVED
  ) {
    const activeApprovedAdmins = await countActiveApprovedAdmins();

    if (activeApprovedAdmins <= 1) {
      return { status: "last-admin-blocked" as const };
    }
  }

  const { error: authError } = await deleteAuthUser(input.userId);

  if (authError) {
    return { status: "auth-error" as const, error: authError };
  }

  try {
    await deleteUserProfile(input.userId);
  } catch (error: unknown) {
    try {
      await updateUserProfile(input.userId, {
        active: false,
        approval_status: APPROVAL_STATUS.REJECTED,
        updated_at: new Date().toISOString(),
      });
    } catch (deactivationError: unknown) {
      console.error("User profile deactivation failed after auth deletion", {
        user_id: input.userId,
        error: deactivationError instanceof Error ? deactivationError.message : String(deactivationError),
      });
    }

    console.error("User profile deletion failed after auth deletion", {
      user_id: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return { status: "profile-delete-error" as const, error };
  }

  console.info("User permanently deleted", {
    user_id: input.userId,
    actor_user_id: actorUserId,
  });

  return { status: "deleted" as const };
}
