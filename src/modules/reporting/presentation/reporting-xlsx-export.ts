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
type AssignmentTargetKind = ReportAssignmentRow["target_kind"];
type AssignmentColumn = {
  assignment_type_id: number;
  assignment_type_label: string;
  assignment_type_slug: string;
  header: string;
};

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
  const coreHeaders = new Set(detailCoreHeaders);
  const seenCustomLabels = new Map<string, number>();

  return (report.custom_field_columns ?? []).map((column) => {
    const count = seenCustomLabels.get(column.label) ?? 0;
    seenCustomLabels.set(column.label, count + 1);
    return coreHeaders.has(column.label) || count > 0 ? `${column.label} (${column.slug})` : column.label;
  });
}

function buildUniqueAssignmentHeader(
  assignment: Pick<ReportAssignmentRow, "assignment_type_label" | "assignment_type_slug" | "assignment_type_id">,
  seenHeaders: Set<string>,
  seenLabels: Map<string, number>
) {
  const baseHeader = `Asignación - ${assignment.assignment_type_label}`;
  const labelCount = seenLabels.get(assignment.assignment_type_label) ?? 0;
  seenLabels.set(assignment.assignment_type_label, labelCount + 1);

  const candidates = [
    baseHeader,
    `Asignación - ${assignment.assignment_type_label} (${assignment.assignment_type_slug})`,
    `Asignación - ${assignment.assignment_type_label} (${assignment.assignment_type_id})`,
  ];
  const firstCandidateIndex = labelCount > 0 ? 1 : 0;

  for (const header of candidates.slice(firstCandidateIndex)) {
    if (!seenHeaders.has(header)) {
      seenHeaders.add(header);
      return header;
    }
  }

  let suffix = 2;
  let header = `${candidates.at(-1)} ${suffix}`;
  while (seenHeaders.has(header)) {
    suffix += 1;
    header = `${candidates.at(-1)} ${suffix}`;
  }
  seenHeaders.add(header);
  return header;
}

function buildAssignmentColumns(report: ReportResponse, reservedHeaders: string[]) {
  const seenTypeIds = new Set<number>();
  const seenHeaders = new Set([...detailCoreHeaders, ...reservedHeaders]);
  const seenLabels = new Map<string, number>();

  return [...(report.assignment_rows ?? [])]
    .sort((left, right) =>
      left.assignment_type_label.localeCompare(right.assignment_type_label)
      || left.assignment_type_slug.localeCompare(right.assignment_type_slug)
      || left.assignment_type_id - right.assignment_type_id
    )
    .flatMap((assignment): AssignmentColumn[] => {
      if (seenTypeIds.has(assignment.assignment_type_id)) {
        return [];
      }

      seenTypeIds.add(assignment.assignment_type_id);
      return [{
        assignment_type_id: assignment.assignment_type_id,
        assignment_type_label: assignment.assignment_type_label,
        assignment_type_slug: assignment.assignment_type_slug,
        header: buildUniqueAssignmentHeader(assignment, seenHeaders, seenLabels),
      }];
    });
}

function getReportRowAssignmentTarget(row: Pick<ReportRow, "id" | "source_table">) {
  return row.source_table === "planning_items"
    ? { target_kind: "planning_item" as const, target_id: row.id }
    : { target_kind: "execution_segment" as const, target_id: row.id };
}

function getAssignmentTargetKey(targetKind: AssignmentTargetKind, targetId: number) {
  return `${targetKind}:${targetId}`;
}

function groupAssignmentsByTarget(report: ReportResponse) {
  const grouped = new Map<string, ReportAssignmentRow[]>();

  for (const assignment of report.assignment_rows ?? []) {
    const targetKey = getAssignmentTargetKey(assignment.target_kind, assignment.target_id);
    grouped.set(targetKey, [
      ...(grouped.get(targetKey) ?? []),
      assignment,
    ]);
  }

  return grouped;
}

export function formatAssignmentsForExcel(
  targetKind: AssignmentTargetKind,
  targetId: number,
  assignmentTypeId: number,
  assignmentRows: ReportAssignmentRow[]
) {
  return assignmentRows
    .filter((assignment) =>
      assignment.target_kind === targetKind
      && assignment.target_id === targetId
      && assignment.assignment_type_id === assignmentTypeId
    )
    .sort((left, right) => left.instance_order - right.instance_order || left.assignment_id - right.assignment_id)
    .flatMap((assignment) => assignment.values.map((value) => value.value).filter(Boolean))
    .join("; ");
}

export function buildReportXlsxSheets(report: ReportResponse) {
  const customFieldHeaders = getCustomFieldHeaders(report);
  const assignmentColumns = buildAssignmentColumns(report, customFieldHeaders);
  const assignmentRowsByTarget = groupAssignmentsByTarget(report);
  const detalle: ReportXlsxSheet = [
    [...detailCoreHeaders, ...customFieldHeaders, ...assignmentColumns.map((column) => column.header)],
    ...report.rows.map((row: ReportRow) => {
      const target = getReportRowAssignmentTarget(row);
      const targetKey = getAssignmentTargetKey(target.target_kind, target.target_id);
      const targetAssignments = assignmentRowsByTarget.get(targetKey) ?? [];

      return [
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
        ...assignmentColumns.map((column) => formatAssignmentsForExcel(
          target.target_kind,
          target.target_id,
          column.assignment_type_id,
          targetAssignments
        )),
      ];
    }),
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
