import { describe, expect, it } from "vitest";
import { buildReportFromSourceRows, getReportDurationMinutes } from "../../modules/reporting/application/reporting-calculations";
import type {
  AssignmentFieldDto,
  AssignmentTypeDto,
  PlanningAssignmentDto,
  PlanningAssignmentValueDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import type {
  OperationalHeaderFieldDto,
  OperationalHeaderValueDto,
} from "@/modules/operational-header/contracts/operational-header";
import type { PlannedReportRow, RealReportRow } from "../repositories/reports.repository";

const basePlanned: PlannedReportRow = {
  id: 1,
  activity_group_id: "group-1",
  item_date: "2026-06-01",
  start_time: "08:00:00",
  end_time: "10:00:00",
  shift: "Dia",
  category: "actividad",
  item_type: "desarrollo",
  description: "Excavacion programada",
  notes: null,
  tracking_type: "programado",
};

const baseReal: RealReportRow = {
  id: 10,
  activity_group_id: "group-1",
  item_date: "2026-06-01",
  start_time: "08:30:00",
  end_time: "09:45:00",
  shift: "Dia",
  category: "actividad",
  item_type: "desarrollo",
  description: "Excavacion real",
  notes: null,
};

const emptyQuery = {
  shift: "",
  category: "",
  trackingType: "",
  itemType: "",
};

function operationalHeaderField(input: Partial<OperationalHeaderFieldDto> & Pick<OperationalHeaderFieldDto, "id" | "slug" | "label" | "input_type">): OperationalHeaderFieldDto {
  return {
    required: false,
    active: true,
    sort_order: 100,
    grouping_order: null,
    groupable: true,
    filterable: true,
    visible_in_gantt: true,
    exportable: true,
    options: [],
    ...input,
  };
}

function operationalHeaderValue(input: Partial<OperationalHeaderValueDto> & Pick<OperationalHeaderValueDto, "field_id">): OperationalHeaderValueDto {
  const { field_id: fieldId, ...rest } = input;

  return {
    id: 1,
    field_id: fieldId,
    activity_group_id: "",
    planning_item_id: null,
    execution_segment_id: null,
    option_id: null,
    value_text: null,
    ...rest,
  };
}

function assignmentField(input: Partial<AssignmentFieldDto> & Pick<AssignmentFieldDto, "id" | "assignment_type_id" | "slug" | "label" | "input_type">): AssignmentFieldDto {
  return {
    active: true,
    required: false,
    sort_order: 100,
    config: {},
    options: [],
    ...input,
  };
}

function assignmentType(input: Partial<AssignmentTypeDto> & Pick<AssignmentTypeDto, "id" | "slug" | "label" | "fields">): AssignmentTypeDto {
  return {
    description: null,
    icon_key: null,
    active: true,
    max_instances: 1,
    sort_order: 100,
    config: {},
    ...input,
  };
}

function assignmentValue(input: Partial<PlanningAssignmentValueDto> & Pick<PlanningAssignmentValueDto, "field_id">): PlanningAssignmentValueDto {
  return {
    id: 1,
    assignment_id: 1,
    option_id: null,
    value_text: null,
    value_number: null,
    value_date: null,
    value_boolean: null,
    value_json: {},
    ...input,
  };
}

function planningAssignment(input: Partial<PlanningAssignmentDto> & Pick<PlanningAssignmentDto, "id" | "assignment_type_id">): PlanningAssignmentDto {
  return {
    planning_item_id: null,
    execution_segment_id: null,
    instance_order: 1,
    values: [],
    ...input,
  };
}

describe("reports service calculations", () => {
  it("returns empty R1 metrics when no source rows match", () => {
    const report = buildReportFromSourceRows(emptyQuery, [], []);

    expect(report.rows).toEqual([]);
    expect(report.summary).toMatchObject({
      total_programados: 0,
      total_reales: 0,
      total_interferencias: 0,
      horas_programadas: 0,
      horas_reales: 0,
      horas_interferencias: 0,
      diferencia_horas_real_vs_programado: 0,
    });
  });

  it("counts planned rows and planned hours without inventing real execution", () => {
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], []);

    expect(report.summary.total_programados).toBe(1);
    expect(report.summary.total_reales).toBe(0);
    expect(report.summary.horas_programadas).toBe(2);
    expect(report.summary.horas_reales).toBe(0);
    expect(report.summary.diferencia_horas_real_vs_programado).toBe(-2);
  });

  it("counts real rows, interferences, hours and type breakdowns", () => {
    const interference: RealReportRow = {
      ...baseReal,
      id: 11,
      activity_group_id: "group-2",
      start_time: "10:00:00",
      end_time: "11:30:00",
      category: "interferencia",
      item_type: "espera",
      description: "Interferencia real",
    };

    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [baseReal, interference]);

    expect(report.summary.total_programados).toBe(1);
    expect(report.summary.total_reales).toBe(2);
    expect(report.summary.total_interferencias).toBe(1);
    expect(report.summary.horas_programadas).toBe(2);
    expect(report.summary.horas_reales).toBe(2.75);
    expect(report.summary.horas_interferencias).toBe(1.5);
    expect(report.summary.diferencia_horas_real_vs_programado).toBe(0.75);
    expect(report.breakdowns.by_item_type).toEqual([
      { label: "desarrollo", count: 2, hours: 3.25 },
      { label: "espera", count: 1, hours: 1.5 },
    ]);
  });

  it("handles records crossing midnight", () => {
    expect(getReportDurationMinutes("23:30:00", "01:00:00")).toBe(90);
    expect(getReportDurationMinutes("19:00:00", "07:00:00")).toBe(720);
    expect(getReportDurationMinutes("23:00:00", "09:00:00")).toBe(600);
  });

  it("applies date-independent filters by shift and type without legacy level/front", () => {
    const nightReal: RealReportRow = {
      ...baseReal,
      id: 12,
      item_date: "2026-06-02",
      start_time: "21:00:00",
      end_time: "22:00:00",
      shift: "Noche",
    };

    const report = buildReportFromSourceRows(
      { ...emptyQuery, shift: "Noche", itemType: "desarrollo" },
      [basePlanned],
      [baseReal, nightReal]
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ id: 12, shift: "Noche" });
  });

  it("adds exportable operational header values for planned and real rows", () => {
    const levelField = operationalHeaderField({
      id: 40,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      sort_order: 10,
      options: [{ id: 901, field_id: 40, value: "nivel_1", label: "Nivel 1", active: true, sort_order: 10, metadata: {} }],
    });
    const frontField = operationalHeaderField({
      id: 41,
      slug: "frente",
      label: "Frente",
      input_type: "select",
      sort_order: 20,
      options: [{ id: 902, field_id: 41, value: "frente_a", label: "Frente A", active: true, sort_order: 10, metadata: {} }],
    });
    const departmentField = operationalHeaderField({
      id: 42,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      sort_order: 30,
      options: [{ id: 903, field_id: 42, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} }],
    });
    const specialtyField = operationalHeaderField({
      id: 43,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      sort_order: 40,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [baseReal],
      undefined,
      {
        fields: [specialtyField, departmentField, frontField, levelField],
        values: [
          operationalHeaderValue({ id: 400, field_id: departmentField.id, planning_item_id: basePlanned.id, option_id: 903 }),
          operationalHeaderValue({ id: 401, field_id: specialtyField.id, planning_item_id: basePlanned.id, value_text: "Perforacion" }),
          operationalHeaderValue({ id: 402, field_id: departmentField.id, execution_segment_id: baseReal.id, option_id: 903 }),
          operationalHeaderValue({ id: 403, field_id: specialtyField.id, execution_segment_id: baseReal.id, value_text: "Fortificacion" }),
        ],
      }
    );

    expect(report.operational_header_columns?.map((column) => column.label)).toEqual([
      "Nivel",
      "Frente",
      "Departamento",
      "Especialidad",
    ]);
    const plannedRow = report.rows.find((row) => row.source_table === "planning_items");
    const realRow = report.rows.find((row) => row.source_table === "activity_execution_segments");

    expect(plannedRow?.operational_header_values?.departamento?.value).toBe("Mina");
    expect(plannedRow?.operational_header_values?.especialidad?.value).toBe("Perforacion");
    expect(realRow?.operational_header_values?.departamento?.value).toBe("Mina");
    expect(realRow?.operational_header_values?.especialidad?.value).toBe("Fortificacion");
  });

  it("orders reportable operational header columns by sort_order, label and id without grouping_order", () => {
    const zetaField = operationalHeaderField({
      id: 70,
      slug: "zeta",
      label: "Zeta",
      input_type: "text",
      sort_order: 10,
      grouping_order: 1,
    });
    const alphaHighId = operationalHeaderField({
      id: 72,
      slug: "alpha_high",
      label: "Alpha",
      input_type: "text",
      sort_order: 20,
      grouping_order: 1,
    });
    const alphaLowId = operationalHeaderField({
      id: 71,
      slug: "alpha_low",
      label: "Alpha",
      input_type: "text",
      sort_order: 20,
      grouping_order: 1,
    });
    const betaField = operationalHeaderField({
      id: 73,
      slug: "beta",
      label: "Beta",
      input_type: "text",
      sort_order: 20,
      grouping_order: 0,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [],
      undefined,
      {
        fields: [betaField, alphaHighId, zetaField, alphaLowId],
        values: [],
      }
    );

    expect(report.operational_header_columns?.map((column) => column.slug)).toEqual([
      "zeta",
      "alpha_low",
      "alpha_high",
      "beta",
    ]);
  });

  it("does not fallback to legacy level and front for operational header columns", () => {
    const levelField = operationalHeaderField({
      id: 44,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      sort_order: 10,
    });
    const frontField = operationalHeaderField({
      id: 45,
      slug: "frente",
      label: "Frente",
      input_type: "text",
      sort_order: 20,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [baseReal],
      undefined,
      { fields: [frontField, levelField], values: [] }
    );

    expect(report.operational_header_columns?.map((column) => column.slug)).toEqual(["nivel", "frente"]);
    expect(report.rows[0]?.operational_header_values?.nivel).toBeUndefined();
    expect(report.rows[0]?.operational_header_values?.frente).toBeUndefined();
    expect(report.rows[1]?.operational_header_values?.nivel).toBeUndefined();
    expect(report.rows[1]?.operational_header_values?.frente).toBeUndefined();
  });

  it("filters by dynamic operational header select values after enriching rows", () => {
    const departmentField = operationalHeaderField({
      id: 50,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      options: [
        { id: 950, field_id: 50, value: "mina", label: "Mina", active: true, sort_order: 10, metadata: {} },
        { id: 951, field_id: 50, value: "planta", label: "Planta", active: true, sort_order: 20, metadata: {} },
      ],
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { departamento: "Mina" },
      },
      [basePlanned],
      [{ ...baseReal, id: 11 }],
      undefined,
      {
        fields: [departmentField],
        values: [
          operationalHeaderValue({ id: 500, field_id: departmentField.id, planning_item_id: basePlanned.id, option_id: 950 }),
          operationalHeaderValue({ id: 501, field_id: departmentField.id, execution_segment_id: 11, option_id: 951 }),
        ],
      }
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.source_table).toBe("planning_items");
    expect(report.rows[0]?.operational_header_values?.departamento?.value).toBe("Mina");
  });

  it("filters by operational header fields that are filterable but not exportable", () => {
    const guardField = operationalHeaderField({
      id: 59,
      slug: "guardia",
      label: "Guardia",
      input_type: "select",
      filterable: true,
      exportable: false,
      options: [
        { id: 959, field_id: 59, value: "a", label: "A", active: true, sort_order: 10, metadata: {} },
        { id: 960, field_id: 59, value: "b", label: "B", active: true, sort_order: 20, metadata: {} },
      ],
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { guardia: "A" },
      },
      [basePlanned],
      [{ ...baseReal, id: 11 }],
      undefined,
      {
        fields: [guardField],
        values: [
          operationalHeaderValue({ id: 510, field_id: guardField.id, planning_item_id: basePlanned.id, option_id: 959 }),
          operationalHeaderValue({ id: 511, field_id: guardField.id, execution_segment_id: 11, option_id: 960 }),
        ],
      }
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.source_table).toBe("planning_items");
    expect(report.operational_header_columns).toEqual([]);
    expect(report.rows[0]?.operational_header_values?.guardia).toBeUndefined();
  });

  it("does not apply filters for fields that are exportable but not filterable", () => {
    const areaField = operationalHeaderField({
      id: 60,
      slug: "area",
      label: "Area",
      input_type: "text",
      filterable: false,
      exportable: true,
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { area: "Norte" },
      },
      [basePlanned],
      [{ ...baseReal, id: 11 }],
      undefined,
      {
        fields: [areaField],
        values: [
          operationalHeaderValue({ id: 512, field_id: areaField.id, planning_item_id: basePlanned.id, value_text: "Norte" }),
          operationalHeaderValue({ id: 513, field_id: areaField.id, execution_segment_id: 11, value_text: "Sur" }),
        ],
      }
    );

    expect(report.rows).toHaveLength(2);
    expect(report.operational_header_columns?.map((column) => column.slug)).toEqual(["area"]);
    expect(report.rows.map((row) => row.operational_header_values?.area?.value).sort()).toEqual(["Norte", "Sur"]);
  });

  it("ignores filters for inactive operational header fields", () => {
    const inactiveField = operationalHeaderField({
      id: 61,
      slug: "sector",
      label: "Sector",
      input_type: "text",
      active: false,
      filterable: true,
      exportable: true,
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { sector: "S1" },
      },
      [basePlanned],
      [],
      undefined,
      {
        fields: [inactiveField],
        values: [
          operationalHeaderValue({ id: 514, field_id: inactiveField.id, planning_item_id: basePlanned.id, value_text: "S1" }),
        ],
      }
    );

    expect(report.rows).toHaveLength(1);
    expect(report.operational_header_columns).toEqual([]);
    expect(report.rows[0]?.operational_header_values?.sector).toBeUndefined();
  });

  it("uses exact matching for select operational header filters", () => {
    const departmentField = operationalHeaderField({
      id: 51,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      options: [
        { id: 952, field_id: 51, value: "mina_norte", label: "Mina Norte", active: true, sort_order: 10, metadata: {} },
      ],
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { departamento: "Mina" },
      },
      [basePlanned],
      [],
      undefined,
      {
        fields: [departmentField],
        values: [
          operationalHeaderValue({ id: 502, field_id: departmentField.id, planning_item_id: basePlanned.id, option_id: 952 }),
        ],
      }
    );

    expect(report.rows).toEqual([]);
  });

  it("uses contains matching for text operational header filters", () => {
    const specialtyField = operationalHeaderField({
      id: 52,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { especialidad: "fort" },
      },
      [basePlanned],
      [{ ...baseReal, id: 12 }],
      undefined,
      {
        fields: [specialtyField],
        values: [
          operationalHeaderValue({ id: 503, field_id: specialtyField.id, planning_item_id: basePlanned.id, value_text: "Perforacion" }),
          operationalHeaderValue({ id: 504, field_id: specialtyField.id, execution_segment_id: 12, value_text: "Fortificacion" }),
        ],
      }
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.source_table).toBe("activity_execution_segments");
    expect(report.rows[0]?.operational_header_values?.especialidad?.value).toBe("Fortificacion");
  });

  it("clears operational header filters when the filter value is empty", () => {
    const specialtyField = operationalHeaderField({
      id: 62,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      filterable: true,
      exportable: false,
    });
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
        operational_header_filters: { especialidad: "   " },
      },
      [basePlanned],
      [{ ...baseReal, id: 12 }],
      undefined,
      {
        fields: [specialtyField],
        values: [
          operationalHeaderValue({ id: 515, field_id: specialtyField.id, planning_item_id: basePlanned.id, value_text: "Perforacion" }),
          operationalHeaderValue({ id: 516, field_id: specialtyField.id, execution_segment_id: 12, value_text: "Fortificacion" }),
        ],
      }
    );

    expect(report.rows).toHaveLength(2);
    expect(report.operational_header_columns).toEqual([]);
  });

  it("maps legacy level and front query filters to operational header aliases", () => {
    const levelField = operationalHeaderField({
      id: 53,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      options: [
        { id: 953, field_id: 53, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} },
        { id: 954, field_id: 53, value: "nnm", label: "NNM", active: true, sort_order: 20, metadata: {} },
      ],
    });
    const frontField = operationalHeaderField({
      id: 54,
      slug: "frente",
      label: "Frente",
      input_type: "text",
    });
    const planned = {
      ...basePlanned,
    };
    const report = buildReportFromSourceRows(
      {
        ...emptyQuery,
      },
      [planned],
      [],
      undefined,
      {
        fields: [levelField, frontField],
        values: [
          operationalHeaderValue({ id: 505, field_id: levelField.id, planning_item_id: planned.id, option_id: 953 }),
          operationalHeaderValue({ id: 506, field_id: frontField.id, planning_item_id: planned.id, value_text: "Frente XC 12" }),
        ],
      }
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.operational_header_values?.nivel?.value).toBe("NTI");
    expect(report.rows[0]?.operational_header_values?.frente?.value).toBe("Frente XC 12");
  });

  it("builds operational header breakdowns by groupable exported fields", () => {
    const levelField = operationalHeaderField({
      id: 55,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
    });
    const frontField = operationalHeaderField({
      id: 56,
      slug: "frente",
      label: "Frente",
      input_type: "text",
    });
    const departmentField = operationalHeaderField({
      id: 57,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
    });
    const nonGroupableField = operationalHeaderField({
      id: 58,
      slug: "turno_admin",
      label: "Turno Admin",
      input_type: "text",
      groupable: false,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [baseReal],
      undefined,
      {
        fields: [levelField, frontField, departmentField, nonGroupableField],
        values: [
          operationalHeaderValue({ id: 507, field_id: departmentField.id, planning_item_id: basePlanned.id, value_text: "Mina" }),
          operationalHeaderValue({ id: 508, field_id: departmentField.id, execution_segment_id: baseReal.id, value_text: "Mina" }),
          operationalHeaderValue({ id: 509, field_id: nonGroupableField.id, planning_item_id: basePlanned.id, value_text: "A" }),
        ],
      }
    );

    expect(Object.keys(report.breakdowns.by_operational_header).sort()).toEqual([
      "departamento",
      "frente",
      "nivel",
    ]);
    expect(report.breakdowns.by_operational_header.nivel).toEqual([
      { label: "Sin valor", count: 2, hours: 3.25 },
    ]);
    expect(report.breakdowns.by_operational_header.frente).toEqual([
      { label: "Sin valor", count: 2, hours: 3.25 },
    ]);
    expect(report.breakdowns.by_operational_header.departamento).toEqual([
      { label: "Mina", count: 2, hours: 3.25 },
    ]);
  });

  it("keeps breakdowns tied to groupable exportable fields, not filterable-only fields", () => {
    const filterOnlyField = operationalHeaderField({
      id: 63,
      slug: "guardia",
      label: "Guardia",
      input_type: "text",
      groupable: true,
      filterable: true,
      exportable: false,
    });
    const exportableField = operationalHeaderField({
      id: 64,
      slug: "area",
      label: "Area",
      input_type: "text",
      groupable: true,
      filterable: false,
      exportable: true,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [],
      undefined,
      {
        fields: [filterOnlyField, exportableField],
        values: [
          operationalHeaderValue({ id: 517, field_id: filterOnlyField.id, planning_item_id: basePlanned.id, value_text: "A" }),
          operationalHeaderValue({ id: 518, field_id: exportableField.id, planning_item_id: basePlanned.id, value_text: "Norte" }),
        ],
      }
    );

    expect(Object.keys(report.breakdowns.by_operational_header)).toEqual(["area"]);
    expect(report.breakdowns.by_operational_header.area).toEqual([
      { label: "Norte", count: 1, hours: 2 },
    ]);
  });

  it("keeps exportable operational header columns even when a row has no value", () => {
    const departmentField = operationalHeaderField({
      id: 46,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      sort_order: 30,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [],
      undefined,
      { fields: [departmentField], values: [] }
    );

    expect(report.operational_header_columns).toEqual([
      {
        id: departmentField.id,
        slug: "departamento",
        label: "Departamento",
        input_type: "text",
        sort_order: 30,
      },
    ]);
    expect(report.rows[0]?.operational_header_values?.departamento).toBeUndefined();
  });

  it("does not expose inactive or non-exportable operational header fields in reports", () => {
    const activeExportableField = operationalHeaderField({
      id: 47,
      slug: "area",
      label: "Area",
      input_type: "text",
      sort_order: 10,
    });
    const inactiveField = operationalHeaderField({
      id: 48,
      slug: "sector",
      label: "Sector",
      input_type: "text",
      active: false,
      sort_order: 20,
    });
    const nonExportableField = operationalHeaderField({
      id: 49,
      slug: "guardia",
      label: "Guardia",
      input_type: "text",
      exportable: false,
      sort_order: 30,
    });
    const report = buildReportFromSourceRows(
      emptyQuery,
      [basePlanned],
      [],
      undefined,
      {
        fields: [activeExportableField, inactiveField, nonExportableField],
        values: [
          operationalHeaderValue({ id: 404, field_id: activeExportableField.id, planning_item_id: basePlanned.id, value_text: "Norte" }),
          operationalHeaderValue({ id: 405, field_id: inactiveField.id, planning_item_id: basePlanned.id, value_text: "S1" }),
          operationalHeaderValue({ id: 406, field_id: nonExportableField.id, planning_item_id: basePlanned.id, value_text: "A" }),
        ],
      }
    );

    expect(report.operational_header_columns?.map((column) => column.slug)).toEqual(["area"]);
    expect(Object.keys(report.rows[0]?.operational_header_values ?? {})).toEqual(["area"]);
  });

  it("adds assignment rows for filtered planned rows without changing report rows", () => {
    const field = assignmentField({ id: 301, assignment_type_id: 30, slug: "operador", label: "Operador", input_type: "text" });
    const type = assignmentType({ id: 30, slug: "persona", label: "Persona", icon_key: "user", fields: [field] });
    const assignment = planningAssignment({
      id: 3001,
      planning_item_id: basePlanned.id,
      assignment_type_id: type.id,
      instance_order: 2,
      values: [assignmentValue({ id: 4001, assignment_id: 3001, field_id: field.id, value_text: "Ana Perez" })],
    });

    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      types: [type],
      assignments: [assignment],
    });

    expect(report.assignment_rows).toEqual([
      {
        target_kind: "planning_item",
        target_id: basePlanned.id,
        planning_item_id: basePlanned.id,
        assignment_id: assignment.id,
        assignment_type_id: type.id,
        assignment_type_slug: "persona",
        assignment_type_label: "Persona",
        assignment_type_icon_key: "user",
        instance_order: 2,
        values: [
          {
            field_id: field.id,
            field_slug: "operador",
            field_label: "Operador",
            input_type: "text",
            value: "Ana Perez",
            raw_value: "Ana Perez",
          },
        ],
      },
    ]);
  });

  it("adds assignment rows for execution segment targets", () => {
    const field = assignmentField({ id: 307, assignment_type_id: 34, slug: "equipo", label: "Equipo", input_type: "text" });
    const type = assignmentType({ id: 34, slug: "maquinaria-real", label: "Maquinaria real", fields: [field] });
    const assignment = planningAssignment({
      id: 3005,
      execution_segment_id: baseReal.id,
      assignment_type_id: type.id,
      values: [assignmentValue({ id: 4007, assignment_id: 3005, field_id: field.id, value_text: "Jumbo 03" })],
    });

    const report = buildReportFromSourceRows(emptyQuery, [], [baseReal], {
      types: [type],
      assignments: [assignment],
    });

    expect(report.assignment_rows).toEqual([
      {
        target_kind: "execution_segment",
        target_id: baseReal.id,
        planning_item_id: null,
        assignment_id: assignment.id,
        assignment_type_id: type.id,
        assignment_type_slug: "maquinaria-real",
        assignment_type_label: "Maquinaria real",
        assignment_type_icon_key: null,
        instance_order: 1,
        values: [
          {
            field_id: field.id,
            field_slug: "equipo",
            field_label: "Equipo",
            input_type: "text",
            value: "Jumbo 03",
            raw_value: "Jumbo 03",
          },
        ],
      },
    ]);
  });

  it("does not infer assignments between planned and real targets with matching activity group", () => {
    const field = assignmentField({ id: 308, assignment_type_id: 35, slug: "nombre", label: "Nombre", input_type: "text" });
    const type = assignmentType({ id: 35, slug: "cuadrilla", label: "Cuadrilla", fields: [field] });
    const plannedAssignment = planningAssignment({
      id: 3006,
      planning_item_id: basePlanned.id,
      assignment_type_id: type.id,
      values: [assignmentValue({ id: 4008, assignment_id: 3006, field_id: field.id, value_text: "Planificada" })],
    });
    const realAssignment = planningAssignment({
      id: 3007,
      execution_segment_id: baseReal.id,
      assignment_type_id: type.id,
      values: [assignmentValue({ id: 4009, assignment_id: 3007, field_id: field.id, value_text: "Real" })],
    });

    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [baseReal], {
      types: [type],
      assignments: [plannedAssignment, realAssignment],
    });

    expect(report.assignment_rows).toEqual([
      expect.objectContaining({
        target_kind: "execution_segment",
        target_id: baseReal.id,
        values: [expect.objectContaining({ value: "Real" })],
      }),
      expect.objectContaining({
        target_kind: "planning_item",
        target_id: basePlanned.id,
        values: [expect.objectContaining({ value: "Planificada" })],
      }),
    ]);
  });

  it("does not include assignments for planned rows removed by report filters", () => {
    const field = assignmentField({ id: 302, assignment_type_id: 31, slug: "equipo", label: "Equipo", input_type: "text" });
    const type = assignmentType({ id: 31, slug: "maquinaria", label: "Maquinaria", fields: [field] });
    const report = buildReportFromSourceRows(
      { ...emptyQuery, shift: "Noche" },
      [basePlanned],
      [],
      {
        types: [type],
        assignments: [
          planningAssignment({
            id: 3002,
            planning_item_id: basePlanned.id,
            assignment_type_id: type.id,
            values: [assignmentValue({ assignment_id: 3002, field_id: field.id, value_text: "Jumbo 1" })],
          }),
        ],
      }
    );

    expect(report.rows).toEqual([]);
    expect(report.assignment_rows).toEqual([]);
  });

  it("serializes assignment select, multi-select and boolean values", () => {
    const selectField = assignmentField({
      id: 303,
      assignment_type_id: 32,
      slug: "estado",
      label: "Estado",
      input_type: "select",
      sort_order: 100,
      options: [{ id: 701, field_id: 303, value: "ok", label: "Operativo", active: true, sort_order: 100, metadata: {} }],
    });
    const multiField = assignmentField({
      id: 304,
      assignment_type_id: 32,
      slug: "roles",
      label: "Roles",
      input_type: "multi_select",
      sort_order: 200,
      options: [
        { id: 801, field_id: 304, value: "operador", label: "Operador", active: true, sort_order: 100, metadata: {} },
        { id: 802, field_id: 304, value: "lorero", label: "Lorero", active: true, sort_order: 200, metadata: {} },
      ],
    });
    const booleanField = assignmentField({ id: 305, assignment_type_id: 32, slug: "validado", label: "Validado", input_type: "boolean", sort_order: 300 });
    const type = assignmentType({ id: 32, slug: "dotacion", label: "Dotacion", fields: [selectField, multiField, booleanField] });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [baseReal], {
      types: [type],
      assignments: [
        planningAssignment({
          id: 3003,
          planning_item_id: basePlanned.id,
          assignment_type_id: type.id,
          values: [
            assignmentValue({ id: 4003, assignment_id: 3003, field_id: selectField.id, option_id: 701 }),
            assignmentValue({ id: 4004, assignment_id: 3003, field_id: multiField.id, option_id: 801 }),
            assignmentValue({ id: 4005, assignment_id: 3003, field_id: multiField.id, option_id: 802 }),
            assignmentValue({ id: 4006, assignment_id: 3003, field_id: booleanField.id, value_boolean: false }),
          ],
        }),
      ],
    });

    expect(report.assignment_rows?.[0]?.values).toMatchObject([
      { field_slug: "estado", value: "Operativo", raw_value: "ok" },
      { field_slug: "roles", value: "Operador, Lorero", raw_value: ["operador", "lorero"] },
      { field_slug: "validado", value: "No", raw_value: false },
    ]);
  });

  it("keeps inactive assignment catalog values when the service supplies historical metadata", () => {
    const field = assignmentField({
      id: 306,
      assignment_type_id: 33,
      slug: "cantidad",
      label: "Cantidad",
      input_type: "number",
      active: false,
      config: { suffix: "personas" },
    });
    const type = assignmentType({ id: 33, slug: "historico", label: "Historico", active: false, fields: [field] });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      types: [type],
      assignments: [
        planningAssignment({
          id: 3004,
          planning_item_id: basePlanned.id,
          assignment_type_id: type.id,
          values: [assignmentValue({ assignment_id: 3004, field_id: field.id, value_number: 4 })],
        }),
      ],
    });

    expect(report.assignment_rows?.[0]).toMatchObject({
      assignment_type_slug: "historico",
      values: [{ field_slug: "cantidad", value: "4 personas", raw_value: 4 }],
    });
  });
});
