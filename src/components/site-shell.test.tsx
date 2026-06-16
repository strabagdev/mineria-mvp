import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteShell } from "./site-shell";

const authMock = vi.hoisted(() => ({
  role: "admin" as "admin" | "operator" | "viewer",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    loading: false,
    session: {
      access_token: "token",
      user: { id: `${authMock.role}-user`, email: `${authMock.role}@example.com` },
    },
    user: { id: `${authMock.role}-user`, email: `${authMock.role}@example.com` },
    profile: {
      user_id: `${authMock.role}-user`,
      email: `${authMock.role}@example.com`,
      full_name: authMock.role,
      role: authMock.role,
      active: true,
      approval_status: "approved",
    },
  }),
}));

vi.mock("@/lib/networkStatus", () => ({
  getNetworkStatusSnapshot: () => "online",
  isBrowserOffline: () => false,
  isNetworkRequestError: () => false,
  subscribeNetworkStatus: () => () => undefined,
}));

vi.mock("@/lib/observability/logger", () => ({
  recordOperationalEvent: vi.fn(),
}));

vi.mock("@/lib/operationalState", () => ({
  buildOperationalState: () => ({ tone: "ok", label: "Online" }),
}));

vi.mock("@/components/offline-route-content", () => ({
  OfflineRouteContent: () => null,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/modules/auth/application/auth-client", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/modules/planning/sync/planning-mutation-queue-store", () => ({
  loadPendingPlanningMutations: () => Promise.resolve([]),
}));

describe("SiteShell catalog navigation permissions", () => {
  beforeEach(() => {
    authMock.role = "admin";
  });

  it("shows Catalogo only for admin users", () => {
    authMock.role = "admin";

    const html = renderToStaticMarkup(<SiteShell><main>Contenido</main></SiteShell>);

    expect(html).toContain("Catalogo");
  });

  it("hides Catalogo for operator users", () => {
    authMock.role = "operator";

    const html = renderToStaticMarkup(<SiteShell><main>Contenido</main></SiteShell>);

    expect(html).not.toContain("Catalogo");
  });

  it("hides Catalogo for viewer users", () => {
    authMock.role = "viewer";

    const html = renderToStaticMarkup(<SiteShell><main>Contenido</main></SiteShell>);

    expect(html).not.toContain("Catalogo");
  });
});
