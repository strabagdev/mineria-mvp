import type { PlanningCustomFieldValueDto } from "@/modules/planning-custom-fields/contracts/planning-custom-fields";

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

function normalizeCustomFieldValue(value: PlanningCustomFieldValueDto) {
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

export function normalizePlanningCustomFieldValuesForAudit(values: PlanningCustomFieldValueDto[]) {
  return values
    .map(normalizeCustomFieldValue)
    .sort((left, right) => left.field_id - right.field_id || (left.option_id ?? 0) - (right.option_id ?? 0));
}

export function havePlanningCustomFieldValuesChanged(
  before: PlanningCustomFieldValueDto[],
  after: PlanningCustomFieldValueDto[]
) {
  return stableJson(normalizePlanningCustomFieldValuesForAudit(before)) !== stableJson(normalizePlanningCustomFieldValuesForAudit(after));
}
