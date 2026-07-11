import type { OperationalHeaderFieldDto } from "@/modules/operational-header/contracts/operational-header";

export function resolveOperationalHeaderGroupingOrder(
  field: Pick<OperationalHeaderFieldDto, "grouping_order" | "sort_order">
) {
  return field.grouping_order ?? field.sort_order;
}

export function sortOperationalHeaderGanttGroupingFields<T extends OperationalHeaderFieldDto>(
  fields: T[]
) {
  return [...fields].sort((left, right) =>
    resolveOperationalHeaderGroupingOrder(left) - resolveOperationalHeaderGroupingOrder(right) ||
    left.sort_order - right.sort_order ||
    left.label.localeCompare(right.label) ||
    left.id - right.id
  );
}

export function getOperationalHeaderGanttGroupingFields<T extends OperationalHeaderFieldDto>(
  fields: T[]
) {
  return sortOperationalHeaderGanttGroupingFields(fields.filter((field) =>
    field.active &&
    field.groupable &&
    field.visible_in_gantt
  ));
}
