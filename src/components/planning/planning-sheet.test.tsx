import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningSheet } from "./planning-sheet";
import type { OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";

vi.mock("@/components/ui/sheet-panel", () => ({
  SheetPanel: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

vi.mock("@/modules/operational-header/application/operational-header-form-dependencies", () => ({
  resolveOperationalHeaderDynamicFormFields: ({
    config,
    dynamicValues,
  }: {
    config: OperationalHeaderResponseDto | null | undefined;
    dynamicValues: Record<number, string>;
  }) => {
    if (!config) {
      return [];
    }

    return config.fields
      .filter((field) => field.active)
      .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label))
      .map((field) => {
        const fieldDependencies = config.dependencies.filter((dependency) => dependency.field_id === field.id);
        const options = field.input_type === "select"
          ? field.options
            .filter((option) => option.active)
            .filter((option) => {
              if (!fieldDependencies.length) {
                return true;
              }

              return fieldDependencies
                .filter((dependency) => dependency.option_id === option.id)
                .some((dependency) => {
                  const parentField = config.fields.find((candidate) => candidate.id === dependency.depends_on_field_id);
                  const selectedValue = dynamicValues[dependency.depends_on_field_id] ?? "";
                  const selectedOption = parentField?.options.find((candidate) =>
                    candidate.active &&
                    (
                      candidate.value.toLowerCase() === selectedValue.toLowerCase() ||
                      candidate.label.toLowerCase() === selectedValue.toLowerCase()
                    )
                  );

                  return selectedOption?.id === dependency.depends_on_option_id;
                });
            })
            .map((option) => ({ id: option.id, value: option.label || option.value, label: option.label || option.value }))
          : [];

        return { field, options };
      });
  },
}));

const operationalHeaderConfig: OperationalHeaderResponseDto = {
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
        { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
      ],
    },
    {
      id: 2,
      slug: "frente",
      label: "Frente",
      input_type: "select",
      required: true,
      active: true,
      sort_order: 20,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [
        { id: 20, field_id: 2, value: "frente-2", label: "Frente 2", active: true, sort_order: 10, metadata: {} },
      ],
    },
    {
      id: 3,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      required: true,
      active: true,
      sort_order: 30,
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
      field_id: 2,
      option_id: 20,
      depends_on_field_id: 1,
      depends_on_option_id: 10,
    },
  ],
};

const configWithEmptySelect: OperationalHeaderResponseDto = {
  fields: [
    {
      id: 4,
      slug: "sector",
      label: "Sector",
      input_type: "select",
      required: false,
      active: true,
      sort_order: 10,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [],
    },
  ],
  dependencies: [],
};

function renderPlanningSheet(input: {
  operationalHeaderConfig?: OperationalHeaderResponseDto | null;
  dynamicHeaderValues?: Record<number, string>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
} = {}) {
  return renderToStaticMarkup(
    <PlanningSheet
      titleId="planning-sheet-title"
      eyebrow="Operaciones"
      title="Nuevo programado"
      formState={{
        activity_group_id: "group-1",
        item_date: "2026-06-22",
        start_time: "08:00",
        end_time: "09:00",
        shift: "Dia",
        category: "actividad",
        tracking_type: "programado",
        item_type: "Perforacion",
        description: "Avance",
        notes: "",
      }}
      setFormState={vi.fn()}
      availableFormCategories={[
        {
          slug: "actividad",
          label: "Actividad",
          types: [{ id: 1, label: "Perforacion", details: [{ id: 1, label: "Avance" }] }],
        },
      ]}
      availableTypes={[{ id: 1, label: "Perforacion", details: [{ id: 1, label: "Avance" }] }]}
      availableDescriptions={[{ id: 1, label: "Avance" }]}
      operationalHeaderConfig={input.operationalHeaderConfig === undefined ? operationalHeaderConfig : input.operationalHeaderConfig}
      dynamicHeaderValues={input.dynamicHeaderValues ?? {}}
      onDynamicHeaderValuesChange={vi.fn()}
      error=""
      busy={false}
      isEditing={false}
      deleteLabel="Eliminar"
      submitLabel="Crear"
      onClose={() => undefined}
      onSubmit={input.onSubmit ?? (() => undefined)}
      onRequestDelete={() => undefined}
    />
  );
}

describe("PlanningSheet", () => {
  it("renders Cabecera Operacional as its own section", () => {
    const html = renderPlanningSheet({ dynamicHeaderValues: { 1: "NTI" } });

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("Identifica dónde y bajo qué eje se registra el evento.");
    expect(html.indexOf("Cabecera Operacional")).toBeLessThan(html.indexOf("Actividad / Interferencia"));
    expect(html).toContain("Requerido");
  });

  it("renders field-specific placeholders", () => {
    const html = renderPlanningSheet({ dynamicHeaderValues: { 1: "NTI" } });

    expect(html).toContain("Seleccionar nivel");
    expect(html).toContain("Seleccionar frente");
    expect(html).toContain("placeholder=\"Ingresar departamento\"");
    expect(html).not.toContain(">Selecciona<");
  });

  it("shows the updated empty config message", () => {
    const html = renderPlanningSheet({ operationalHeaderConfig: null });

    expect(html).toContain("Configura la Cabecera Operacional en Catálogo para poder identificar eventos.");
    expect(html).not.toContain("Configura Nivel y Frente");
  });

  it("explains dependent fields while the parent field is empty", () => {
    const html = renderPlanningSheet();

    expect(html).toContain("Selecciona nivel para ver opciones de frente.");
  });

  it("explains selects without active options", () => {
    const html = renderPlanningSheet({ operationalHeaderConfig: configWithEmptySelect });

    expect(html).toContain("No hay opciones activas para sector.");
  });

  it("keeps submit handling delegated to the parent page", () => {
    const handleSubmit = vi.fn();
    const html = renderPlanningSheet({ onSubmit: handleSubmit });

    expect(handleSubmit).not.toHaveBeenCalled();
    expect(html).toContain("Crear");
  });
});
