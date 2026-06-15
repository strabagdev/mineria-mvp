import type * as XLSX from "xlsx";
import type {
  ReportAssignmentRow,
  ReportFilters,
  ReportResponse,
  ReportRow,
} from "../contracts/reporting";
import {
  formatHours,
  toDisplayCategory,
  toTrackingLabel,
} from "./reporting-helpers";

type SheetValue = string | number;
export type ReportXlsxSheet = SheetValue[][];

const detailCoreHeaders = [
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
];

function getCustomFieldHeaders(report: ReportResponse) {
  const coreHeaders = new Set([...detailCoreHeaders, "Asignaciones"]);
  const seenCustomLabels = new Map<string, number>();

  return (report.custom_field_columns ?? []).map((column) => {
    const count = seenCustomLabels.get(column.label) ?? 0;
    seenCustomLabels.set(column.label, count + 1);
    return coreHeaders.has(column.label) || count > 0 ? `${column.label} (${column.slug})` : column.label;
  });
}

function groupAssignmentsByPlanningItem(report: ReportResponse) {
  const grouped = new Map<number, ReportAssignmentRow[]>();

  for (const assignment of report.assignment_rows ?? []) {
    grouped.set(assignment.planning_item_id, [
      ...(grouped.get(assignment.planning_item_id) ?? []),
      assignment,
    ]);
  }

  return grouped;
}

function formatAssignmentInstanceForExcel(assignment: ReportAssignmentRow) {
  const values = assignment.values
    .filter((value) => value.value)
    .map((value) => value.value);

  if (!values.length) {
    return `instancia #${assignment.instance_order}`;
  }

  return values.join(" / ");
}

export function formatAssignmentsForExcel(
  planningItemId: number,
  assignmentRows: ReportAssignmentRow[]
) {
  const assignments = assignmentRows.filter((assignment) => assignment.planning_item_id === planningItemId);
  const assignmentsByType = new Map<number, { label: string; assignments: ReportAssignmentRow[] }>();

  for (const assignment of assignments) {
    const current = assignmentsByType.get(assignment.assignment_type_id);
    assignmentsByType.set(assignment.assignment_type_id, {
      label: assignment.assignment_type_label,
      assignments: [...(current?.assignments ?? []), assignment],
    });
  }

  return Array.from(assignmentsByType.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((entry) => {
      const instances = [...entry.assignments]
        .sort((left, right) => left.instance_order - right.instance_order || left.assignment_id - right.assignment_id)
        .map(formatAssignmentInstanceForExcel);

      return `${entry.label}: ${instances.join(", ")}`;
    })
    .join(" | ");
}

export function buildReportXlsxSheets(report: ReportResponse) {
  const customFieldHeaders = getCustomFieldHeaders(report);
  const assignmentRowsByPlanningItem = groupAssignmentsByPlanningItem(report);
  const detalle: ReportXlsxSheet = [
    [...detailCoreHeaders, ...customFieldHeaders, "Asignaciones"],
    ...report.rows.map((row: ReportRow) => [
      row.id,
      row.source_table,
      row.activity_group_id,
      row.item_date,
      `${row.start_time} - ${row.end_time}`,
      formatHours(row.duration_minutes / 60),
      toTrackingLabel(row.tracking_type),
      row.shift,
      row.level,
      row.front,
      toDisplayCategory(row.category),
      row.item_type,
      row.description,
      row.notes ?? "",
      ...(report.custom_field_columns ?? []).map((column) => row.custom_fields?.[column.slug]?.value ?? ""),
      row.source_table === "planning_items"
        ? formatAssignmentsForExcel(row.id, assignmentRowsByPlanningItem.get(row.id) ?? [])
        : "",
    ]),
  ];

  return {
    detalle,
  };
}

export function buildReportXlsxWorkbook(
  xlsx: typeof XLSX,
  report: ReportResponse
) {
  const sheets = buildReportXlsxSheets(report);
  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet(sheets.detalle), "Detalle operacional");

  return workbook;
}

export function getReportXlsxFilename(filters: ReportFilters) {
  const dateFrom = filters.date_from || "inicio";
  const dateTo = filters.date_to || "fin";

  return `reporte-operacional-${dateFrom}_a_${dateTo}.xlsx`;
}
