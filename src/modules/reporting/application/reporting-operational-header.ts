import type { OperationalHeaderFieldDto } from "@/modules/operational-header/contracts/operational-header";
import type { ReportOperationalHeaderColumn } from "@/modules/reporting/contracts/reporting";

export function sortOperationalHeaderReportFields<T extends Pick<OperationalHeaderFieldDto, "sort_order" | "label" | "id">>(
  fields: T[]
) {
  return [...fields].sort((left, right) =>
    left.sort_order - right.sort_order ||
    left.label.localeCompare(right.label) ||
    left.id - right.id
  );
}

export function getOperationalHeaderExportableFields(fields: OperationalHeaderFieldDto[]) {
  return sortOperationalHeaderReportFields(fields.filter((field) => field.active && field.exportable));
}

export function getOperationalHeaderFilterableFields(fields: OperationalHeaderFieldDto[]) {
  return sortOperationalHeaderReportFields(fields.filter((field) => field.active && field.filterable));
}

export function getOperationalHeaderBreakdownFields(fields: OperationalHeaderFieldDto[]) {
  return sortOperationalHeaderReportFields(fields.filter((field) =>
    field.active &&
    field.groupable &&
    field.exportable
  ));
}

export function toOperationalHeaderReportColumn(
  field: Pick<OperationalHeaderFieldDto, "id" | "slug" | "label" | "input_type" | "sort_order">
): ReportOperationalHeaderColumn {
  return {
    id: field.id,
    slug: field.slug,
    label: field.label,
    input_type: field.input_type,
    sort_order: field.sort_order,
  };
}
