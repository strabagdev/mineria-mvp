import type {
  OperationalHeaderFieldDto,
  OperationalHeaderValueDto,
} from "@/modules/operational-header/contracts/operational-header";
import type {
  AssignmentFieldDto,
  AssignmentTypeDto,
  PlanningAssignmentDto,
  PlanningAssignmentValueDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import type {
  ReportAssignmentRow,
  ReportOperationalHeaderColumn,
  ReportOperationalHeaderValue,
  ReportRow,
} from "../contracts/reporting";
import {
  getOperationalHeaderBreakdownFields,
  getOperationalHeaderExportableFields,
  getOperationalHeaderFilterableFields,
  sortOperationalHeaderReportFields,
  toOperationalHeaderReportColumn,
} from "./reporting-operational-header";

export type ReportSourceQuery = {
  shift: string;
  category: string;
  trackingType: string;
  itemType: string;
  operational_header_filters?: Record<string, string>;
};

export type PlannedReportSourceRow = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
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
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
};

type ReportBreakdownKey = "shift" | "category" | "tracking_type" | "item_type";
type ReportOperationalHeaderTargetKind = "planning_item" | "execution_segment" | "activity_group";
type ReportAssignmentTargetKind = ReportAssignmentRow["target_kind"];
type ReportOperationalHeaderValuesByTarget = Map<string, Map<number, OperationalHeaderValueDto>>;

