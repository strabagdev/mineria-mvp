import { describe, expect, it } from "vitest";
import { buildReportFromSourceRows, getReportDurationMinutes } from "../../modules/reporting/application/reporting-calculations";
import type {
  PlanningCustomFieldDto,
  PlanningCustomFieldValueDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import type {
  AssignmentFieldDto,
  AssignmentTypeDto,
  PlanningAssignmentDto,
  PlanningAssignmentValueDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import type { PlannedReportRow, RealReportRow } from "../repositories/reports.repository";

const basePlanned: PlannedReportRow = {
  id: 1,
  activity_group_id: "group-1",
  item_date: "2026-06-01",
  start_time: "08:00:00",
  end_time: "10:00:00",
  shift: "Dia",
  level: "Nivel 1",
  front: "Frente A",
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
  level: "Nivel 1",
  front: "Frente A",
  category: "actividad",
  item_type: "desarrollo",
  description: "Excavacion real",
  notes: null,
};

const emptyQuery = {
  shift: "",
  level: "",
  front: "",
  category: "",
  trackingType: "",
  itemType: "",
};

function customField(input: Partial<PlanningCustomFieldDto> & Pick<PlanningCustomFieldDto, "id" | "slug" | "label" | "input_type">): PlanningCustomFieldDto {
  return {
    icon_key: null,
    active: true,
    required: false,
    applies_to: "both",
    sort_order: 100,
    config: {},
    options: [],
    ...input,
  };
}

function customFieldValue(input: Partial<PlanningCustomFieldValueDto> & Pick<PlanningCustomFieldValueDto, "field_id">): PlanningCustomFieldValueDto {
  return {
    id: 1,
    planning_item_id: null,
    execution_segment_id: null,
    activity_group_id: null,
    option_id: null,
    value_text: null,
    value_number: null,
    value_date: null,
    value_boolean: null,
    value_json: {},
    ...input,
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
    expect(report.custom_field_columns).toEqual([]);
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

  it("counts real rows, interferences, hours and front/type breakdowns", () => {
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
    expect(report.breakdowns.by_front).toEqual([{ label: "Frente A", count: 3, hours: 4.75 }]);
    expect(report.breakdowns.by_item_type).toEqual([
      { label: "desarrollo", count: 2, hours: 3.25 },
      { label: "espera", count: 1, hours: 1.5 },
    ]);
  });

  it("handles records crossing midnight", () => {
    expect(getReportDurationMinutes("23:30:00", "01:00:00")).toBe(90);
  });

  it("applies date-independent filters by shift, level and front", () => {
    const nightReal: RealReportRow = {
      ...baseReal,
      id: 12,
      item_date: "2026-06-02",
      start_time: "21:00:00",
      end_time: "22:00:00",
      shift: "Noche",
      level: "Nivel 2",
      front: "Frente B",
    };

    const report = buildReportFromSourceRows(
      { ...emptyQuery, shift: "Noche", level: "Nivel 2", front: "b" },
      [basePlanned],
      [baseReal, nightReal]
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ id: 12, shift: "Noche", level: "Nivel 2", front: "Frente B" });
  });

  it("adds a planning item custom field to a planned row", () => {
    const field = customField({ id: 20, slug: "contratista", label: "Contratista", input_type: "text" });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [customFieldValue({ id: 200, field_id: field.id, planning_item_id: basePlanned.id, value_text: "Equipo Norte" })],
    });

    expect(report.rows[0]?.custom_fields?.contratista).toEqual({
      field_id: field.id,
      slug: "contratista",
      label: "Contratista",
      value: "Equipo Norte",
      raw_value: "Equipo Norte",
    });
    expect(report.custom_field_columns).toEqual([
      { id: field.id, slug: "contratista", label: "Contratista", input_type: "text", active: true },
    ]);
  });

  it("adds an execution segment custom field to a real row", () => {
    const field = customField({ id: 21, slug: "metros", label: "Metros", input_type: "number" });
    const report = buildReportFromSourceRows(emptyQuery, [], [baseReal], {
      fields: [field],
      values: [customFieldValue({ id: 201, field_id: field.id, execution_segment_id: baseReal.id, value_number: 12.5 })],
    });

    expect(report.rows[0]?.custom_fields?.metros).toMatchObject({
      value: "12.5",
      raw_value: 12.5,
    });
  });

  it("uses activity group custom fields as fallback for planned and real rows", () => {
    const field = customField({ id: 22, slug: "area", label: "Area", input_type: "text" });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [baseReal], {
      fields: [field],
      values: [customFieldValue({ id: 202, field_id: field.id, activity_group_id: "group-1", value_text: "Rampa" })],
    });

    expect(report.rows).toHaveLength(2);
    expect(report.rows.every((row) => row.custom_fields?.area?.value === "Rampa")).toBe(true);
  });

  it("prefers row-specific custom fields over activity group fallback", () => {
    const field = customField({ id: 23, slug: "estado", label: "Estado", input_type: "text" });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [
        customFieldValue({ id: 203, field_id: field.id, activity_group_id: "group-1", value_text: "Grupo" }),
        customFieldValue({ id: 204, field_id: field.id, planning_item_id: basePlanned.id, value_text: "Especifico" }),
      ],
    });

    expect(report.rows[0]?.custom_fields?.estado?.value).toBe("Especifico");
  });

  it("serializes select custom fields with option label and raw value", () => {
    const field = customField({
      id: 24,
      slug: "turno-extra",
      label: "Turno extra",
      input_type: "select",
      options: [{ id: 501, field_id: 24, value: "si", label: "Sí aplica", active: false, sort_order: 100, metadata: {} }],
    });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [customFieldValue({ id: 205, field_id: field.id, planning_item_id: basePlanned.id, option_id: 501 })],
    });

    expect(report.rows[0]?.custom_fields?.["turno-extra"]).toMatchObject({
      value: "Sí aplica",
      raw_value: "si",
    });
  });

  it("serializes multi-select custom fields as joined labels and raw array", () => {
    const field = customField({
      id: 25,
      slug: "equipos",
      label: "Equipos",
      input_type: "multi_select",
      options: [
        { id: 601, field_id: 25, value: "jumbo", label: "Jumbo", active: true, sort_order: 100, metadata: {} },
        { id: 602, field_id: 25, value: "shotcrete", label: "Shotcrete", active: true, sort_order: 200, metadata: {} },
      ],
    });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [
        customFieldValue({ id: 206, field_id: field.id, planning_item_id: basePlanned.id, option_id: 601 }),
        customFieldValue({ id: 207, field_id: field.id, planning_item_id: basePlanned.id, option_id: 602 }),
      ],
    });

    expect(report.rows[0]?.custom_fields?.equipos).toMatchObject({
      value: "Jumbo, Shotcrete",
      raw_value: ["jumbo", "shotcrete"],
    });
  });

  it("serializes boolean custom fields with Sí and No display values", () => {
    const field = customField({ id: 26, slug: "requiere-corte", label: "Requiere corte", input_type: "boolean" });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [customFieldValue({ id: 208, field_id: field.id, planning_item_id: basePlanned.id, value_boolean: false })],
    });

    expect(report.rows[0]?.custom_fields?.["requiere-corte"]).toMatchObject({
      value: "No",
      raw_value: false,
    });
  });

  it("includes inactive custom field columns when they have historical values", () => {
    const field = customField({ id: 27, slug: "historico", label: "Historico", input_type: "date", active: false });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [customFieldValue({ id: 209, field_id: field.id, planning_item_id: basePlanned.id, value_date: "2026-06-01" })],
    });

    expect(report.custom_field_columns).toEqual([
      { id: field.id, slug: "historico", label: "Historico", input_type: "date", active: false },
    ]);
  });

  it("keeps rows without custom fields compatible when no values are present", () => {
    const field = customField({ id: 28, slug: "sin-valor", label: "Sin valor", input_type: "text" });
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], {
      fields: [field],
      values: [],
    });

    expect(report.rows[0]?.custom_fields).toBeUndefined();
    expect(report.custom_field_columns).toEqual([]);
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

    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], undefined, {
      types: [type],
      assignments: [assignment],
    });

    expect(report.rows[0]?.custom_fields).toBeUndefined();
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

    const report = buildReportFromSourceRows(emptyQuery, [], [baseReal], undefined, {
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

    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [baseReal], undefined, {
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
      undefined,
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
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [baseReal], undefined, {
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
    const report = buildReportFromSourceRows(emptyQuery, [basePlanned], [], undefined, {
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
