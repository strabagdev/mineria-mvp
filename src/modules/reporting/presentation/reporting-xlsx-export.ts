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
  field_id: number;
  header: string;
};

const detailCorePrefixHeaders = [
  "ID",
  "Fuente",
  "Grupo actividad",
  "Fecha",
  "Horario",
  "Horas",
  "Vista",
  "Turno",
];
const detailCoreSuffixHeaders = [
  "Categoría",
  "Tipo",
  "Detalle",
  "Notas",
];

function getDetailCoreHeaders(report: ReportResponse) {
  return [
    ...detailCorePrefixHeaders,
    ...(report.operational_header_columns ?? []).map((column) => column.label),
    ...detailCoreSuffixHeaders,
  ];
}

function getOperationalHeaderCellValue(row: ReportRow, column: NonNullable<ReportResponse["operational_header_columns"]>[number]) {
  const value = row.operational_header_values?.[column.slug]?.value;

  if (value) {
    return value;
  }

  return "";
}

function buildUniqueAssignmentHeader(
  input: Pick<ReportAssignmentRow, "assignment_type_label" | "assignment_type_slug" | "assignment_type_id"> & {
    field_id: number;
    field_label: string;
    field_slug: string;
  },
  seenHeaders: Set<string>,
  seenLabels: Map<string, number>
) {
  const baseHeader = `${input.assignment_type_label} - ${input.field_label}`;
  const labelCount = seenLabels.get(baseHeader) ?? 0;
  seenLabels.set(baseHeader, labelCount + 1);

  const candidates = [
    baseHeader,
    `${input.assignment_type_label} - ${input.field_label} (${input.field_slug})`,
    `${input.assignment_type_label} - ${input.field_label} (${input.assignment_type_slug}-${input.field_slug})`,
    `${input.assignment_type_label} - ${input.field_label} (${input.assignment_type_id}-${input.field_id})`,
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
  const seenColumnKeys = new Set<string>();
  const seenHeaders = new Set([...getDetailCoreHeaders(report), ...reservedHeaders]);
  const seenLabels = new Map<string, number>();

  return [...(report.assignment_rows ?? [])]
    .sort((left, right) =>
      left.assignment_type_label.localeCompare(right.assignment_type_label)
      || left.assignment_type_slug.localeCompare(right.assignment_type_slug)
      || left.assignment_type_id - right.assignment_type_id
    )
    .flatMap((assignment): AssignmentColumn[] => {
      return [...assignment.values]
        .sort((left, right) =>
          left.field_label.localeCompare(right.field_label)
          || left.field_slug.localeCompare(right.field_slug)
          || left.field_id - right.field_id
        )
        .flatMap((value): AssignmentColumn[] => {
          const columnKey = `${assignment.assignment_type_id}:${value.field_id}`;
          if (seenColumnKeys.has(columnKey)) {
            return [];
          }

          seenColumnKeys.add(columnKey);
          return [{
            assignment_type_id: assignment.assignment_type_id,
            field_id: value.field_id,
            header: buildUniqueAssignmentHeader({
              assignment_type_id: assignment.assignment_type_id,
              assignment_type_label: assignment.assignment_type_label,
              assignment_type_slug: assignment.assignment_type_slug,
              field_id: value.field_id,
              field_label: value.field_label,
              field_slug: value.field_slug,
            }, seenHeaders, seenLabels),
          }];
        });
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
  fieldId: number,
  assignmentRows: ReportAssignmentRow[]
) {
  return assignmentRows
    .filter((assignment) =>
      assignment.target_kind === targetKind
      && assignment.target_id === targetId
      && assignment.assignment_type_id === assignmentTypeId
    )
    .sort((left, right) => left.instance_order - right.instance_order || left.assignment_id - right.assignment_id)
    .flatMap((assignment) =>
      assignment.values
        .filter((value) => value.field_id === fieldId)
        .map((value) => value.value)
        .filter(Boolean)
    )
    .join("; ");
}

export function buildReportXlsxSheets(report: ReportResponse) {
  const detailCoreHeaders = getDetailCoreHeaders(report);
  const assignmentColumns = buildAssignmentColumns(report, []);
  const assignmentRowsByTarget = groupAssignmentsByTarget(report);
  const detalle: ReportXlsxSheet = [
    [...detailCoreHeaders, ...assignmentColumns.map((column) => column.header)],
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
        ...(report.operational_header_columns ?? []).map((column) => getOperationalHeaderCellValue(row, column)),
        toDisplayCategory(row.category),
        row.item_type,
        row.description,
        row.notes ?? "",
        ...assignmentColumns.map((column) => formatAssignmentsForExcel(
          target.target_kind,
          target.target_id,
          column.assignment_type_id,
          column.field_id,
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
