import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import AdminUsersPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    loading: false,
    session: { access_token: "admin-token" },
    profile: {
      user_id: "admin-user",
      email: "admin@example.com",
      full_name: "Admin",
      role: "admin",
      active: true,
      approval_status: "approved",
    },
  }),
}));

vi.mock("@/modules/auth/presentation/role-options", () => ({
  USER_ROLE_OPTIONS: [
    { value: "admin", label: "Administrador" },
    { value: "operator", label: "Operativo" },
    { value: "viewer", label: "Visualizador" },
  ],
  toUserRole: (value: string) =>
    value === "admin" || value === "operator" || value === "viewer" ? value : "viewer",
}));

vi.mock("@/modules/auth/presentation/role-labels", () => ({
  toRoleLabel: (role: string) =>
    role === "admin" ? "Administrador" : role === "operator" ? "Operativo" : "Visualizador",
}));

vi.mock("@/lib/networkStatus", () => ({
  NETWORK_ERROR_MESSAGE: "Sin conexion.",
  assertBrowserOnline: vi.fn(),
  isBrowserOffline: () => false,
  subscribeNetworkStatus: () => () => undefined,
}));

vi.mock("@/lib/reportsOfflineSnapshot", () => ({
  canUseOfflineSnapshot: () => false,
  markSnapshotRefreshSucceeded: vi.fn(),
  readAdminUsersSnapshot: () => Promise.resolve(null),
  saveAdminUsersSnapshot: () => Promise.resolve(),
  toNetworkMessage: () => "",
}));

