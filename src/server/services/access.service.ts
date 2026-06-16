import "server-only";

import type { AuthenticatedUser } from "@/server/auth/contracts";
import { getAuthenticatedUserDisplayName } from "@/server/auth/contracts";
import { requireAuthSessionUser } from "@/server/auth/auth-session";
import {
  findProfileForAuthUser,
  upsertAccessProfile,
  upsertLegacyAuthProfile,
  type AccessProfileRow,
} from "@/server/repositories/access.repository";

export const USER_ROLES = {
  ADMIN: "admin",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const;

export const APPROVAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type ApprovalStatus = (typeof APPROVAL_STATUS)[keyof typeof APPROVAL_STATUS];

export type AppProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  approval_status: ApprovalStatus;
  created_at?: string;
  updated_at?: string;
};

export type ProfileSyncResult =
  | { status: "approved"; profile: AppProfile }
  | { status: "pending"; profile: AppProfile }
  | { status: "rejected"; profile: AppProfile }
  | { status: "inactive"; profile: AppProfile };

function getBootstrapAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || "";
}

export function isMissingAccessColumns(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : String(error ?? "");

  return (
    message.includes("role") ||
    message.includes("active") ||
    message.includes("approval_status") ||
    message.includes("schema cache")
  );
}

export function resolveRole(value: string): UserRole {
  if (value === USER_ROLES.ADMIN || value === USER_ROLES.OPERATOR || value === USER_ROLES.VIEWER) {
    return value;
  }

  return USER_ROLES.VIEWER;
}

export function resolveApprovalStatus(value: string): ApprovalStatus {
  if (value === APPROVAL_STATUS.APPROVED || value === APPROVAL_STATUS.REJECTED) {
    return value;
  }

  return APPROVAL_STATUS.PENDING;
}

function normalizeProfile(row: AccessProfileRow): AppProfile {
  return {
    ...row,
    role: resolveRole(row.role),
    active: row.active !== false,
    approval_status: resolveApprovalStatus(row.approval_status),
  };
}

function legacyProfileForAuthUser(input: {
  user: AuthenticatedUser;
  email: string;
  fullName: string;
  isBootstrapAdmin: boolean;
}): AppProfile {
  return {
    user_id: input.user.id,
    email: input.email,
    full_name: input.fullName,
    role: input.isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
    active: true,
    approval_status: input.isBootstrapAdmin
      ? APPROVAL_STATUS.APPROVED
      : APPROVAL_STATUS.PENDING,
  };
}

export async function syncProfileForAuthUser(user: AuthenticatedUser): Promise<ProfileSyncResult> {
  const email = (user.email ?? "").trim().toLowerCase();

  if (!email) {
    throw new Error("Authenticated user does not have an email.");
  }

  const bootstrapAdminEmail = getBootstrapAdminEmail();
  const isBootstrapAdmin = bootstrapAdminEmail === email;
  const fullName = getAuthenticatedUserDisplayName(user);
  let existingProfile: AccessProfileRow | null = null;

  try {
    existingProfile = await findProfileForAuthUser({ userId: user.id, email });
  } catch (error: unknown) {
    if (isMissingAccessColumns(error)) {
      await upsertLegacyAuthProfile({
        user_id: user.id,
        email,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      });

      const legacyProfile = legacyProfileForAuthUser({
        user,
        email,
        fullName,
        isBootstrapAdmin,
      });

      if (!isBootstrapAdmin) {
        return { status: "pending", profile: legacyProfile };
      }

      return { status: "approved", profile: legacyProfile };
    }

    throw error;
  }

  const profilePayload = {
    user_id: user.id,
    email,
    full_name: existingProfile?.full_name ?? fullName,
    role: isBootstrapAdmin
      ? USER_ROLES.ADMIN
      : existingProfile?.role ?? USER_ROLES.VIEWER,
    active: isBootstrapAdmin ? true : existingProfile?.active ?? true,
    approval_status:
      isBootstrapAdmin
        ? APPROVAL_STATUS.APPROVED
        : existingProfile?.approval_status ?? APPROVAL_STATUS.PENDING,
    updated_at: new Date().toISOString(),
  };

  let normalizedProfile: AppProfile;

  try {
    normalizedProfile = normalizeProfile(await upsertAccessProfile(profilePayload));
  } catch (error: unknown) {
    if (isMissingAccessColumns(error)) {
      const legacyProfile = legacyProfileForAuthUser({
        user,
        email,
        fullName,
        isBootstrapAdmin,
      });

      if (!isBootstrapAdmin) {
        return { status: "pending", profile: legacyProfile };
      }

      return { status: "approved", profile: legacyProfile };
    }

    throw error;
  }

  if (!normalizedProfile.active) {
    return { status: "inactive", profile: normalizedProfile };
  }

  if (normalizedProfile.approval_status === APPROVAL_STATUS.REJECTED) {
    return { status: "rejected", profile: normalizedProfile };
  }

  if (normalizedProfile.approval_status !== APPROVAL_STATUS.APPROVED) {
    return { status: "pending", profile: normalizedProfile };
  }

  return { status: "approved", profile: normalizedProfile };
}

export async function requireApprovedUser(req: Request) {
  const { user, token } = await requireAuthSessionUser(req);
  const syncResult = await syncProfileForAuthUser(user);

  if (syncResult.status !== "approved") {
    const messages = {
      pending: "Tu solicitud aun no ha sido aprobada.",
      rejected: "Tu solicitud fue rechazada.",
      inactive: "Tu cuenta esta inactiva.",
    } satisfies Record<Exclude<ProfileSyncResult["status"], "approved">, string>;

    throw new Error(messages[syncResult.status]);
  }

  return { user, token, profile: syncResult.profile };
}

export async function requireAdminUser(req: Request) {
  const auth = await requireApprovedUser(req);

  if (auth.profile.role !== USER_ROLES.ADMIN) {
    throw new Error("Necesitas permisos de administrador.");
  }

  return auth;
}

export async function requireOperationalUser(req: Request) {
  const auth = await requireApprovedUser(req);

  if (auth.profile.role !== USER_ROLES.ADMIN && auth.profile.role !== USER_ROLES.OPERATOR) {
    throw new Error("Necesitas permisos operativos.");
  }

  return auth;
}
