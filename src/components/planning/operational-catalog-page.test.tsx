import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalCatalogPage } from "./operational-catalog-page";

const authMock = vi.hoisted(() => ({
  role: "viewer" as "admin" | "operator" | "viewer",
}));

vi.mock("@/components/planning/catalog-admin-workspace", () => ({
  CatalogAdminWorkspace: () => null,
}));

vi.mock("@/components/planning/operational-header-admin-panel", () => ({
  OperationalHeaderAdminPanel: () => <section>Cabecera Operacional</section>,
}));

vi.mock("@/modules/planning-assignments/presentation/planning-assignments-admin-panel", () => ({
  PlanningAssignmentsAdminPanel: () => null,
}));

vi.mock("@/modules/planning/application/planning-reads.client", () => ({
  fetchPlanningCatalog: () => Promise.resolve({ categories: [], levels: [] }),
}));

vi.mock("@/modules/operational-header/application/operational-header.client", () => ({
  fetchOperationalHeaderConfig: () => Promise.resolve({ fields: [], dependencies: [] }),
}));

vi.mock("@/modules/planning/presentation/planning-page-transformers", () => ({
  syncDetailAdminForm: (form: unknown) => form,
}));

vi.mock("@/lib/networkStatus", () => ({
  isNetworkRequestError: () => false,
}));

vi.mock("@/lib/localOfflineStore", () => ({
  saveCatalogCache: () => Promise.resolve(),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    loading: false,
    session: { access_token: `${authMock.role}-token` },
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

vi.mock("@/modules/planning/presentation/use-planning-catalog-admin", () => ({
  usePlanningCatalogAdmin: () => {
    function noop() {}

    return {
      catalogBusy: false,
      catalogFormError: "",
      typeForm: { category: "actividad", label: "" },
      setTypeForm: noop,
      detailForm: { typeId: "", label: "" },
      setDetailForm: noop,
      editingType: null,
      setEditingType: noop,
      editingDetail: null,
      setEditingDetail: noop,
      handleCreateType: noop,
      handleCreateDetail: noop,
      handleUpdateType: noop,
      handleUpdateDetail: noop,
      handleDeleteType: noop,
      handleDeleteDetail: noop,
    };
  },
}));

describe("OperationalCatalogPage permissions", () => {
  beforeEach(() => {
    authMock.role = "viewer";
  });

  it("shows a restricted catalog fallback for viewer users", () => {
    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Acceso restringido");
    expect(html).toContain(
      "Puedes seguir usando la operación, pero la administración del catálogo está restringida a administradores."
    );
  });

  it("shows a restricted catalog fallback for operator users", () => {
    authMock.role = "operator";

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Acceso restringido");
    expect(html).toContain(
      "Puedes seguir usando la operación, pero la administración del catálogo está restringida a administradores."
    );
  });

  it("shows the operational header section entry for admin users", () => {
    authMock.role = "admin";

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("<button");
    expect(html).toMatch(/<button[^>]*>Cabecera Operacional<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Cabecera Operacional<\/button>/);
    expect(html.indexOf("Cabecera Operacional")).toBeLessThan(html.indexOf("Actividades"));
    expect(html).not.toContain("Niveles");
    expect(html).not.toContain("Campos configurables");
  });
});
