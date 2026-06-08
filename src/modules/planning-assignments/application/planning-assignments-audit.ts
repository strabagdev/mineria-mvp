import type { PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value ?? null);
}

function normalizeAssignmentValue(value: PlanningAssignmentDto["values"][number]) {
  return {
    field_id: value.field_id,
    option_id: value.option_id,
    value_boolean: value.value_boolean,
    value_date: value.value_date,
    value_json: value.value_json ?? {},
    value_number: value.value_number,
    value_text: value.value_text,
  };
}

function normalizeAssignment(assignment: PlanningAssignmentDto) {
  return {
    assignment_type_id: assignment.assignment_type_id,
    instance_order: assignment.instance_order,
    values: assignment.values
      .map(normalizeAssignmentValue)
      .sort((left, right) => left.field_id - right.field_id || (left.option_id ?? 0) - (right.option_id ?? 0)),
  };
}

export function normalizePlanningAssignmentsForAudit(assignments: PlanningAssignmentDto[]) {
  return assignments
    .map(normalizeAssignment)
    .sort(
      (left, right) =>
        left.assignment_type_id - right.assignment_type_id ||
        left.instance_order - right.instance_order
    );
}

export function havePlanningAssignmentsChanged(
  before: PlanningAssignmentDto[],
  after: PlanningAssignmentDto[]
) {
  return stableJson(normalizePlanningAssignmentsForAudit(before)) !== stableJson(normalizePlanningAssignmentsForAudit(after));
}
