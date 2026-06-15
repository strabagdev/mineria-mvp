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
import type {
  ReportAssignmentRow,
  ReportCustomFieldColumn,
  ReportCustomFieldValue,
  ReportRow,
} from "../contracts/reporting";

export type ReportSourceQuery = {
  shift: string;
  level: string;
  front: string;
  category: string;
  trackingType: string;
  itemType: string;
};

export type PlannedReportSourceRow = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
  tracking_type: "programado";
};

export type RealReportSourceRow = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
};

type ReportBreakdownKey = "level" | "shift" | "front" | "category" | "tracking_type" | "item_type";
type ReportCustomFieldTargetKind = "planning_item" | "execution_segment" | "activity_group";
type ReportCustomFieldValuesByTarget = Map<string, Map<number, PlanningCustomFieldValueDto[]>>;

export type ReportCustomFieldInput = {
  fields: PlanningCustomFieldDto[];
  values: PlanningCustomFieldValueDto[];
};

export type ReportAssignmentInput = {
  types: AssignmentTypeDto[];
  assignments: PlanningAssignmentDto[];
};

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function getReportDurationMinutes(startTime: string, endTime: string) {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);

  if (end <= start) {
    end += 24 * 60;
  }

  return Math.max(0, end - start);
}

function matchesOptionalFilter(value: string, filter: string) {
  return !filter || value === filter;
}

function matchesFront(value: string, filter: string) {
  return !filter || value.toLowerCase().includes(filter.toLowerCase());
}

function groupTotals(rows: ReportRow[], key: ReportBreakdownKey) {
  const totals = new Map<string, { label: string; count: number; hours: number }>();

  for (const row of rows) {
    const label = String(row[key] ?? "");
    const current = totals.get(label) ?? { label, count: 0, hours: 0 };
    current.count += 1;
    current.hours += row.duration_minutes / 60;
    totals.set(label, current);
  }

  return Array.from(totals.values()).sort((left, right) => {
    if (right.hours !== left.hours) {
      return right.hours - left.hours;
    }

    return left.label.localeCompare(right.label);
  });
}

function getCustomFieldTargetKey(kind: ReportCustomFieldTargetKind, id: number | string) {
  return `${kind}:${id}`;
}

function indexCustomFieldValues(values: PlanningCustomFieldValueDto[]) {
  const valuesByTarget: ReportCustomFieldValuesByTarget = new Map();

  for (const value of values) {
    const targetKeys = [
      value.planning_item_id
        ? getCustomFieldTargetKey("planning_item", value.planning_item_id)
        : "",
      value.execution_segment_id
        ? getCustomFieldTargetKey("execution_segment", value.execution_segment_id)
        : "",
      value.activity_group_id
        ? getCustomFieldTargetKey("activity_group", value.activity_group_id)
        : "",
    ].filter(Boolean);

    for (const targetKey of targetKeys) {
      const valuesByField = valuesByTarget.get(targetKey) ?? new Map<number, PlanningCustomFieldValueDto[]>();
      valuesByField.set(value.field_id, [...(valuesByField.get(value.field_id) ?? []), value]);
      valuesByTarget.set(targetKey, valuesByField);
    }
  }

  return valuesByTarget;
}

function getReportCustomFieldValuesForRow(
  row: ReportRow,
  fieldId: number,
  valuesByTarget: ReportCustomFieldValuesByTarget
) {
  const specificTargetKey = row.source_table === "planning_items"
    ? getCustomFieldTargetKey("planning_item", row.id)
    : getCustomFieldTargetKey("execution_segment", row.id);
  const groupTargetKey = row.activity_group_id
    ? getCustomFieldTargetKey("activity_group", row.activity_group_id)
    : "";
  const specificValues = valuesByTarget.get(specificTargetKey)?.get(fieldId) ?? [];

  if (specificValues.length) {
    return specificValues;
  }

  return groupTargetKey ? valuesByTarget.get(groupTargetKey)?.get(fieldId) ?? [] : [];
}

function getOptionLabels(field: PlanningCustomFieldDto, values: PlanningCustomFieldValueDto[]) {
  return values
    .map((value) => field.options.find((option) => option.id === value.option_id)?.label)
    .filter((label): label is string => Boolean(label));
}

function getOptionRawValues(field: PlanningCustomFieldDto, values: PlanningCustomFieldValueDto[]) {
  return values
    .map((value) => {
      const option = field.options.find((candidate) => candidate.id === value.option_id);
      return option?.value ?? option?.label ?? (value.option_id ? String(value.option_id) : "");
    })
    .filter(Boolean);
}

