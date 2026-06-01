import type {
  PlanningCustomFieldDto,
  PlanningCustomFieldValueDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import { getPlanningCustomFieldIcon } from "@/modules/planning-custom-fields/presentation/planning-custom-field-icons";
import { getCustomFieldDisplayEntries } from "@/modules/planning-custom-fields/presentation/planning-custom-fields-form-model";

type PlanningCustomFieldsSummaryProps = {
  fields: PlanningCustomFieldDto[];
  values: PlanningCustomFieldValueDto[];
  loading?: boolean;
  error?: string;
};

export function PlanningCustomFieldsSummary({ fields, values, loading, error }: PlanningCustomFieldsSummaryProps) {
  if (loading) {
    return (
      <section className="custom-fields-detail-section">
        <p className="eyebrow">Datos adicionales</p>
        <div className="detail-highlight-grid">
          <article className="detail-highlight-card custom-fields-detail-skeleton" aria-busy="true">
            <span />
            <strong />
          </article>
          <article className="detail-highlight-card custom-fields-detail-skeleton" aria-busy="true">
            <span />
            <strong />
          </article>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="custom-fields-detail-section">
        <p className="eyebrow">Datos adicionales</p>
        <article className="detail-highlight-card custom-fields-detail-message">
          <p className="detail-highlight-value">{error}</p>
        </article>
      </section>
    );
  }

  const visibleValues = getCustomFieldDisplayEntries(fields, values);

  if (!visibleValues.length) {
    return null;
  }

  return (
    <section className="custom-fields-detail-section">
      <p className="eyebrow">Datos adicionales</p>
      <div className="detail-highlight-grid">
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
      </div>
    </section>
  );
}
