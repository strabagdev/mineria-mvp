import type { AssignmentTypeDto, PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { getPlanningAssignmentSummaryEntries } from "@/modules/planning-assignments/presentation/planning-assignments-form-model";
import { getAssignmentTypeIcon } from "@/modules/planning-assignments/presentation/planning-assignment-type-icons";

type PlanningAssignmentsSummaryProps = {
  types: AssignmentTypeDto[];
  assignments: PlanningAssignmentDto[];
  loading?: boolean;
  error?: string;
};

export function PlanningAssignmentsSummary({ types, assignments, loading, error }: PlanningAssignmentsSummaryProps) {
  if (loading) return <article className="detail-notes-card"><p className="detail-notes-copy">Cargando asignaciones...</p></article>;
  if (error) return <article className="detail-notes-card"><p className="detail-notes-copy">{error}</p></article>;
  const entries = getPlanningAssignmentSummaryEntries(types, assignments);
  if (!entries.length) return null;

  return (
    <section className="custom-fields-detail-section">
      <div className="detail-highlight-grid">
        {entries.map(({ assignment, type, values }) => {
          const TypeIcon = getAssignmentTypeIcon(type.icon_key);

          return (
            <article className="detail-highlight-card" key={assignment.id}>
              <div className="detail-highlight-label">
                <TypeIcon aria-hidden="true" />
                <p className="detail-label">{type.label}</p>
              </div>
              {values.length ? (
                <p className="detail-highlight-value">
                  {values.map(({ value }) => value).join(" · ")}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
