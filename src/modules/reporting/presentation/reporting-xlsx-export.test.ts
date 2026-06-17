import { describe, expect, it } from "vitest";
import type { ReportResponse, ReportRow } from "../contracts/reporting";
import {
  buildReportXlsxWorkbook,
  buildReportXlsxSheets,
  formatAssignmentsForExcel,
  getReportXlsxFilename,
} from "./reporting-xlsx-export";

const baseRow: ReportRow = {
  id: 1,
  source_table: "planning_items",
  activity_group_id: "group-1",
  item_date: "2026-06-01",
  start_time: "08:00",
  end_time: "10:00",
  shift: "Dia",
  level: "Nivel 1",
  front: "Frente A",
  category: "actividad",
  tracking_type: "programado",
  item_type: "desarrollo",
  description: "Excavacion",
  notes: null,
  duration_minutes: 120,
};

const baseReport: ReportResponse = {
  rows: [baseRow],
  summary: {
    total_records: 1,
    total_programados: 1,
    total_reales: 0,
    total_interferencias: 0,
    horas_programadas: 2,
    horas_reales: 0,
    horas_interferencias: 0,
    diferencia_horas_real_vs_programado: -2,
    planned_records: 1,
    real_records: 0,
    interference_records: 0,
    planned_hours: 2,
    real_hours: 0,
    variance_hours: -2,
  },
  custom_field_columns: [],
  assignment_rows: [],
  breakdowns: {
    by_level: [{ label: "Nivel 1", count: 1, hours: 2 }],
    by_shift: [{ label: "Dia", count: 1, hours: 2 }],
    by_front: [{ label: "Frente A", count: 1, hours: 2 }],
    by_category: [{ label: "actividad", count: 1, hours: 2 }],
    by_tracking_type: [{ label: "programado", count: 1, hours: 2 }],
    by_item_type: [{ label: "desarrollo", count: 1, hours: 2 }],
  },
};

const filters = {
  date_from: "2026-06-01",
  date_to: "2026-06-07",
  shift: "",
  level: "",
  front: "",
  category: "",
  tracking_type: "",
  item_type: "",
};

const assignmentBase = {
  target_kind: "planning_item" as const,
  target_id: 1,
  planning_item_id: 1,
  assignment_id: 100,
  assignment_type_id: 20,
  assignment_type_slug: "cuadrilla",
  assignment_type_label: "Cuadrilla",
  assignment_type_icon_key: "users",
  instance_order: 1,
};