function serializeReportCustomFieldValue(
  field: PlanningCustomFieldDto,
  values: PlanningCustomFieldValueDto[]
): ReportCustomFieldValue | null {
  if (!values.length) {
    return null;
  }

  if (field.input_type === "select") {
    const label = getOptionLabels(field, values)[0] ?? "";
    const rawValue = getOptionRawValues(field, values)[0] ?? null;
    if (!label && rawValue === null) return null;
    return { field_id: field.id, slug: field.slug, label: field.label, value: label || String(rawValue), raw_value: rawValue };
  }

  if (field.input_type === "multi_select") {
    const labels = getOptionLabels(field, values);
    const rawValues = getOptionRawValues(field, values);
    if (!labels.length && !rawValues.length) return null;
    return {
      field_id: field.id,
      slug: field.slug,
      label: field.label,
      value: labels.length ? labels.join(", ") : rawValues.join(", "),
      raw_value: rawValues,
    };
  }

  const value = values[0];

  if (field.input_type === "number") {
    if (value.value_number === null) return null;
    return { field_id: field.id, slug: field.slug, label: field.label, value: String(value.value_number), raw_value: value.value_number };
  }

  if (field.input_type === "date") {
    if (!value.value_date) return null;
    return { field_id: field.id, slug: field.slug, label: field.label, value: value.value_date, raw_value: value.value_date };
  }

  if (field.input_type === "boolean") {
    if (value.value_boolean === null) return null;
    return {
      field_id: field.id,
      slug: field.slug,
      label: field.label,
      value: value.value_boolean ? "Sí" : "No",
      raw_value: value.value_boolean,
    };
  }

  if (!value.value_text) return null;
  return { field_id: field.id, slug: field.slug, label: field.label, value: value.value_text, raw_value: value.value_text };
}

function applyCustomFieldsToRows(rows: ReportRow[], customFields?: ReportCustomFieldInput) {
  if (!customFields?.fields.length || !customFields.values.length) {
    return { rows, customFieldColumns: [] };
  }

  const fieldsById = new Map(customFields.fields.map((field) => [field.id, field]));
  const valuesByTarget = indexCustomFieldValues(customFields.values);
  const columnsByFieldId = new Map<number, ReportCustomFieldColumn>();
  const rowsWithCustomFields = rows.map((row): ReportRow => {
    const rowCustomFields: Record<string, ReportCustomFieldValue> = {};

    for (const field of customFields.fields) {
      const values = getReportCustomFieldValuesForRow(row, field.id, valuesByTarget);
      const serialized = serializeReportCustomFieldValue(field, values);

      if (!serialized) {
        continue;
      }

      rowCustomFields[field.slug] = serialized;
      if (!columnsByFieldId.has(field.id) && fieldsById.has(field.id)) {
        columnsByFieldId.set(field.id, {
          id: field.id,
          slug: field.slug,
          label: field.label,
          input_type: field.input_type,
          active: field.active,
        });
      }
    }

    return Object.keys(rowCustomFields).length
      ? { ...row, custom_fields: rowCustomFields }
      : row;
  });

  return {
    rows: rowsWithCustomFields,
    customFieldColumns: Array.from(columnsByFieldId.values()),
  };
}

function indexAssignmentCatalog(types: AssignmentTypeDto[]) {
  const typeById = new Map(types.map((type) => [type.id, type]));
  const fieldById = new Map<number, AssignmentFieldDto>();

  for (const type of types) {
    for (const field of type.fields) {
      fieldById.set(field.id, field);
    }
  }

  return { typeById, fieldById };
}

function getAssignmentOptionRawValue(field: AssignmentFieldDto, value: PlanningAssignmentValueDto) {
  const option = field.options.find((candidate) => candidate.id === value.option_id);
  return option?.value ?? option?.label ?? (value.option_id ? String(value.option_id) : "");
}

function getAssignmentOptionLabel(field: AssignmentFieldDto, value: PlanningAssignmentValueDto) {
  const option = field.options.find((candidate) => candidate.id === value.option_id);
  return option?.label ?? getAssignmentOptionRawValue(field, value);
}

function applyAssignmentValueSuffix(field: AssignmentFieldDto, value: string) {
  const suffix = typeof field.config.suffix === "string" ? field.config.suffix.trim() : "";
  return suffix && value ? `${value} ${suffix}` : value;
}

