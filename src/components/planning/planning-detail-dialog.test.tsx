import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlanningDetailDialog } from "./planning-detail-dialog";
import type { OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";

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
        { id: 20, field_id: 2, value: "frente_2", label: "Frente 2", active: true, sort_order: 10, metadata: {} },
      ],
    },
    {
      id: 3,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      required: true,
      active: true,
      sort_order: 30,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [
        { id: 30, field_id: 3, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
      ],
    },
    {
      id: 4,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      required: false,
      active: true,
      sort_order: 40,
      groupable: true,
      filterable: true,
      visible_in_gantt: true,
      exportable: true,
      options: [],
    },
  ],
  dependencies: [],
};

const baseProps = {
  title: "Avance",
  continuation: null,
  readOnly: true,
  formatDateLabel: (date: string) => date,
  formatDuration: () => "1h",
  toDisplayCategory: () => "Actividad",
  toTrackingTypeLabel: () => "Programado",
  onClose: vi.fn(),
  onEdit: vi.fn(),
};

describe("PlanningDetailDialog", () => {
  it("shows dynamic operational header values in detail", () => {
    const html = renderToStaticMarkup(
      <PlanningDetailDialog
        {...baseProps}
        item={{
          tracking_type: "programado",
          category: "actividad",
          item_type: "Perforacion",
          item_date: "2026-06-23",
          shift: "Dia",
          start: "08:00",
          end: "09:00",
          notes: null,
          operational_header_values: [
            { field_id: 3, value: "mina" },
            { field_id: 4, value: "Sondaje" },
          ],
        }}
        operationalHeaderConfig={config}
      />
    );

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("Departamento");
    expect(html).toContain("Mina");
    expect(html).toContain("Especialidad");
    expect(html).toContain("Sondaje");
  });

  it("shows Nivel and Frente through operational header values without duplicate location cards", () => {
    const html = renderToStaticMarkup(
      <PlanningDetailDialog
        {...baseProps}
        item={{
          tracking_type: "programado",
          category: "actividad",
          item_type: "Perforacion",
          item_date: "2026-06-23",
          shift: "Dia",
          start: "08:00",
          end: "09:00",
          notes: null,
          operational_header_values: [
            { field_id: 1, value: "nti", option_id: 10 },
            { field_id: 2, value: "frente_2", option_id: 20 },
            { field_id: 3, value: "mina", option_id: 30 },
          ],
        }}
        operationalHeaderConfig={config}
      />
    );

    expect(html).toContain("Nivel");
    expect(html).toContain("Frente");
    expect(html).toContain("NTI");
    expect(html).toContain("Frente 2");
    expect(html).not.toContain("Ubicacion");
  });

  it("does not use legacy fallback when header values are missing", () => {
    const html = renderToStaticMarkup(
      <PlanningDetailDialog
        {...baseProps}
        item={{
          tracking_type: "programado",
          category: "actividad",
          item_type: "Perforacion",
          item_date: "2026-06-23",
          shift: "Dia",
          start: "08:00",
          end: "09:00",
          notes: null,
          operational_header_values: [],
        }}
        operationalHeaderConfig={config}
      />
    );

    expect(html).toContain("Nivel");
    expect(html).toContain("Frente");
    expect(html).toContain("Sin valor");
    expect(html).not.toContain("NTI");
    expect(html).not.toContain("Frente 2");
  });

  it("shows a clear empty header state when no operational header config exists", () => {
    const html = renderToStaticMarkup(
      <PlanningDetailDialog
        {...baseProps}
        item={{
          tracking_type: "programado",
          category: "actividad",
          item_type: "Perforacion",
          item_date: "2026-06-23",
          shift: "Dia",
          start: "08:00",
          end: "09:00",
          notes: null,
        }}
        operationalHeaderConfig={{ fields: [], dependencies: [] }}
      />
    );

    expect(html).toContain("Cabecera Operacional");
    expect(html).toContain("Sin cabecera");
    expect(html).not.toContain("Ubicacion");
    expect(html).not.toContain("NTI");
    expect(html).not.toContain("Frente 2");
  });
});
