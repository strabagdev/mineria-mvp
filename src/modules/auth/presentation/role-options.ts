import type { UserRole } from "@/modules/auth/application/auth-types";
import { toRoleLabel } from "./role-labels";

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: toRoleLabel("admin") },
  { value: "operator", label: toRoleLabel("operator") },
  { value: "viewer", label: toRoleLabel("viewer") },
];

export function toUserRole(value: string): UserRole {
  if (value === "admin" || value === "operator" || value === "viewer") {
    return value;
  }

  return "viewer";
}
