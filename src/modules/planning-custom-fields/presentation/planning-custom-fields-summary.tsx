import type {
  PlanningCustomFieldDto,
  PlanningCustomFieldValueDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import { getPlanningCustomFieldIcon } from "@/modules/planning-custom-fields/presentation/planning-custom-field-icons";

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
  loading?: boolean;
  error?: string;
};

export function PlanningCustomFieldsSummary({ fields, values, loading, error }: PlanningCustomFieldsSummaryProps) {
  if (loading) {
    return (
      <>
        <article className="detail-highlight-card custom-fields-detail-skeleton" aria-busy="true">
          <span />
          <strong />
        </article>
        <article className="detail-highlight-card custom-fields-detail-skeleton" aria-busy="true">
          <span />
          <strong />
        </article>
      </>
    );
  }

  if (error) {
    return (
      <article className="detail-highlight-card custom-fields-detail-message">
        <p className="detail-highlight-value">{error}</p>
      </article>
    );
  }

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
    <>
      {visibleValues.map(({ field, value }) => {
        const FieldIcon = getPlanningCustomFieldIcon(field.icon_key);

        return (
          <article key={field.id} className="detail-highlight-card">
            <div className="detail-highlight-label">
              {FieldIcon ? <FieldIcon aria-hidden="true" /> : null}
              <p className="detail-label">{field.label}</p>
            </div>
            <p className="detail-highlight-value">{value}</p>
          </article>
        );
      })}
    </>
  );
}
