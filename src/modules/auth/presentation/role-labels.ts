import type { UserRole } from "@/modules/auth/application/auth-types";

export function toRoleLabel(role: UserRole) {
  if (role === "admin") {
    return "Administrador";
  }

  if (role === "operator") {
    return "Operativo";
  }

  return "Visualizador";
}