function serializeReportAssignmentValue(
  field: AssignmentFieldDto,
  values: PlanningAssignmentValueDto[]
): ReportAssignmentRow["values"][number] | null {
  if (!values.length) {
    return null;
  }

  if (field.input_type === "select") {
    const label = getAssignmentOptionLabel(field, values[0]);
    const rawValue = getAssignmentOptionRawValue(field, values[0]) || null;
    if (!label && rawValue === null) return null;
    return {
      field_id: field.id,
      field_slug: field.slug,
      field_label: field.label,
      input_type: field.input_type,
      value: label,
      raw_value: rawValue,
    };
  }

  if (field.input_type === "multi_select") {
    const labels = values.map((value) => getAssignmentOptionLabel(field, value)).filter(Boolean);
    const rawValues = values.map((value) => getAssignmentOptionRawValue(field, value)).filter(Boolean);
    if (!labels.length && !rawValues.length) return null;
    return {
      field_id: field.id,
      field_slug: field.slug,
      field_label: field.label,
      input_type: field.input_type,
      value: labels.length ? labels.join(", ") : rawValues.join(", "),
      raw_value: rawValues,
    };
  }

  const value = values[0];

  if (field.input_type === "number") {
    if (value.value_number === null) return null;
    return {
      field_id: field.id,
      field_slug: field.slug,
      field_label: field.label,
      input_type: field.input_type,
      value: applyAssignmentValueSuffix(field, String(value.value_number)),
      raw_value: value.value_number,
    };
  }

  if (field.input_type === "date") {
    if (!value.value_date) return null;
    return {
      field_id: field.id,
      field_slug: field.slug,
      field_label: field.label,
      input_type: field.input_type,
      value: value.value_date,
      raw_value: value.value_date,
    };
  }

  if (field.input_type === "boolean") {
    if (value.value_boolean === null) return null;
    return {
      field_id: field.id,
      field_slug: field.slug,
      field_label: field.label,
      input_type: field.input_type,
      value: value.value_boolean ? "Sí" : "No",
      raw_value: value.value_boolean,
    };
  }

  if (!value.value_text) return null;
  return {
    field_id: field.id,
    field_slug: field.slug,
    field_label: field.label,
    input_type: field.input_type,
    value: applyAssignmentValueSuffix(field, value.value_text),
    raw_value: value.value_text,
  };
}

function buildReportAssignmentRows(
  rows: ReportRow[],
  assignmentsInput?: ReportAssignmentInput
): ReportAssignmentRow[] {
  if (!assignmentsInput?.types.length || !assignmentsInput.assignments.length) {
    return [];
  }

  const includedPlanningItemIds = new Set(
    rows
      .filter((row) => row.source_table === "planning_items")
      .map((row) => row.id)
  );
  if (!includedPlanningItemIds.size) {
    return [];
  }

  const { typeById, fieldById } = indexAssignmentCatalog(assignmentsInput.types);

  return assignmentsInput.assignments
    .filter((assignment) => includedPlanningItemIds.has(assignment.planning_item_id))
    .map((assignment): ReportAssignmentRow | null => {
      const type = typeById.get(assignment.assignment_type_id);
      if (!type) {
        return null;
      }

      const valuesByField = new Map<number, PlanningAssignmentValueDto[]>();
      for (const value of assignment.values) {
        valuesByField.set(value.field_id, [...(valuesByField.get(value.field_id) ?? []), value]);
      }

      const values = type.fields
        .map((field) => serializeReportAssignmentValue(field, valuesByField.get(field.id) ?? []))
        .filter((value): value is ReportAssignmentRow["values"][number] => Boolean(value));

      for (const [fieldId, fieldValues] of valuesByField) {
        const field = fieldById.get(fieldId);
        if (!field || type.fields.some((candidate) => candidate.id === fieldId)) {
          continue;
        }

        const serialized = serializeReportAssignmentValue(field, fieldValues);
        if (serialized) {
          values.push(serialized);
        }
      }

      values.sort((left, right) => {
        const leftField = fieldById.get(left.field_id);
        const rightField = fieldById.get(right.field_id);
        const sortDelta = (leftField?.sort_order ?? 0) - (rightField?.sort_order ?? 0);
        return sortDelta || left.field_id - right.field_id;
      });

      return {
        planning_item_id: assignment.planning_item_id,
        assignment_id: assignment.id,
        assignment_type_id: type.id,
        assignment_type_slug: type.slug,
        assignment_type_label: type.label,
        assignment_type_icon_key: type.icon_key,
        instance_order: assignment.instance_order,
        values,
      };
    })
    .filter((row): row is ReportAssignmentRow => Boolean(row))
    .sort((left, right) =>
      left.planning_item_id - right.planning_item_id
      || left.assignment_type_id - right.assignment_type_id
      || left.instance_order - right.instance_order
      || left.assignment_id - right.assignment_id
    );
}

