import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
  PlanningCustomFieldValueDto,
  PlanningCustomFieldValueInputDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";

export type PlanningCustomFieldFormState = Record<
  number,
  {
    optionId?: string;
    optionIds?: string[];
    valueText?: string;
    valueNumber?: string;
    valueDate?: string;
    valueBoolean?: boolean;
  }
>;

export function buildCustomFieldFormState(values: PlanningCustomFieldValueDto[]) {
  const nextState: PlanningCustomFieldFormState = {};

  for (const value of values) {
    const current = nextState[value.field_id] ?? {};

    if (value.option_id) {
      nextState[value.field_id] = {
        ...current,
        optionId: String(value.option_id),
        optionIds: [...(current.optionIds ?? []), String(value.option_id)],
      };
      continue;
    }

    nextState[value.field_id] = {
      ...current,
      valueText: value.value_text ?? current.valueText,
      valueNumber: value.value_number === null ? current.valueNumber : String(value.value_number),
      valueDate: value.value_date ?? current.valueDate,
      valueBoolean: value.value_boolean ?? current.valueBoolean,
    };
  }

  return nextState;
}

export function toCustomFieldValueInputs(
  fields: PlanningCustomFieldDto[],
  formState: PlanningCustomFieldFormState
): PlanningCustomFieldValueInputDto[] {
  return fields.map((field) => {
    const value = formState[field.id] ?? {};

    if (field.input_type === "select") {
      return {
        field_id: field.id,
        option_id: value.optionId ? Number(value.optionId) : null,
      };
    }

    if (field.input_type === "multi_select") {
      return {
        field_id: field.id,
        option_ids: (value.optionIds ?? []).map(Number).filter((optionId) => Number.isFinite(optionId)),
      };
    }

    if (field.input_type === "number") {
      const numericValue = value.valueNumber?.trim() ? Number(value.valueNumber) : null;
      return {
        field_id: field.id,
        value_number: numericValue,
      };
    }

    if (field.input_type === "date") {
      return {
        field_id: field.id,
        value_date: value.valueDate?.trim() || null,
      };
    }

    if (field.input_type === "boolean") {
      return {
        field_id: field.id,
        value_boolean: value.valueBoolean ?? null,
      };
    }

    return {
      field_id: field.id,
      value_text: value.valueText?.trim() || null,
    };
  });
}

export function fieldAppliesTo(field: PlanningCustomFieldDto, phase: PlanningCustomFieldAppliesTo) {
  return field.active && (field.applies_to === "both" || field.applies_to === phase);
}

export function fieldHasFormValue(fieldId: number, formState: PlanningCustomFieldFormState) {
  const value = formState[fieldId];

  if (!value) {
    return false;
  }

  return Boolean(
    value.optionId ||
      value.optionIds?.length ||
      value.valueText?.trim() ||
      value.valueNumber?.trim() ||
      value.valueDate?.trim() ||
      value.valueBoolean !== undefined
  );
}
