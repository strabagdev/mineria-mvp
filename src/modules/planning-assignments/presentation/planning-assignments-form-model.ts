import type {
  AssignmentFieldDto,
  AssignmentTypeDto,
  PlanningAssignmentDto,
  PlanningAssignmentInputDto,
  PlanningAssignmentValueDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";

export type PlanningAssignmentFieldFormValue = {
  optionId?: string;
  optionIds?: string[];
  valueText?: string;
  valueNumber?: string;
  valueDate?: string;
  valueBoolean?: boolean;
};

export type PlanningAssignmentFormInstance = {
  instanceOrder: number;
  values: Record<number, PlanningAssignmentFieldFormValue>;
};

export type PlanningAssignmentsFormState = Record<number, PlanningAssignmentFormInstance[]>;

export function createEmptyPlanningAssignmentInstance(instanceOrder: number): PlanningAssignmentFormInstance {
  return { instanceOrder, values: {} };
}

export function buildPlanningAssignmentsFormState(assignments: PlanningAssignmentDto[]) {
  const nextState: PlanningAssignmentsFormState = {};

  for (const assignment of assignments) {
    const values: Record<number, PlanningAssignmentFieldFormValue> = {};

    for (const value of assignment.values) {
      const current = values[value.field_id] ?? {};
      values[value.field_id] = value.option_id
        ? {
            ...current,
            optionId: String(value.option_id),
            optionIds: [...(current.optionIds ?? []), String(value.option_id)],
          }
        : {
            ...current,
            valueText: value.value_text ?? current.valueText,
            valueNumber: value.value_number === null ? current.valueNumber : String(value.value_number),
            valueDate: value.value_date ?? current.valueDate,
            valueBoolean: value.value_boolean ?? current.valueBoolean,
          };
    }

    nextState[assignment.assignment_type_id] = [
      ...(nextState[assignment.assignment_type_id] ?? []),
      { instanceOrder: assignment.instance_order, values },
    ];
  }

  return nextState;
}

function toValueInput(field: AssignmentFieldDto, value: PlanningAssignmentFieldFormValue) {
  if (field.input_type === "select") {
    return { field_id: field.id, option_id: value.optionId ? Number(value.optionId) : null };
  }

  if (field.input_type === "multi_select") {
    return {
      field_id: field.id,
      option_ids: (value.optionIds ?? []).map(Number).filter(Number.isFinite),
    };
  }

  if (field.input_type === "number") {
    return {
      field_id: field.id,
      value_number: value.valueNumber?.trim() ? Number(value.valueNumber) : null,
    };
  }

  if (field.input_type === "date") {
    return { field_id: field.id, value_date: value.valueDate?.trim() || null };
  }

  if (field.input_type === "boolean") {
    return { field_id: field.id, value_boolean: value.valueBoolean ?? null };
  }

  return { field_id: field.id, value_text: value.valueText?.trim() || null };
}

export function toPlanningAssignmentInputs(
  types: AssignmentTypeDto[],
  formState: PlanningAssignmentsFormState
): PlanningAssignmentInputDto[] {
  return types.flatMap((type) =>
    (formState[type.id] ?? []).map((instance) => ({
      assignment_type_id: type.id,
      instance_order: instance.instanceOrder,
      values: type.fields.map((field) => toValueInput(field, instance.values[field.id] ?? {})),
    }))
  );
}

export function toOperationalAssignmentTypes(types: AssignmentTypeDto[]) {
  return types
    .filter((type) => type.active)
    .map((type) => ({
      ...type,
      fields: type.fields
        .filter((field) => field.active)
        .map((field) => ({ ...field, options: field.options.filter((option) => option.active) })),
    }));
}

export function toDisplayPlanningAssignments(
  assignments: PlanningAssignmentInputDto[],
  planningItemId: number
): PlanningAssignmentDto[] {
  return assignments.map((assignment, assignmentIndex) => {
    const assignmentId = -(assignmentIndex + 1);
    const values: PlanningAssignmentValueDto[] = [];

    for (const value of assignment.values) {
      const optionIds = value.option_ids?.length ? value.option_ids : [value.option_id ?? null];
      for (const optionId of optionIds) {
        values.push({
          id: -(values.length + 1),
          assignment_id: assignmentId,
          field_id: value.field_id,
          option_id: optionId,
          value_text: value.value_text ?? null,
          value_number: value.value_number ?? null,
          value_date: value.value_date ?? null,
          value_boolean: value.value_boolean ?? null,
          value_json: value.value_json ?? {},
        });
      }
    }

    return {
      id: assignmentId,
      planning_item_id: planningItemId,
      assignment_type_id: assignment.assignment_type_id,
      instance_order: assignment.instance_order,
      values,
    };
  });
}

export function formatPlanningAssignmentFieldValue(field: AssignmentFieldDto, values: PlanningAssignmentValueDto[]) {
  let formattedValue: string;

  if (field.input_type === "select" || field.input_type === "multi_select") {
    formattedValue = values
      .map((value) => field.options.find((option) => option.id === value.option_id)?.label)
      .filter(Boolean)
      .join(", ");
  } else {
    const value = values[0];
    if (!value) return "";
    if (field.input_type === "number") formattedValue = value.value_number === null ? "" : String(value.value_number);
    else if (field.input_type === "date") formattedValue = value.value_date ?? "";
    else if (field.input_type === "boolean") formattedValue = value.value_boolean === null ? "" : value.value_boolean ? "Si" : "No";
    else formattedValue = value.value_text ?? "";
  }

  if (!formattedValue) return "";
  const suffix = typeof field.config.suffix === "string" ? field.config.suffix.trim() : "";
  return suffix ? `${formattedValue} ${suffix}` : formattedValue;
}

export function getPlanningAssignmentSummaryEntries(types: AssignmentTypeDto[], assignments: PlanningAssignmentDto[]) {
  const typesById = new Map(types.map((type) => [type.id, type]));

  return assignments.flatMap((assignment) => {
    const type = typesById.get(assignment.assignment_type_id);
    if (!type) return [];
    const valuesByField = new Map<number, PlanningAssignmentValueDto[]>();
    for (const value of assignment.values) {
      valuesByField.set(value.field_id, [...(valuesByField.get(value.field_id) ?? []), value]);
    }
    return [{
      assignment,
      type,
      values: [...type.fields]
        .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id)
        .map((field) => ({ field, value: formatPlanningAssignmentFieldValue(field, valuesByField.get(field.id) ?? []) }))
        .filter((entry) => entry.value),
    }];
  });
}

export function getPlanningAssignmentTypeSummaries(types: AssignmentTypeDto[], assignments: PlanningAssignmentDto[]) {
  const assignmentCountByTypeId = new Map<number, number>();
  for (const assignment of assignments) {
    assignmentCountByTypeId.set(
      assignment.assignment_type_id,
      (assignmentCountByTypeId.get(assignment.assignment_type_id) ?? 0) + 1
    );
  }

  return types.flatMap((type) => {
    const count = assignmentCountByTypeId.get(type.id) ?? 0;
    return count ? [{ type, count }] : [];
  });
}
