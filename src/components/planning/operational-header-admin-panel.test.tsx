import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  buildOperationalHeaderDependencyMatrix,
  createBulkDependencySummary,
  getAllOperationalHeaderOptionIds,
  getBulkDependencyCandidateOptionIds,
  getInitialOperationalHeaderFieldId,
  getNextOperationalHeaderFieldIdAfterDelete,
  getOperationalHeaderBehaviorWarnings,
  getOperationalHeaderOptionSelection,
  getOperationalHeaderDependenciesForField,
  getOperationalHeaderDependencyParentFieldIds,
  isBulkDependencySameField,
  OperationalHeaderAdminPanel,
  parseOptionalOperationalHeaderOrder,
  resolveOperationalHeaderGroupingOrder,
  sortOperationalHeaderOptions,
  sortOperationalHeaderFields,
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
      grouping_order: null,
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
        {
          id: 11,
          field_id: 1,
          value: "nnm",
          label: "NNM",
          active: false,
          sort_order: 20,
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
      grouping_order: null,
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
    expect(html).toContain("Campos");
    expect(html).toContain("Campo seleccionado");
    expect(html).toContain("Nuevo campo");
    expect(html).toContain("Configuración operacional");
    expect(html).toContain("Configuración");
    expect(html).toContain("Opciones");
    expect(html).toContain("2 opciones · 1 activas");
    expect(html).toContain("Editar");
    expect(html).toContain("Eliminar");
    expect(html).toContain("Nueva opción");
    expect(html).toContain("Editar opción");
    expect(html).toContain("Desactivar");
    expect(html).toContain("Eliminar opción");
    expect(html).toContain("Asignar a opción padre");
    expect(html).toContain("Asignar opciones");
    expect(html).not.toContain("Sugerir padre");
    expect(html).toContain("Campo padre");
    expect(html).toContain("1 permitidas");
    expect(html).toContain("Nivel");
    expect(html).toContain("Configura este campo, sus opciones y sus dependencias en un solo lugar.");
    expect(html).toContain("nivel");
    expect(html).toContain("Identidad");
    expect(html).toContain("Captura");
    expect(html).toContain("Gantt");
    expect(html).toContain("Reportes");
    expect(html).toContain("Orden visual");
    expect(html).toContain("Orden de agrupación");
    expect(html).toContain("Si queda vacío, se utilizará el orden visual.");
    expect(html).toContain("Visible en Gantt");
    expect(html).toContain("Participa en captura, Gantt y reportes.");
    expect(html).toContain("Obligatorio durante la captura mientras esté activo.");
    expect(html).toContain("Disponible como filtro en reportes.");
    expect(html).toContain("Visible en tabla, CSV y Excel.");
    expect(html).toContain("NTI");
    expect(html).toContain("NNM");
    expect(html).toContain("Seleccionar todas");
    expect(html).toContain("Limpiar selección");
    expect(html).toContain("0 seleccionadas");
    expect(html).toContain("Depende de Nivel. Ajusta las relaciones en la matriz.");
    expect(html).toContain("1 relaciones");
    expect(html).toContain("operational-header-dependency-matrix");
    expect(html).toContain("operational-header-master-detail");
    expect(html).toContain("operational-header-master-item active");
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
    expect(html).toContain("Crea el primer campo para identificar, filtrar y agrupar eventos desde Cabecera Operacional.");
    expect(html).toContain("Crear primer campo");
  });

  it("renders a text field without option controls", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={{ fields: [config.fields[1]], dependencies: [] }}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Los campos de texto reciben valores escritos directamente en el formulario operacional.");
    expect(html).toContain("No hay matriz de dependencias porque este campo acepta texto libre.");
    expect(html).not.toContain("Nueva opción");
  });

  it("renders a clear empty state for select fields without options", () => {
    const emptySelectConfig: OperationalHeaderResponseDto = {
      fields: [{ ...config.fields[0], options: [] }],
      dependencies: [],
    };
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={emptySelectConfig}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Crea opciones para que este campo pueda seleccionarse y participar en dependencias.");
    expect(html).toContain("Crear primera opción");
  });

  it("warns when a required field is inactive", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={{ fields: [{ ...config.fields[0], active: false }], dependencies: [] }}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Mientras este campo esté inactivo, no será obligatorio en la captura.");
  });

  it("summarizes cross-runtime behavior warnings without blocking save", () => {
    expect(getOperationalHeaderBehaviorWarnings({
      form: {
        active: false,
        required: true,
        input_type: "select",
        groupable: true,
        filterable: true,
        visible_in_gantt: false,
        exportable: true,
        grouping_order: "5",
      },
      activeOptionCount: 0,
      requiredParentOptionsWithoutChildren: 2,
    })).toEqual([
      "Mientras este campo esté inactivo, no será obligatorio en la captura.",
      "Mientras este campo esté inactivo, no aparecerá en tabla, CSV ni Excel.",
      "Este campo puede generar breakdowns si es exportable, pero no agrupará Gantt mientras no sea visible en Gantt.",
      "El orden de agrupación configurado no tendrá efecto hasta que el campo sea agrupable y visible en Gantt.",
      "Algunas opciones del campo padre dejan este campo obligatorio sin alternativas disponibles: 2 opciones padre presentan el problema.",
    ]);

    expect(getOperationalHeaderBehaviorWarnings({
      form: {
        active: true,
        required: false,
        input_type: "text",
        groupable: false,
        filterable: true,
        visible_in_gantt: true,
        exportable: false,
        grouping_order: "",
      },
      activeOptionCount: 0,
      requiredParentOptionsWithoutChildren: 0,
    })).toEqual([
      "Visible en Gantt no tendrá efecto hasta que el campo sea agrupable.",
      "Se podrá filtrar por este campo en reportes, pero no aparecerá como columna ni se exportará.",
    ]);
  });

  it("explains grouping order has no effect when the field is hidden from Gantt", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={{ fields: [{ ...config.fields[0], visible_in_gantt: false }], dependencies: [] }}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("No tendrá efecto mientras el campo no sea visible en Gantt.");
  });

  it("warns when a required select has no active options", () => {
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={{ fields: [{ ...config.fields[0], options: [] }], dependencies: [] }}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Este campo es obligatorio, pero no tiene opciones activas disponibles.");
  });

  it("warns when parent options leave a required dependent field without alternatives", () => {
    const dependentConfig: OperationalHeaderResponseDto = {
      fields: [
        {
          ...config.fields[0],
          sort_order: 10,
          options: config.fields[0].options.map((option) => ({ ...option, active: true })),
        },
        {
          ...config.fields[1],
          input_type: "select",
          required: true,
          sort_order: 5,
          options: [
            { id: 20, field_id: 2, value: "frente_1", label: "Frente 1", active: true, sort_order: 10, metadata: {} },
          ],
        },
      ],
      dependencies: [
        {
          id: 200,
          field_id: 2,
          option_id: 20,
          depends_on_field_id: 1,
          depends_on_option_id: 10,
        },
      ],
    };
    const html = renderToStaticMarkup(
      <OperationalHeaderAdminPanel
        accessToken="token"
        config={dependentConfig}
        loading={false}
        error=""
        onRefresh={() => undefined}
      />
    );

    expect(html).toContain("Algunas opciones del campo padre dejan este campo obligatorio sin alternativas disponibles");
  });

  it("selects the first field ordered by sort order and label", () => {
    const fields = [
      { ...config.fields[1], sort_order: 20 },
      { ...config.fields[0], sort_order: 10 },
    ];

    expect(sortOperationalHeaderFields(fields).map((field) => field.id)).toEqual([1, 2]);
    expect(getInitialOperationalHeaderFieldId(fields)).toBe(1);
  });

  it("parses optional ordering and falls back grouping order to visual order", () => {
    expect(parseOptionalOperationalHeaderOrder("")).toBeNull();
    expect(parseOptionalOperationalHeaderOrder("  ")).toBeNull();
    expect(parseOptionalOperationalHeaderOrder("7.8")).toBe(7);
    expect(resolveOperationalHeaderGroupingOrder({ grouping_order: null, sort_order: 20 })).toBe(20);
    expect(resolveOperationalHeaderGroupingOrder({ grouping_order: 5, sort_order: 20 })).toBe(5);
  });

  it("selects another field after deleting the active one", () => {
    expect(getNextOperationalHeaderFieldIdAfterDelete(config.fields, 1)).toBe(2);
    expect(getNextOperationalHeaderFieldIdAfterDelete([config.fields[0]], 1)).toBeNull();
  });

  it("orders options and builds multi-selection state", () => {
    const options = [
      { ...config.fields[0].options[1], sort_order: 20 },
      { ...config.fields[0].options[0], sort_order: 10 },
    ];

    expect(sortOperationalHeaderOptions(options).map((option) => option.id)).toEqual([10, 11]);
    expect(getAllOperationalHeaderOptionIds(options)).toEqual([10, 11]);
    expect(getOperationalHeaderOptionSelection({
      selectedIds: [10],
      optionId: 11,
      checked: true,
    })).toEqual([10, 11]);
    expect(getOperationalHeaderOptionSelection({
      selectedIds: [10, 11],
      optionId: 10,
      checked: false,
    })).toEqual([11]);
  });

  it("resolves dependencies for the selected field", () => {
    const fieldDependencies = getOperationalHeaderDependenciesForField({
      fieldId: 1,
      dependencies: config.dependencies,
    });

    expect(fieldDependencies).toHaveLength(1);
    expect(getOperationalHeaderDependencyParentFieldIds(fieldDependencies)).toEqual([1]);
    expect(getOperationalHeaderDependenciesForField({
      fieldId: 2,
      dependencies: config.dependencies,
    })).toEqual([]);
  });

  it("builds a parent option dependency matrix for the selected field", () => {
    const matrix = buildOperationalHeaderDependencyMatrix({
      field: config.fields[0],
      fields: config.fields,
      dependencies: config.dependencies,
    });

    expect(matrix).toHaveLength(1);
    expect(matrix[0].parentField.id).toBe(1);
    expect(matrix[0].parentOptions.map((group) => group.parentOption.id)).toEqual([10]);
    expect(matrix[0].parentOptions[0].allowedCount).toBe(1);
    expect(matrix[0].parentOptions[0].children.map((child) => ({
      optionId: child.option.id,
      selected: child.dependency !== null,
    }))).toEqual([
      { optionId: 10, selected: true },
      { optionId: 11, selected: false },
    ]);
  });

  it("keeps option creation and editing contextual to the selected field", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("field_id: field.id");
    expect(source).toContain("Se guardará dentro de {selectedField.label}.");
    expect(source).toContain("startEditOption(option)");
    expect(source).not.toContain("setSelectedFieldId(option");
  });

  it("keeps dependency assignment contextual to the selected field and selected options", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("field_id: selectedField.id");
    expect(source).toContain("option_ids: selectedOptionIds");
    expect(source).toContain("const contextualDependencyDraft = {");
    expect(source).toContain("selectedFieldDependencyMatrix.map((parentGroup)");
    expect(source).not.toContain("Campo dependiente");
    expect(source).not.toContain("Opcion dependiente");
  });

  it("keeps dependency matrix toggles wired to existing create and delete mutations", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("toggleMatrixDependency({");
    expect(source).toContain("await createOperationalHeaderDependency({");
    expect(source).toContain("await deleteDependency(input.dependency)");
  });

  it("keeps selection behavior wired in the master detail source", () => {
    const source = readFileSync("src/components/planning/operational-header-admin-panel.tsx", "utf8");

    expect(source).toContain("const [selectedFieldId, setSelectedFieldId]");
    expect(source).toContain("onSelect={selectField}");
    expect(source).toContain("setSelectedFieldId(savedField.id)");
    expect(source).toContain("getNextOperationalHeaderFieldIdAfterDelete(sortedFields, field.id)");
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
