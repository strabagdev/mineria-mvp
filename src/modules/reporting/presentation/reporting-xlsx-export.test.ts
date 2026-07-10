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
  assignment_rows: [],
  breakdowns: {
    by_operational_header: {},
    by_shift: [{ label: "Dia", count: 1, hours: 2 }],
    by_category: [{ label: "actividad", count: 1, hours: 2 }],
    by_tracking_type: [{ label: "programado", count: 1, hours: 2 }],
    by_item_type: [{ label: "desarrollo", count: 1, hours: 2 }],
  },
};

const filters = {
  date_from: "2026-06-01",
  date_to: "2026-06-07",
  shift: "",
  category: "",
  tracking_type: "",
  item_type: "",
  operational_header_filters: {},
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
  it("builds base detail headers without assignments", () => {
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
      "Actividad",
      "desarrollo",
      "Excavacion",
      "",
    ]);
  });

  it("exports operational header columns before category, type and detail", () => {
    const report: ReportResponse = {
      ...baseReport,
      operational_header_columns: [
        { id: 30, slug: "departamento", label: "Departamento", input_type: "select", sort_order: 30 },
        { id: 31, slug: "especialidad", label: "Especialidad", input_type: "text", sort_order: 40 },
      ],
      rows: [
        {
          ...baseRow,
          operational_header_values: {
            departamento: { field_id: 30, slug: "departamento", label: "Departamento", value: "Mina", option_id: 300 },
            especialidad: { field_id: 31, slug: "especialidad", label: "Especialidad", value: "Perforacion" },
          },
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(8, 12)).toEqual([
      "Departamento",
      "Especialidad",
      "Categoría",
      "Tipo",
    ]);
    expect(sheets.detalle[1].slice(8, 12)).toEqual([
      "Mina",
      "Perforacion",
      "Actividad",
      "desarrollo",
    ]);
  });

  it("does not duplicate legacy level and front when operational header columns include them", () => {
    const report: ReportResponse = {
      ...baseReport,
      operational_header_columns: [
        { id: 28, slug: "nivel", label: "Nivel", input_type: "select", sort_order: 10 },
        { id: 29, slug: "frente", label: "Frente", input_type: "select", sort_order: 20 },
        { id: 30, slug: "departamento", label: "Departamento", input_type: "text", sort_order: 30 },
      ],
      rows: [
        {
          ...baseRow,
          operational_header_values: {
            nivel: { field_id: 28, slug: "nivel", label: "Nivel", value: "Nivel 1", option_id: 280 },
            frente: { field_id: 29, slug: "frente", label: "Frente", value: "Frente A", option_id: 290 },
            departamento: { field_id: 30, slug: "departamento", label: "Departamento", value: "Mina" },
          },
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].filter((header) => header === "Nivel")).toHaveLength(1);
    expect(sheets.detalle[0].filter((header) => header === "Frente")).toHaveLength(1);
    expect(sheets.detalle[0].slice(8, 13)).toEqual([
      "Nivel",
      "Frente",
      "Departamento",
      "Categoría",
      "Tipo",
    ]);
    expect(sheets.detalle[1].slice(8, 13)).toEqual([
      "Nivel 1",
      "Frente A",
      "Mina",
      "Actividad",
      "desarrollo",
    ]);
  });

  it("exports only operational header columns instead of legacy level and front fallbacks", () => {
    const report: ReportResponse = {
      ...baseReport,
      operational_header_columns: [
        { id: 30, slug: "departamento", label: "Departamento", input_type: "text", sort_order: 30 },
      ],
      rows: [
        {
          ...baseRow,
          operational_header_values: {
            departamento: { field_id: 30, slug: "departamento", label: "Departamento", value: "Mina" },
          },
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(8, 10)).toEqual(["Departamento", "Categoría"]);
    expect(sheets.detalle[1].slice(8, 10)).toEqual(["Mina", "Actividad"]);
  });

  it("leaves legacy operational header columns empty when row values are missing", () => {
    const report: ReportResponse = {
      ...baseReport,
      operational_header_columns: [
        { id: 28, slug: "nivel", label: "Nivel", input_type: "select", sort_order: 10 },
        { id: 29, slug: "frente", label: "Frente", input_type: "select", sort_order: 20 },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(8, 11)).toEqual(["Nivel", "Frente", "Categoría"]);
    expect(sheets.detalle[1].slice(8, 11)).toEqual(["", "", "Actividad"]);
  });

  it("exports empty operational header cells when a row has no value", () => {
    const report: ReportResponse = {
      ...baseReport,
      operational_header_columns: [
        { id: 30, slug: "departamento", label: "Departamento", input_type: "text", sort_order: 30 },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(8, 10)).toEqual(["Departamento", "Categoría"]);
    expect(sheets.detalle[1].slice(8, 10)).toEqual(["", "Actividad"]);
  });

  it("keeps assignment columns after operational header columns", () => {
    const report: ReportResponse = {
      ...baseReport,
      operational_header_columns: [
        { id: 30, slug: "departamento", label: "Departamento", input_type: "text", sort_order: 30 },
      ],
      rows: [
        {
          ...baseRow,
          operational_header_values: {
            departamento: { field_id: 30, slug: "departamento", label: "Departamento", value: "Mina" },
          },
        },
      ],
      assignment_rows: [
        {
          ...assignmentBase,
          values: [
            { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "Turno A", raw_value: "Turno A" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0]).toEqual([
      "ID",
      "Fuente",
      "Grupo actividad",
      "Fecha",
      "Horario",
      "Horas",
      "Vista",
      "Turno",
      "Departamento",
      "Categoría",
      "Tipo",
      "Detalle",
      "Notas",
      "Cuadrilla - Nombre",
    ]);
    expect(sheets.detalle[1].at(-1)).toBe("Turno A");
    expect(Object.keys(sheets)).toEqual(["detalle"]);
  });

  it("exports assignment fields as filterable dynamic columns", () => {
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

    expect(sheets.detalle[0].at(-1)).toBe("Cuadrilla - Nombre");
    expect(sheets.detalle[1].at(-1)).toBe("Turno A; Turno B");
    expect(Object.keys(sheets)).toEqual(["detalle"]);
  });

  it("exports derived assignment fields like Familia in Excel", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          assignment_type_id: 21,
          assignment_type_slug: "equipos",
          assignment_type_label: "Equipo",
          assignment_type_icon_key: "truck",
          values: [
            { field_id: 2, field_slug: "codigo", field_label: "Código", input_type: "select", value: "CN-109", raw_value: "cn-109" },
            { field_id: 3, field_slug: "familia", field_label: "Familia", input_type: "text", value: "Camión", raw_value: "Camión" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(-2)).toEqual(["Equipo - Código", "Equipo - Familia"]);
    expect(sheets.detalle[1].slice(-2)).toEqual(["CN-109", "Camión"]);
  });

  it("exports multiple assignment types and fields as separate columns", () => {
    const report: ReportResponse = {
      ...baseReport,
      assignment_rows: [
        {
          ...assignmentBase,
          values: [
            { field_id: 1, field_slug: "codigo", field_label: "Código", input_type: "text", value: "C1", raw_value: "C1" },
            { field_id: 2, field_slug: "turno", field_label: "Turno", input_type: "text", value: "Dia", raw_value: "Dia" },
          ],
        },
        {
          ...assignmentBase,
          assignment_id: 102,
          assignment_type_id: 21,
          assignment_type_slug: "equipos",
          assignment_type_label: "Equipo",
          assignment_type_icon_key: "truck",
          values: [
            { field_id: 3, field_slug: "codigo", field_label: "Código", input_type: "select", value: "CN-109", raw_value: "cn-109" },
            { field_id: 4, field_slug: "familia", field_label: "Familia", input_type: "text", value: "Camión", raw_value: "Camión" },
          ],
        },
      ],
    };
    const sheets = buildReportXlsxSheets(report);

    expect(sheets.detalle[0].slice(-4)).toEqual([
      "Cuadrilla - Código",
      "Cuadrilla - Turno",
      "Equipo - Código",
      "Equipo - Familia",
    ]);
    expect(sheets.detalle[1].slice(-4)).toEqual(["C1", "Dia", "CN-109", "Camión"]);
  });

  it("keeps empty assignment values blank", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, 1, [
      {
        ...assignmentBase,
        values: [],
      },
    ])).toBe("");
  });

  it("formats one type with one assignment instance", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, 1, [
      {
        ...assignmentBase,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
        ],
      },
    ])).toBe("C1");
  });

  it("formats one type with multiple assignment instances", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, 1, [
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
    expect(formatAssignmentsForExcel("planning_item", 1, 21, 2, [
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
    expect(formatAssignmentsForExcel("planning_item", 1, 20, 2, [
      {
        ...assignmentBase,
        values: [
          { field_id: 1, field_slug: "nombre", field_label: "Nombre", input_type: "text", value: "C1", raw_value: "C1" },
          { field_id: 2, field_slug: "cantidad", field_label: "Cantidad", input_type: "number", value: "4", raw_value: 4 },
        ],
      },
    ])).toBe("4");
  });

  it("formats select, multi-select and boolean display values", () => {
    expect(formatAssignmentsForExcel("planning_item", 1, 20, 2, [
      {
        ...assignmentBase,
        assignment_type_label: "Equipo",
        values: [
          { field_id: 1, field_slug: "codigo", field_label: "Código", input_type: "select", value: "Jumbo 02", raw_value: "jumbo-02" },
          { field_id: 2, field_slug: "roles", field_label: "Roles", input_type: "multi_select", value: "Operador, Lorero", raw_value: ["operador", "lorero"] },
          { field_id: 3, field_slug: "validado", field_label: "Validado", input_type: "boolean", value: "Sí", raw_value: true },
        ],
      },
    ])).toBe("Operador, Lorero");
  });

  it("returns empty assignment text when no assignments match the planning item", () => {
    expect(formatAssignmentsForExcel("planning_item", 999, 20, 1, [
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

    expect(sheets.detalle[0].at(-1)).toBe("Cuadrilla - Nombre");
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
      "Equipos - Código",
      "Equipos - Código (codigo)",
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

  it("does not export generic assignment columns when field-level assignment columns exist", () => {
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
    expect(sheets.detalle[0]).not.toContain("Asignación - Cuadrilla");
    expect(sheets.detalle[0]).toContain("Cuadrilla - Nombre");
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
