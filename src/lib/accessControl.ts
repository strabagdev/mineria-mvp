import "server-only";

import type { User } from "@supabase/supabase-js";
import { requireAuthUser } from "@/lib/requireAuthUser";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const USER_ROLES = {
  ADMIN: "admin",
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

function isMissingAccessColumns(error: unknown) {
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

function getDisplayName(user: Pick<User, "email" | "user_metadata">) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name.trim()
        : "";

  return metadataName || user.email?.split("@")[0] || "Usuario";
}

export function resolveRole(value: string): UserRole {
  return value === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.VIEWER;
}

export function resolveApprovalStatus(value: string): ApprovalStatus {
  if (value === APPROVAL_STATUS.APPROVED || value === APPROVAL_STATUS.REJECTED) {
    return value;
  }

  return APPROVAL_STATUS.PENDING;
}

function normalizeProfile(row: AppProfile): AppProfile {
  return {
    ...row,
    role: resolveRole(row.role),
    active: row.active !== false,
    approval_status: resolveApprovalStatus(row.approval_status),
  };
}

export async function syncProfileForAuthUser(user: User): Promise<ProfileSyncResult> {
  const db = getSupabaseServerClient();
  const email = (user.email ?? "").trim().toLowerCase();

  if (!email) {
    throw new Error("Authenticated user does not have an email.");
  }

  const bootstrapAdminEmail = getBootstrapAdminEmail();
  const isBootstrapAdmin = bootstrapAdminEmail === email;
  const fullName = getDisplayName(user);
  const { data: existingProfile, error: existingError } = await db
    .from("profiles")
    .select("user_id, email, full_name, role, active, approval_status, created_at, updated_at")
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();

  if (existingError) {
    if (isMissingAccessColumns(existingError)) {
      const { error: legacyUpsertError } = await db.from("profiles").upsert(
        {
          user_id: user.id,
          email,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (legacyUpsertError) {
        throw legacyUpsertError;
      }

      const legacyProfile: AppProfile = {
        user_id: user.id,
        email,
        full_name: fullName,
        role: isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
        active: true,
        approval_status: isBootstrapAdmin
          ? APPROVAL_STATUS.APPROVED
          : APPROVAL_STATUS.PENDING,
      };

      if (!isBootstrapAdmin) {
        return { status: "pending", profile: legacyProfile };
      }

      return { status: "approved", profile: legacyProfile };
    }

    throw existingError;
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

  const { data: profile, error } = await db
    .from("profiles")
    .upsert(profilePayload, { onConflict: "user_id" })
    .select("user_id, email, full_name, role, active, approval_status, created_at, updated_at")
    .single();

  if (error) {
    if (isMissingAccessColumns(error)) {
      const legacyProfile: AppProfile = {
        user_id: user.id,
        email,
        full_name: fullName,
        role: isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
        active: true,
        approval_status: isBootstrapAdmin
          ? APPROVAL_STATUS.APPROVED
          : APPROVAL_STATUS.PENDING,
      };

      if (!isBootstrapAdmin) {
        return { status: "pending", profile: legacyProfile };
      }

      return { status: "approved", profile: legacyProfile };
    }

    throw error;
  }

  const normalizedProfile = normalizeProfile(profile);

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
  const { user, token } = await requireAuthUser(req);
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