describe("AdminUsersPage access administration", () => {
  it("keeps roles out of the primary user administration UI", () => {
    const html = renderToStaticMarkup(<AdminUsersPage />);
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(html).not.toContain('<option value="admin">Administrador</option>');
    expect(html).not.toContain('<option value="operator" selected="">Operativo</option>');
    expect(html).not.toContain('<option value="viewer">Visualizador</option>');
    expect(source).not.toContain("USER_ROLE_OPTIONS");
    expect(source).not.toContain("toRoleLabel");
    expect(source).toContain("ROLE_ACCESS_SUMMARY");
    expect(source).not.toContain("Revisar accesos");
    expect(source).toContain("Administrar accesos");
  });

  it("uses the compact list, selected detail and access requests layout", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain('className="admin-users-page"');
    expect(source).not.toContain("dashboard-stack admin-users-page");
    expect(source).toContain("admin-users-toolbar");
    expect(source).toContain("admin-users-toolbar-copy");
    expect(source).not.toContain('<p className="eyebrow">Administracion</p>');
    expect(source).not.toContain("surface-card hero padded admin-users-hero");
    expect(source).toContain("admin-users-workspace");
    expect(source).toContain("admin-users-directory");
    expect(source).toContain("admin-user-compact-list");
    expect(source).toContain("admin-user-row");
    expect(source).toContain("selectedUserId");
    expect(source).toContain("setSelectedUserId(account.user_id)");
    expect(source).toContain("admin-user-detail-panel");
    expect(source).toContain("admin-access-requests");
    expect(source).toContain("admin-detail-section");
    expect(source).toContain("getEnabledAccessModules");
    expect(source).not.toContain("admin-detail-summary");
  });

  it("supports search and status filtering in the user list", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("searchTerm");
    expect(source).toContain("Nombre o correo");
    expect(source).toContain("statusFilter");
    expect(source).toContain('<option value="active">Activos</option>');
    expect(source).toContain('<option value="inactive">Inactivos</option>');
    expect(source).toContain('<option value="pending">Pendientes</option>');
    expect(source).toContain('<option value="rejected">Rechazados</option>');
  });

  it("moves create user into a compact modal flow", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("createModalOpen");
    expect(source).toContain("closeCreateModal");
    expect(source).toContain('aria-labelledby="create-user-title"');
    expect(source).toContain("setCreateModalOpen(true)");
    expect(source).toContain("setCreateModalOpen(false)");
    expect(source).toContain("createUser");
  });

  it("keeps pending access requests separated from the main user list", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("pendingUsers");
    expect(source).toContain("Solicitudes");
    expect(source).toContain("Acceso pendiente");
    expect(source).toContain("Solicitudes de acceso pendientes");
    expect(source).toContain("No hay solicitudes pendientes");
    expect(source).toContain("Aprobar");
  });

  it("keeps permanent deletion gated behind explicit eligibility and confirmation", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("selectedUser.deletion_eligible");
    expect(source).toContain("Eliminar definitivamente");
    expect(source).toContain("window.prompt");
    expect(source).toContain("Esta acción no se puede deshacer");
    expect(source).toContain('adminRequest("DELETE"');
  });

  it("integrates per-user access administration in the existing users page", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("Administrar accesos");
    expect(source).toContain("fetchUserPermissionSummary");
    expect(source).toContain("setUserPermissionOverride");
    expect(source).toContain("deleteUserPermissionOverride");
    expect(source).toContain("PERMISSION_MODULES");
    expect(source).toContain("getPermissionVisualState");
  });

  it("does not offer misleading permission controls for admin users", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain('selectedPermissionUser.role === "admin"');
    expect(source).toContain("Superadministrador");
    expect(source).toContain("Acceso total");
    expect(source).toContain("Este usuario tiene acceso total a la plataforma.");
  });

  it("opens and closes access administration as a modal", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain('aria-labelledby="access-admin-title"');
    expect(source).toContain("closePermissionsModal");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('onClick={closePermissionsModal}');
    expect(source).toContain("event.stopPropagation()");
  });

  it("keeps existing administrative account actions in the selected detail panel", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("Acciones administrativas del usuario");
    expect(source).toContain("Desactivar");
    expect(source).toContain("Reactivar");
    expect(source).toContain("Nueva contrasena");
    expect(source).toContain("passwordModalUser");
    expect(source).toContain("Actualizar contrasena");
    expect(source).toContain("Eliminar definitivamente");
  });

  it("defines responsive rules for the three-column administration layout", () => {
    const styles = readFileSync("src/app/globals.css", "utf8");

    expect(styles).toContain(".admin-users-page");
    expect(styles).toContain("grid-template-columns: 1fr");
    expect(styles).toContain("width: 100%");
    expect(styles).toContain(".admin-users-toolbar");
    expect(styles).toContain("min-height: 4.25rem");
    expect(styles).toContain(".admin-users-workspace");
    expect(styles).toContain("grid-template-columns: minmax(0, 42fr) minmax(0, 40fr) minmax(14rem, 18fr)");
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain(".admin-access-requests");
    expect(styles).toContain("grid-column: 1 / -1");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain(".admin-users-workspace");
    expect(styles).toContain("grid-template-columns: 1fr");
  });

  it("uses compact switches and batch save as the primary permission interaction", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain('role="switch"');
    expect(source).toContain("permissionDraft");
    expect(source).toContain("savePermissionChanges");
    expect(source).toContain("Guardar cambios");
    expect(source).toContain("Incluido en acceso base");
    expect(source).not.toContain("Volver a heredar");
  });

  it("updates the card summary after permission changes and avoids optimistic success on API errors", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("permissionSummaryByUser");
    expect(source).toContain("setPermissionSummaryByUser");
    expect(source).toContain("getAccessSummary(account)");
    expect(source).toContain("No se pudo guardar los cambios de accesos.");
    expect(source).toContain("Cambios de accesos guardados.");
  });

  it("checks users.manage before loading the administration page for non-admin profiles", () => {
    const source = readFileSync("src/app/(app)/admin/users/page.tsx", "utf8");

    expect(source).toContain("PERMISSIONS.USERS_MANAGE");
    expect(source).toContain("summary.effective_permissions.includes(PERMISSIONS.USERS_MANAGE)");
    expect(source).toContain("router.replace(\"/\")");
  });
});
