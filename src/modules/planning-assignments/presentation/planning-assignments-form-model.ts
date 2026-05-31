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

export function formatPlanningAssignmentFieldValue(field: AssignmentFieldDto, values: PlanningAssignmentValueDto[]) {
  if (field.input_type === "select" || field.input_type === "multi_select") {
    return values
      .map((value) => field.options.find((option) => option.id === value.option_id)?.label)
      .filter(Boolean)
      .join(", ");
  }

  const value = values[0];
  if (!value) return "";
  if (field.input_type === "number") return value.value_number === null ? "" : String(value.value_number);
  if (field.input_type === "date") return value.value_date ?? "";
  if (field.input_type === "boolean") return value.value_boolean === null ? "" : value.value_boolean ? "Si" : "No";
  return value.value_text ?? "";
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
      values: type.fields
        .map((field) => ({ field, value: formatPlanningAssignmentFieldValue(field, valuesByField.get(field.id) ?? []) }))
        .filter((entry) => entry.value),
    }];
  });
}