describe("reporting xlsx export", () => {
  it("builds base detail headers without custom fields or assignments", () => {
    const sheets = buildReportXlsxSheets(baseReport);

    expect(sheets.detalle[0]).toEqual([
      "ID",
      "Fuente",
      "Grupo actividad",
      "Fecha",
      "Horario",
      "Horas",
      "Vista",
      "Turno",
      "Nivel",
      "Frente",
      "Categoría",
      "Tipo",
      "Detalle",
      "Notas",
    ]);
    expect(sheets.detalle[1]).toEqual([
      1,
      "planning_items",
      "group-1",
      "2026-06-01",
      "08:00 - 10:00",
      "2",
      "Programado",
      "Dia",
      "Nivel 1",
      "Frente A",
      "Actividad",
      "desarrollo",
      "Excavacion",
      "",
    ]);
  });

  it("adds dynamic custom field columns and resolves header collisions", () => {
    const report: ReportResponse = {
      ...baseReport,
      rows: [
        {
          ...baseRow,
          custom_fields: {
            tipo_custom: { field_id: 10, slug: "tipo_custom", label: "Tipo", value: "Especial", raw_value: "Especial" },
            extra: { field_id: 11, slug: "extra", label: "Extra", value: "A", raw_value: "A" },
            extra_2: { field_id: 12, slug: "extra_2", label: "Extra", value: "B", raw_value: "B" },
          },
        },
      ],
      custom_field_columns: [
        { id: 10, slug: "tipo_custom", label: "Tipo", input_type: "text", active: true },
        { id: 11, slug: "extra", label: "Extra", input_type: "text", active: true },
        { id: 12, slug: "extra_2", label: "Extra", input_type: "text", active: true },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(-3)).toEqual([
      "Tipo (tipo_custom)",
      "Extra",
      "Extra (extra_2)",
    ]);
    expect(sheets.detalle[1].slice(-3)).toEqual(["Especial", "A", "B"]);
  });

  it("exports one assignment type as a filterable dynamic column", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Turno A", raw_value: "Turno A" },
          ],
        },
        {
          ...assignmentBase,
          assignment_id: 101,
          instance_order: 2,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Turno B", raw_value: "Turno B" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].at(-1)).toBe("Asignación - Cuadrilla");
    expect(sheets.detalle[1].at(-1)).toBe("Turno A; Turno B");
    expect(Object.keys(sheets)).toEqual(["detalle"]);
  });

  it("exports multiple assignment types as separate columns", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
          ],
        },
        {
          ...assignmentBase,
          assignment_id: 102,
          assignment_type_id: 21,
          assignment_type_slug: "equipos",
          assignment_type_label: "Equipos",
          assignment_type_icon_key: "truck",
          values: [
            { field_id: 2, field_slug: "codigo", field_label: "Código", input_type: "select", value: "CN-109", raw_value: "cn-109" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(-2)).toEqual(["Asignación - Cuadrilla", "Asignación - Equipos"]);
    expect(sheets.detalle[1].slice(-2)).toEqual(["C1", "CN-109"]);
  });

  it("keeps empty assignment values blank", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, [
      {
        ...assignmentBase,
        values: [],
      },
    ])).toBe("");
  });

  it("formats one type with one assignment instance", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, [
      {
        ...assignmentBase,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
        ],
      },
    ])).toBe("C1");
  });

  it("formats one type with multiple assignment instances", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, [
      {
        ...assignmentBase,
        assignment_id: 101,
        instance_order: 2,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C2", raw_value: "C2" },
        ],
      },
      {
        ...assignmentBase,
        assignment_id: 100,
        instance_order: 1,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
        ],
      },
    ])).toBe("C1; C2");
  });

  it("formats only the requested assignment type", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 21, [
      {
        ...assignmentBase,
        assignment_type_id: 21,
        assignment_type_slug: "equipo",
        assignment_type_label: "Equipo",
        assignment_type_icon_key: "truck",
        values: [
          { field_id: 2, field_slug: "codigo", field_label: "Código", input_type: "text", value: "Jumbo 02", raw_value: "Jumbo 02" },
        ],
      },
      {
        ...assignmentBase,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
        ],
      },
    ])).toBe("Jumbo 02");
  });

  it("formats assignment instances with multiple fields", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, [
      {
        ...assignmentBase,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
          { field_id: 2, field_slug: "cantidad", field_label: "Cantidad", input_type: "number", value: "4", raw_value: 4 },
        ],
      },
    ])).toBe("C1; 4");
  });

  it("formats select, multi-select and boolean display values", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, [
      {
        ...assignmentBase,
        assignment_type_label: "Equipo",
        values: [
          { field_id: 1, field_slug: "codigo", field_label: "Código", input_type: "select", value: "Jumbo 02", raw_value: "jumbo-02" },
          { field_id: 2, field_slug: "roles", field_label: "Roles", input_type: "multi_select", value: "Operador, Lorero", raw_value: ["operador", "lorero"] },
          { field_id: 3, field_slug: "validado", field_label: "Validado", input_type: "boolean", value: "Sí", raw_value: true },
        ],
      },
    ])).toBe("Jumbo 02; Operador, Lorero; Sí");
  });

  it("returns empty assignment text when no assignments match the planning item", () => {
    expect(formatAssignmentsForExcel("planning_item", 999, 20, [
      {
        ...assignmentBase,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
        ],
      },
    ])).toBe("");
  });

  it("exports execution segment assignments for real rows", () => {
    const report: ReportResponse = {
      ...baseReport,
      rows: [{ ...baseRow, id: 2, source_table: "activity_execution_segments", tracking_type: "real" }],
      assignment_rows: [
        {
          ...assignmentBase,
          target_kind: "execution_segment",
          target_id: 2,
          planning_item_id: null,
          assignment_id: 100,
          assignment_type_id: 20,
          assignment_type_slug: "cuadrilla",
          assignment_type_label: "Cuadrilla",
          assignment_type_icon_key: "users",
          instance_order: 1,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Turno Real", raw_value: "Turno Real" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].at(-1)).toBe("Asignación - Cuadrilla");
    expect(sheets.detalle[1].at(-1)).toBe("Turno Real");
  });

  it("keeps assignment exports scoped to each target", () => {
    const realRow: ReportRow = {
      ...baseRow,
      id: 1,
      source_table: "activity_execution_segments",
      tracking_type: "real",
      description: "Excavacion real",
    };
    const report: ReportResponse = {
      ...baseReport,
      rows: [baseRow, realRow],
      assignment_rows: [
        {
          ...assignmentBase,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Planificada", raw_value: "Planificada" },
          ],
        },
        {
          ...assignmentBase,
          target_kind: "execution_segment",
          target_id: 1,
          planning_item_id: null,
          assignment_id: 101,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Real", raw_value: "Real" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[1].at(-1)).toBe("Planificada");
    expect(sheets.detalle[2].at(-1)).toBe("Real");
  });

  it("leaves assignment export empty for rows without matching assignments", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          target_id: 999,
          planning_item_id: 999,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Otro", raw_value: "Otro" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[1].at(-1)).toBe("");
  });

  it("uses slug to resolve assignment header label collisions", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          assignment_type_id: 20,
          assignment_type_slug: "equipos-operacion",
          assignment_type_label: "Equipos",
          values: [
            { field_id: 1, field_slug: "codigo", field_label: "Código", input_type: "text", value: "CN-109", raw_value: "CN-109" },
          ],
        },
        {
          ...assignmentBase,
          assignment_id: 101,
          assignment_type_id: 21,
          assignment_type_slug: "equipos-apoyo",
          assignment_type_label: "Equipos",
          values: [
            { field_id: 1, field_slug: "codigo", field_label: "Código", input_type: "text", value: "AP-1", raw_value: "AP-1" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(-2)).toEqual([
      "Asignación - Equipos",
      "Asignación - Equipos (equipos-operacion)",
    ]);
    expect(sheets.detalle[1].slice(-2)).toEqual(["AP-1", "CN-109"]);
  });

  it("does not include assignment type prefixes inside cells", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          assignment_type_slug: "equipos",
          assignment_type_label: "Equipos",
          values: [
            { field_id: 1, field_slug: "codigo", field_label: "Código", input_type: "text", value: "CN-109", raw_value: "CN-109" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[1].at(-1)).toBe("CN-109");
    expect(String(sheets.detalle[1].at(-1))).not.toContain("Equipos:");
  });

  it("does not export the generic assignments column when dynamic assignment columns exist", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0]).not.toContain("Asignaciones");
    expect(sheets.detalle[0]).toContain("Asignación - Cuadrilla");
  });

  it("creates a workbook with only Detalle operacional sheet", () => {
    const appendedSheets: string[] = [];
    const xlsx = {
      utils: {
        book_new: () => ({ SheetNames: [] as string[] }),
        aoa_to_sheet: (rows: unknown[][]) => ({ rows }),
        book_append_sheet: (workbook: { SheetNames: string[] }, _sheet: unknown, name: string) => {
          workbook.SheetNames.push(name);
          appendedSheets.push(name);
        },
      },
    };
    const workbook = buildReportXlsxWorkbook(
      xlsx as unknown as Parameters<typeof buildReportXlsxWorkbook>[0],
      baseReport
    );

    expect(appendedSheets).toEqual(["Detalle operacional"]);
    expect(workbook.SheetNames).toEqual(["Detalle operacional"]);
  });

  it("builds the expected filename from filters", () => {
    expect(getReportXlsxFilename(filters)).toBe("reporte-operacional-2026-06-01_a_2026-06-07.xlsx");
  });
});
