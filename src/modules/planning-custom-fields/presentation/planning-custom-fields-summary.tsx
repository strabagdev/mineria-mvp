import type {
  PlanningCustomFieldDto,
  PlanningCustomFieldValueDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";

function formatFieldValue(field: PlanningCustomFieldDto, values: PlanningCustomFieldValueDto[]) {
  if (!values.length) {
    return "";
  }

  if (field.input_type === "select" || field.input_type === "multi_select") {
    const labels = values
      .map((value) => field.options.find((option) => option.id === value.option_id)?.label)
      .filter(Boolean);
    return labels.join(", ");
  }

  const value = values[0];

  if (field.input_type === "number") {
    return value.value_number === null ? "" : String(value.value_number);
  }

  if (field.input_type === "date") {
    return value.value_date ?? "";
  }

  if (field.input_type === "boolean") {
    return value.value_boolean === null ? "" : value.value_boolean ? "Si" : "No";
  }

  return value.value_text ?? "";
}

type PlanningCustomFieldsSummaryProps = {
  fields: PlanningCustomFieldDto[];
  values: PlanningCustomFieldValueDto[];
};

export function PlanningCustomFieldsSummary({ fields, values }: PlanningCustomFieldsSummaryProps) {
  const valuesByField = new Map<number, PlanningCustomFieldValueDto[]>();

  for (const value of values) {
    valuesByField.set(value.field_id, [...(valuesByField.get(value.field_id) ?? []), value]);
  }

  const visibleValues = fields
    .map((field) => ({
      field,
      value: formatFieldValue(field, valuesByField.get(field.id) ?? []),
    }))
    .filter((entry) => entry.value);

  if (!visibleValues.length) {
    return null;
  }

  return (
    <article className="detail-notes-card custom-fields-summary">
      <div className="detail-section-heading">
        <p className="detail-label">Campos configurables</p>
      </div>
      <div className="custom-fields-summary-grid">
        {visibleValues.map(({ field, value }) => (
          <div key={field.id} className="custom-fields-summary-item">
            <span>{field.label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
