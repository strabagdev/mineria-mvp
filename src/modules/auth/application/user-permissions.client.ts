import { assertBrowserOnline } from "@/lib/networkStatus";
import type { Permission, UserPermissionEffect } from "../contracts/permissions";

export type UserPermissionOverrideDto = {
  permission: Permission;
  effect: UserPermissionEffect;
};

export type UserPermissionSummaryDto = {
  user_id: string;
  role: "admin" | "operator" | "viewer";
  base_permissions: Permission[];
  overrides: UserPermissionOverrideDto[];
  effective_permissions: Permission[];
};

export type PermissionOverrideControlValue = "inherit" | UserPermissionEffect;

export type PermissionVisualState = {
  controlValue: PermissionOverrideControlValue;
  inherited: boolean;
  effective: boolean;
  override: UserPermissionEffect | null;
  label: string;
};

async function requestUserPermissions<T>(
  path: string,
  input: RequestInit & { accessToken?: string } = {}
) {
  assertBrowserOnline();

  if (!input.accessToken) {
    throw new Error("Necesitas iniciar sesion para administrar permisos.");
  }

  const response = await fetch(path, {
    ...input,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      ...input.headers,
    },
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String((json as { error?: unknown }).error ?? "No se pudo actualizar permisos."));
  }

  return json as T;
}

export function getPermissionVisualState(
  summary: UserPermissionSummaryDto,
  permission: Permission
): PermissionVisualState {
  const override = summary.overrides.find((item) => item.permission === permission)?.effect ?? null;
  const inherited = summary.base_permissions.includes(permission);
  const effective = summary.effective_permissions.includes(permission);

  if (summary.role === "admin") {
    return {
      controlValue: "inherit",
      inherited: true,
      effective: true,
      override,
      label: override === "deny" ? "Total por admin; deny sin efecto" : "Total por admin",
    };
  }

  if (override === "allow") {
    return {
      controlValue: "allow",
      inherited,
      effective: true,
      override,
      label: "Permitido manualmente",
    };
  }

  if (override === "deny") {
    return {
      controlValue: "deny",
      inherited,
      effective: false,
      override,
      label: "Denegado manualmente",
    };
  }

  return {
    controlValue: "inherit",
    inherited,
    effective,
    override,
    label: inherited ? "Heredado del rol" : "No disponible por rol",
  };
}

export async function fetchUserPermissionSummary(userId: string, accessToken?: string) {
  const params = new URLSearchParams({ user_id: userId });
  return requestUserPermissions<UserPermissionSummaryDto>(`/api/users/permissions?${params}`, {
    accessToken,
  });
}

export async function setUserPermissionOverride(input: {
  userId: string;
  permission: Permission;
  effect: UserPermissionEffect;
  accessToken?: string;
}) {
  return requestUserPermissions<UserPermissionSummaryDto>("/api/users/permissions", {
    method: "POST",
    body: JSON.stringify({
      user_id: input.userId,
      permission: input.permission,
      effect: input.effect,
    }),
    accessToken: input.accessToken,
  });
}

export async function deleteUserPermissionOverride(input: {
  userId: string;
  permission: Permission;
  accessToken?: string;
}) {
  return requestUserPermissions<UserPermissionSummaryDto>("/api/users/permissions", {
    method: "DELETE",
    body: JSON.stringify({
      user_id: input.userId,
      permission: input.permission,
    }),
    accessToken: input.accessToken,
  });
}
