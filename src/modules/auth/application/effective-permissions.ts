import type { AppAuthProfile } from "./auth-types";
import type { Permission } from "../contracts/permissions";

export function hasEffectivePermission(
  profile: Pick<AppAuthProfile, "role" | "effective_permissions"> | null | undefined,
  permission: Permission
) {
  if (!profile) {
    return false;
  }

  if (profile.role === "admin") {
    return true;
  }

  return profile.effective_permissions?.includes(permission) ?? false;
}
