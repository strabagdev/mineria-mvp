import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  createBulkDependencySummary,
  getBulkDependencyCandidateOptionIds,
  isBulkDependencySameField,
  OperationalHeaderAdminPanel,
} from "./operational-header-admin-panel";
import type { OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";

vi.mock("@/modules/operational-header/application/operational-header.client", () => ({
  createOperationalHeaderDependency: vi.fn(),
  createOperationalHeaderField: vi.fn(),
  createOperationalHeaderOption: vi.fn(),
  deleteOperationalHeaderDependency: vi.fn(),
  deleteOperationalHeaderField: vi.fn(),
  deleteOperationalHeaderOption: vi.fn(),
  updateOperationalHeaderField: vi.fn(),
  updateOperationalHeaderOption: vi.fn(),
}));

const config: OperationalHeaderResponseDto = {
  fields: [
    {
      id: 1,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      required: true,
      active: true,
      sort_order: 10,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [
        {
          id: 10,
          field_id: 1,
          value: "nti",
          label: "NTI",
          active: true,
          sort_order: 10,
          metadata: {},
        },
      ],
    },
    {
      id: 2,
      slug: "frente",
      label: "Frente",
      input_type: "text",
      required: true,
      active: true,
      sort_order: 20,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [],
    },
  ],
  dependencies: [
    {
      id: 100,
      field_id: 1,
      option_id: 10,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    },
  ],
};

describe("OperationalHeaderAdminPanel", () => {
  it("renders operational header fields, options and dependencies", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={config}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("Nuevo campo");
    expect(html).toContain("Configuración del campo");
    expect(html).toContain("Opciones del campo");
    expect(html).toContain("Editar");
    expect(html).toContain("Eliminar");
    expect(html).toContain("Nueva opción");
    expect(html).toContain("Editar opcion");
    expect(html).toContain("Desactivar");
    expect(html).toContain("Eliminar opcion");
    expect(html).toContain("Nueva dependencia");
    expect(html).toContain("Acción masiva");
    expect(html).toContain("Crear dependencias");
    expect(html).toContain("Eliminar dependencia");
    expect(html).toContain("Nivel");
    expect(html).toContain("slug:");
    expect(html).toContain("nivel");
    expect(html).toContain("visible_in_gantt: Si");
    expect(html).toContain("NTI");
    expect(html).toContain("Este campo no usa opciones porque es de tipo texto.");
    expect(html).toContain("depende de");
  });

  it("renders an empty state when no fields exist", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={{ fields: [], dependencies: [] }}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Sin campos");
    expect(html).toContain("Aun no hay campos de cabecera operacional configurados.");
  });

  it("does not render dependency edit controls", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={config}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).not.toContain("Editar dependencia");
  });

  it("does not expose legacy_column compatibility metadata", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).not.toContain("compat DB");
    expect(source).not.toContain("Los valores históricos de Frente se conservarán como texto.");
    expect(source).not.toContain("form.legacy_column === \"front\" && form.input_type === \"text\"");
  });

  it("keeps Nivel and Frente editable like regular fields", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("slug: form.slug");
    expect(source).not.toContain("disabled={busy || isLegacy}");
    expect(source).not.toContain("readOnly={isLegacy}");
  });

  it("shows help for controlled text to select conversions", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("Los valores existentes se conservarán como texto. Los nuevos registros usarán opciones configuradas.");
    expect(source).toContain("editingField?.input_type === \"text\" && form.input_type === \"select\"");
  });

  it("omits existing dependencies from bulk dependency candidates", () => {
    const candidateIds = getBulkDependencyCandidateOptionIds({
      draft: {
        field_id: 2,
        option_ids: [20, 21, 22],
        depends_on_field_id: 1,
        depends_on_option_id: 10,
      },
      dependencies: [
        {
          id: 200,
          field_id: 2,
          option_id: 21,
          depends_on_field_id: 1,
          depends_on_option_id: 10,
        },
      ],
    });

    expect(candidateIds).toEqual([20, 22]);
  });

  it("blocks bulk dependencies when parent and dependent field are the same", () => {
    expect(isBulkDependencySameField({
      field_id: 2,
      option_ids: [20, 21],
      depends_on_field_id: 2,
      depends_on_option_id: 10,
    })).toBe(true);
  });

  it("summarizes bulk dependency results", () => {
    expect(createBulkDependencySummary({
      selectedCount: 3,
      candidateCount: 2,
      created: 1,
      blocked: 1,
    })).toEqual({
      created: 1,
      skipped: 1,
      blocked: 1,
    });
  });

  it("keeps the bulk dependency action in the existing admin permission path", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("await createOperationalHeaderDependency({");
    expect(source).toContain("}, accessToken)");
    expect(source).not.toContain("createOperationalHeaderDependenciesBatch");
  });
});
