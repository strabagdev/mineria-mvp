import "server-only";

import { writeAuditLog } from "@/lib/auditLog";
import {
  getEffectivePermissionsForProfile,
  getPermissionsForRole,
  resolvePermission,
  resolveRole,
  type Permission,
  type UserPermissionOverride,
} from "./access.service";
import {
  deleteUserPermissionRow,
  getUserPermissionRow,
  listUserPermissionRows,
  upsertUserPermissionRow,
  type UserPermissionEffect,
  type UserPermissionRow,
} from "@/server/repositories/user-permissions.repository";
import { getUserProfile } from "@/server/repositories/users.repository";

type AuditActor = Parameters<typeof writeAuditLog>[0]["actor"];

function toPermissionOverride(row: UserPermissionRow): UserPermissionOverride | null {
  const permission = resolvePermission(row.permission);
  if (!permission) {
    return null;
  }

  return { permission, effect: row.effect };
}

function toPermissionOverrides(rows: UserPermissionRow[]) {
  return rows.flatMap((row) => {
    const override = toPermissionOverride(row);
    return override ? [override] : [];
  });
}

export function resolvePermissionOrThrow(value: string): Permission {
  const permission = resolvePermission(value);
  if (!permission) {
    throw Object.assign(new Error("Permiso no soportado."), { status: 400 });
  }

  return permission;
}

export function resolvePermissionEffectOrThrow(value: string): UserPermissionEffect {
  if (value === "allow" || value === "deny") {
    return value;
  }

  throw Object.assign(new Error("El efecto del permiso debe ser allow o deny."), { status: 400 });
}

async function getProfileOrThrow(userId: string) {
  const profile = await getUserProfile(userId);
  if (!profile) {
    throw Object.assign(new Error("Usuario no encontrado."), { status: 404 });
  }

  return {
    ...profile,
    role: resolveRole(profile.role),
  };
}

export async function getUserPermissionSummary(userId: string) {
  const [profile, rows] = await Promise.all([
    getProfileOrThrow(userId),
    listUserPermissionRows(userId),
  ]);
  const overrides = toPermissionOverrides(rows);

  return {
    user_id: profile.user_id,
    role: profile.role,
    base_permissions: getPermissionsForRole(profile.role),
    overrides,
    effective_permissions: getEffectivePermissionsForProfile(profile, overrides),
  };
}

export async function setUserPermissionOverride(input: {
  actor: AuditActor;
  userId: string;
  permission: Permission;
  effect: UserPermissionEffect;
}) {
  await getProfileOrThrow(input.userId);
  const before = await getUserPermissionRow({
    userId: input.userId,
    permission: input.permission,
  });
  const override = await upsertUserPermissionRow({
    userId: input.userId,
    permission: input.permission,
    effect: input.effect,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "user_permission.override_set",
    entityType: "user_permission",
    entityId: override.id,
    before,
    after: override,
    metadata: {
      target_user_id: input.userId,
      permission: input.permission,
      effect: input.effect,
    },
  });

  return getUserPermissionSummary(input.userId);
}

export async function deleteUserPermissionOverride(input: {
  actor: AuditActor;
  userId: string;
  permission: Permission;
}) {
  await getProfileOrThrow(input.userId);
  const before = await getUserPermissionRow({
    userId: input.userId,
    permission: input.permission,
  });

  await deleteUserPermissionRow({
    userId: input.userId,
    permission: input.permission,
  });

  await writeAuditLog({
    actor: input.actor,
    action: "user_permission.override_deleted",
    entityType: "user_permission",
    entityId: before?.id ?? `${input.userId}:${input.permission}`,
    before,
    metadata: {
      target_user_id: input.userId,
      permission: input.permission,
    },
  });

  return getUserPermissionSummary(input.userId);
}