export type ReportOperationalHeaderInput = {
  fields: OperationalHeaderFieldDto[];
  values: OperationalHeaderValueDto[];
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

function matchesOperationalHeaderFilter(
  row: ReportRow,
  column: ReportOperationalHeaderColumn,
  filter: string
) {
  const normalizedFilter = filter.trim();

  if (!normalizedFilter) {
    return true;
  }

  const value = row.operational_header_values?.[column.slug]?.value ?? "";

  if (column.input_type === "select") {
    return value === normalizedFilter;
  }

  return value.toLowerCase().includes(normalizedFilter.toLowerCase());
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

function groupOperationalHeaderTotals(
  rows: ReportRow[],
  column: ReportOperationalHeaderColumn
) {
  const totals = new Map<string, { label: string; count: number; hours: number }>();

  for (const row of rows) {
    const label = row.operational_header_values?.[column.slug]?.value || "Sin valor";
    const current = totals.get(label) ?? { label, count: 0, hours: 0 };
    current.count += 1;
    current.hours += row.duration_minutes / 60;
    totals.set(label, current);
  }

  return Array.from(totals.values()).sort((left, right) => {
    if (right.hours !== left.hours) {
      return right.hours - left.hours;
    }

    if (left.label === "Sin valor") return 1;
    if (right.label === "Sin valor") return -1;

    return left.label.localeCompare(right.label);
  });
}

function getOperationalHeaderTargetKey(kind: ReportOperationalHeaderTargetKind, id: number | string) {
  return `${kind}:${id}`;
}

function getReportAssignmentTargetKey(kind: ReportAssignmentTargetKind, id: number) {
  return `${kind}:${id}`;
}

function getReportRowAssignmentTarget(row: ReportRow) {
  return row.source_table === "planning_items"
    ? { target_kind: "planning_item" as const, target_id: row.id }
    : { target_kind: "execution_segment" as const, target_id: row.id };
}

function getPlanningAssignmentTarget(assignment: PlanningAssignmentDto) {
  if (assignment.planning_item_id !== null) {
    return { target_kind: "planning_item" as const, target_id: assignment.planning_item_id };
  }

  if (assignment.execution_segment_id !== null) {
    return { target_kind: "execution_segment" as const, target_id: assignment.execution_segment_id };
  }

  return null;
}

function indexOperationalHeaderValues(values: OperationalHeaderValueDto[]) {
  const valuesByTarget: ReportOperationalHeaderValuesByTarget = new Map();

  for (const value of values) {
    const targetKeys = [
      value.planning_item_id
        ? getOperationalHeaderTargetKey("planning_item", value.planning_item_id)
        : "",
      value.execution_segment_id
        ? getOperationalHeaderTargetKey("execution_segment", value.execution_segment_id)
        : "",
      value.activity_group_id
        ? getOperationalHeaderTargetKey("activity_group", value.activity_group_id)
        : "",
    ].filter(Boolean);

    for (const targetKey of targetKeys) {
      const valuesByField = valuesByTarget.get(targetKey) ?? new Map<number, OperationalHeaderValueDto>();
      valuesByField.set(value.field_id, value);
      valuesByTarget.set(targetKey, valuesByField);
    }
  }

  return valuesByTarget;
}

function getOperationalHeaderValueForRow(
  row: ReportRow,
  fieldId: number,
  valuesByTarget: ReportOperationalHeaderValuesByTarget
) {
  const specificTargetKey = row.source_table === "planning_items"
    ? getOperationalHeaderTargetKey("planning_item", row.id)
    : getOperationalHeaderTargetKey("execution_segment", row.id);
  const groupTargetKey = row.activity_group_id
    ? getOperationalHeaderTargetKey("activity_group", row.activity_group_id)
    : "";

  return valuesByTarget.get(specificTargetKey)?.get(fieldId) ??
    (groupTargetKey ? valuesByTarget.get(groupTargetKey)?.get(fieldId) : undefined) ??
    null;
}

function serializeOperationalHeaderValue(
  field: OperationalHeaderFieldDto,
  value: OperationalHeaderValueDto | null
): ReportOperationalHeaderValue | null {
  const option = value?.option_id
    ? field.options.find((candidate) => candidate.id === value.option_id)
    : value?.value_text
      ? field.options.find((candidate) =>
        candidate.value.trim().toLowerCase() === value.value_text?.trim().toLowerCase() ||
        candidate.label.trim().toLowerCase() === value.value_text?.trim().toLowerCase()
      )
      : null;
  const displayValue = option?.label || option?.value || value?.value_text || "";

  if (!displayValue) {
    return null;
  }

  return {
    field_id: field.id,
    slug: field.slug,
    label: field.label,
    value: displayValue,
    option_id: value?.option_id,
  };
}

function applyOperationalHeaderToRows(rows: ReportRow[], operationalHeader?: ReportOperationalHeaderInput) {
  const fields = operationalHeader?.fields ?? [];
  const exportableFields = getOperationalHeaderExportableFields(fields);
  const filterableFields = getOperationalHeaderFilterableFields(fields);
  const valueFields = sortOperationalHeaderReportFields(Array.from(new Map(
    [...exportableFields, ...filterableFields].map((field) => [field.id, field])
  ).values()));
  const columns = exportableFields.map(toOperationalHeaderReportColumn);
  const filterColumns = filterableFields.map(toOperationalHeaderReportColumn);

  if (!operationalHeader || !valueFields.length) {
    return { rows, operationalHeaderColumns: [], operationalHeaderFilterColumns: [] };
  }

  const valuesByTarget = indexOperationalHeaderValues(operationalHeader.values);
  const rowsWithOperationalHeader = rows.map((row): ReportRow => {
    const rowValues: Record<string, ReportOperationalHeaderValue> = {};

    for (const field of valueFields) {
      const value = serializeOperationalHeaderValue(
        field,
        getOperationalHeaderValueForRow(row, field.id, valuesByTarget)
      );

      if (value) {
        rowValues[field.slug] = value;
      }
    }

    return { ...row, operational_header_values: rowValues };
  });

  return {
    rows: rowsWithOperationalHeader,
    operationalHeaderColumns: columns,
    operationalHeaderFilterColumns: filterColumns,
  };
}

function projectOperationalHeaderRowsToColumns(
  rows: ReportRow[],
  columns: ReportOperationalHeaderColumn[]
) {
  const exportableSlugs = new Set(columns.map((column) => column.slug));

  return rows.map((row): ReportRow => {
    const exportedValues = Object.fromEntries(
      Object.entries(row.operational_header_values ?? {})
        .filter(([slug]) => exportableSlugs.has(slug))
    );

    return { ...row, operational_header_values: exportedValues };
  });
}

function getOperationalHeaderFilterColumns(columns: ReportOperationalHeaderColumn[]) {
  return new Map(columns.map((column) => [column.slug, column]));
}

function getOperationalHeaderFilters(query: ReportSourceQuery) {
  const filters: Record<string, string> = {};

  for (const [slug, value] of Object.entries(query.operational_header_filters ?? {})) {
    const normalizedValue = value.trim();
    if (normalizedValue) {
      filters[slug] = normalizedValue;
    }
  }

  return filters;
}

function applyOperationalHeaderFilters(
  rows: ReportRow[],
  columns: ReportOperationalHeaderColumn[],
  query: ReportSourceQuery
) {
  const columnsBySlug = getOperationalHeaderFilterColumns(columns);
  const filters = getOperationalHeaderFilters(query);
  const entries = Object.entries(filters).filter(([slug]) => columnsBySlug.has(slug));

  if (!entries.length) {
    return rows;
  }

  return rows.filter((row) =>
    entries.every(([slug, filter]) => {
      const column = columnsBySlug.get(slug);

      if (column) {
        return matchesOperationalHeaderFilter(row, column, filter);
      }

      return false;
    })
  );
}

function buildOperationalHeaderBreakdowns(
  rows: ReportRow[],
  columns: ReportOperationalHeaderColumn[],
  operationalHeader?: ReportOperationalHeaderInput
) {
  const groupableSlugs = new Set(
    getOperationalHeaderBreakdownFields(operationalHeader?.fields ?? []).map((field) => field.slug)
  );
  const breakdowns: Record<string, ReturnType<typeof groupOperationalHeaderTotals>> = {};

  for (const column of columns) {
    if (groupableSlugs.has(column.slug)) {
      breakdowns[column.slug] = groupOperationalHeaderTotals(rows, column);
    }
  }

  return breakdowns;
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

  const includedTargetKeys = new Set(
    rows.map((row) => {
      const target = getReportRowAssignmentTarget(row);
      return getReportAssignmentTargetKey(target.target_kind, target.target_id);
    })
  );
  if (!includedTargetKeys.size) {
    return [];
  }

  const { typeById, fieldById } = indexAssignmentCatalog(assignmentsInput.types);

  return assignmentsInput.assignments
    .map((assignment): ReportAssignmentRow | null => {
      const target = getPlanningAssignmentTarget(assignment);
      if (!target || !includedTargetKeys.has(getReportAssignmentTargetKey(target.target_kind, target.target_id))) {
        return null;
      }

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
        target_kind: target.target_kind,
        target_id: target.target_id,
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
      left.target_kind.localeCompare(right.target_kind)
      || left.target_id - right.target_id
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
  assignmentsInput?: ReportAssignmentInput,
  operationalHeader?: ReportOperationalHeaderInput
) {
  const baseRows: ReportRow[] = [
    ...planningRows.map(mapPlannedRow),
    ...realRows.map(mapRealRow),
  ]
    .filter((row) => matchesOptionalFilter(row.shift, query.shift))
    .filter((row) => matchesOptionalFilter(row.category, query.category))
    .filter((row) => matchesOptionalFilter(row.tracking_type, query.trackingType))
    .filter((row) => matchesOptionalFilter(row.item_type, query.itemType))
    .sort((left, right) =>
      `${right.item_date}-${right.start_time}-${right.id}`.localeCompare(
        `${left.item_date}-${left.start_time}-${left.id}`
      )
    );
  const {
    rows: rowsWithOperationalHeader,
    operationalHeaderColumns,
    operationalHeaderFilterColumns,
  } = applyOperationalHeaderToRows(baseRows, operationalHeader);
  const filteredRows = applyOperationalHeaderFilters(rowsWithOperationalHeader, operationalHeaderFilterColumns, query);
  const rows = projectOperationalHeaderRowsToColumns(filteredRows, operationalHeaderColumns);
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
    operational_header_columns: operationalHeaderColumns,
    assignment_rows: assignmentRows,
    breakdowns: {
      by_operational_header: buildOperationalHeaderBreakdowns(rows, operationalHeaderColumns, operationalHeader),
      by_shift: groupTotals(rows, "shift"),
      by_category: groupTotals(rows, "category"),
      by_tracking_type: groupTotals(rows, "tracking_type"),
      by_item_type: groupTotals(rows, "item_type"),
    },
  };
}