function mapPlannedRow(row: PlannedReportSourceRow): ReportRow {
  return {
    id: row.id,
    source_table: "planning_items" as const,
    activity_group_id: row.activity_group_id,
    item_date: row.item_date,
    start_time: row.start_time.slice(0, 5),
    end_time: row.end_time.slice(0, 5),
    shift: row.shift,
    level: row.level,
    front: row.front,
    category: row.category,
    tracking_type: "programado" as const,
    item_type: row.item_type,
    description: row.description,
    notes: row.notes ?? null,
    duration_minutes: getReportDurationMinutes(row.start_time, row.end_time),
  };
}

function mapRealRow(row: RealReportSourceRow): ReportRow {
  return {
    id: row.id,
    source_table: "activity_execution_segments" as const,
    activity_group_id: row.activity_group_id,
    item_date: row.item_date,
    start_time: row.start_time.slice(0, 5),
    end_time: row.end_time.slice(0, 5),
    shift: row.shift,
    level: row.level,
    front: row.front,
    category: row.category,
    tracking_type: "real" as const,
    item_type: row.item_type,
    description: row.description,
    notes: row.notes ?? null,
    duration_minutes: getReportDurationMinutes(row.start_time, row.end_time),
  };
}

export function buildReportFromSourceRows(
  query: ReportSourceQuery,
  planningRows: PlannedReportSourceRow[],
  realRows: RealReportSourceRow[],
  customFields?: ReportCustomFieldInput,
  assignmentsInput?: ReportAssignmentInput
) {
  const baseRows: ReportRow[] = [
    ...planningRows.map(mapPlannedRow),
    ...realRows.map(mapRealRow),
  ]
    .filter((row) => matchesOptionalFilter(row.shift, query.shift))
    .filter((row) => matchesOptionalFilter(row.level, query.level))
    .filter((row) => matchesOptionalFilter(row.category, query.category))
    .filter((row) => matchesOptionalFilter(row.tracking_type, query.trackingType))
    .filter((row) => matchesOptionalFilter(row.item_type, query.itemType))
    .filter((row) => matchesFront(row.front, query.front))
    .sort((left, right) =>
      `${right.item_date}-${right.start_time}-${right.id}`.localeCompare(
        `${left.item_date}-${left.start_time}-${left.id}`
      )
    );
  const { rows, customFieldColumns } = applyCustomFieldsToRows(baseRows, customFields);
  const assignmentRows = buildReportAssignmentRows(rows, assignmentsInput);

  const plannedRowsFiltered = rows.filter((row) => row.tracking_type === "programado");
  const realRowsFiltered = rows.filter((row) => row.tracking_type === "real");
  const plannedMinutes = plannedRowsFiltered.reduce((sum, row) => sum + row.duration_minutes, 0);
  const realMinutes = realRowsFiltered.reduce((sum, row) => sum + row.duration_minutes, 0);
  const interferenceRows = rows.filter((row) => row.category === "interferencia");
  const interferenceMinutes = interferenceRows.reduce((sum, row) => sum + row.duration_minutes, 0);
  const plannedHours = plannedMinutes / 60;
  const realHours = realMinutes / 60;
  const interferenceHours = interferenceMinutes / 60;
  const varianceHours = realHours - plannedHours;

  return {
    rows,
    summary: {
      total_records: rows.length,
      total_programados: plannedRowsFiltered.length,
      total_reales: realRowsFiltered.length,
      total_interferencias: interferenceRows.length,
      horas_programadas: plannedHours,
      horas_reales: realHours,
      horas_interferencias: interferenceHours,
      diferencia_horas_real_vs_programado: varianceHours,
      planned_records: plannedRowsFiltered.length,
      real_records: realRowsFiltered.length,
      interference_records: interferenceRows.length,
      planned_hours: plannedHours,
      real_hours: realHours,
      variance_hours: varianceHours,
    },
    custom_field_columns: customFieldColumns,
    assignment_rows: assignmentRows,
    breakdowns: {
      by_level: groupTotals(rows, "level"),
      by_shift: groupTotals(rows, "shift"),
      by_front: groupTotals(rows, "front"),
      by_category: groupTotals(rows, "category"),
      by_tracking_type: groupTotals(rows, "tracking_type"),
      by_item_type: groupTotals(rows, "item_type"),
    },
  };
}
