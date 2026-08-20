import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalCatalogPage } from "./operational-catalog-page";

const authMock = vi.hoisted(() => ({
  role: "viewer" as "admin" | "operator" | "viewer",
  effectivePermissions: [] as string[],
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
      effective_permissions: authMock.effectivePermissions,
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
    authMock.effectivePermissions = [];
  });

  it("shows a restricted catalog fallback for viewer users", () => {
    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Acceso restringido");
    expect(html).toContain(
      "Puedes seguir usando la operación, pero no tienes permisos para ver o administrar el catalogo."
    );
  });

  it("shows a restricted catalog fallback for operator users", () => {
    authMock.role = "operator";

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Acceso restringido");
    expect(html).toContain(
      "Puedes seguir usando la operación, pero no tienes permisos para ver o administrar el catalogo."
    );
  });

  it("keeps catalog data read users out of the visual catalog page", () => {
    authMock.role = "viewer";
    authMock.effectivePermissions = ["catalog.data.read", "operational_header.data.read"];

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Acceso restringido");
    expect(html).not.toContain("Actividades");
    expect(html).not.toContain("Cabecera Operacional");
  });

  it("shows the operational header section entry when a viewer has operational_header.manage", () => {
    authMock.role = "viewer";
    authMock.effectivePermissions = ["operational_header.manage"];

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("<button");
    expect(html).toMatch(/<button[^>]*>Cabecera Operacional<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Cabecera Operacional<\/button>/);
    expect(html).not.toContain("Actividades");
    expect(html).not.toContain("Niveles");
    expect(html).not.toContain("Campos configurables");
  });

  it("shows the operational header read view when a viewer has operational_header.view", () => {
    authMock.role = "viewer";
    authMock.effectivePermissions = ["operational_header.view"];

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("Configuración operacional");
    expect(html).not.toContain("Acceso restringido");
    expect(html).not.toContain("Actividades");
  });

  it("shows catalog administration when a viewer has catalog.manage", () => {
    authMock.role = "viewer";
    authMock.effectivePermissions = ["catalog.manage"];

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Actividades");
    expect(html).not.toContain("Acceso restringido");
  });

  it("shows the activities section when a viewer has catalog.view", () => {
    authMock.role = "viewer";
    authMock.effectivePermissions = ["catalog.view"];

    const html = renderToStaticMarkup(<OperationalCatalogPage />);

    expect(html).toContain("Actividades");
    expect(html).not.toContain("Acceso restringido");
  });
});
