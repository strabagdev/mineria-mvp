import { renderToStaticMarkup } from "react-dom/server";
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

describe("AdminUsersPage role select", () => {
  it("shows admin, operator and viewer role options", () => {
    const html = renderToStaticMarkup(<AdminUsersPage />);

    expect(html).toContain('<option value="admin">Administrador</option>');
    expect(html).toContain('<option value="operator" selected="">Operativo</option>');
    expect(html).toContain('<option value="viewer">Visualizador</option>');
  });
});
