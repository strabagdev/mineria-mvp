import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogAdminWorkspace } from "./catalog-admin-workspace";

vi.mock("@/components/planning/delete-confirmation-dialog", () => ({
  DeleteConfirmationDialog: () => <section>Confirmar eliminacion</section>,
}));

const catalog = [
  {
    slug: "actividad" as const,
    label: "Actividad",
    types: [
      {
        id: 1,
        slug: "perforacion",
        label: "Perforacion",
        details: [{ id: 10, label: "Avance" }],
      },
    ],
  },
  {
    slug: "interferencia" as const,
    label: "Interferencia",
    types: [],
  },
];

const noop = vi.fn();

function renderWorkspace() {
  return renderToStaticMarkup(
    <CatalogAdminWorkspace
      catalog={catalog}
      catalogLoading={false}
      catalogBusy={false}
      catalogFormError=""
      typeForm={{ category: "actividad", label: "" }}
      setTypeForm={noop}
      detailForm={{ category: "actividad", typeId: "1", label: "" }}
      setDetailForm={noop}
      editingType={null}
      setEditingType={noop}
      editingDetail={null}
      setEditingDetail={noop}
      syncDetailAdminForm={(form) => form}
      onCreateType={noop}
      onCreateDetail={noop}
      onUpdateType={noop}
      onUpdateDetail={noop}
      onDeleteType={noop}
      onDeleteDetail={noop}
    />
  );
}

describe("CatalogAdminWorkspace", () => {
  it("does not render the legacy planning levels administration", () => {
    const html = renderWorkspace();

    expect(html).toContain("Nuevo tipo");
    expect(html).toContain("Nuevo detalle");
    expect(html).not.toContain("Nuevo nivel");
    expect(html).not.toContain("Agregar nivel");
    expect(html).not.toContain("Lista administrable");
    expect(html).not.toContain("niveles");
  });
});
