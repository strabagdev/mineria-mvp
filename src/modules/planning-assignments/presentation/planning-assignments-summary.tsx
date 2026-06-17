import type { AssignmentTypeDto, PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { getPlanningAssignmentSummaryEntries } from "@/modules/planning-assignments/presentation/planning-assignments-form-model";
import { getAssignmentTypeIcon } from "@/modules/planning-assignments/presentation/planning-assignment-type-icons";

type PlanningAssignmentsSummaryProps = {
  types: AssignmentTypeDto[];
  assignments: PlanningAssignmentDto[];
  title?: string;
  loading?: boolean;
  error?: string;
};

export function PlanningAssignmentsSummary({ types, assignments, title = "Asignaciones", loading, error }: PlanningAssignmentsSummaryProps) {
  if (loading || error) {
    return (
      <section className="detail-content-section assignments-detail-section">
        <p className="eyebrow">{title}</p>
        <p className="assignment-detail-status">{loading ? "Cargando asignaciones..." : error}</p>
      </section>
    );
  }

  const entries = getPlanningAssignmentSummaryEntries(types, assignments);
  if (!entries.length) return null;

  return (
    <section className="detail-content-section assignments-detail-section">
      <p className="eyebrow">{title}</p>
      <div className="assignments-detail-grid">
        {entries.map(({ assignment, type, values }) => {
          const TypeIcon = getAssignmentTypeIcon(type.icon_key);

          return (
            <article className="assignment-detail-card" key={assignment.id}>
              <span className="assignment-detail-icon">
                <TypeIcon aria-hidden="true" />
              </span>
              <div className="assignment-detail-copy">
                <p className="assignment-detail-label">{type.label}</p>
                {values.length ? (
                  <p className="assignment-detail-value">
                    {values.map(({ value }) => value).join(" · ")}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
