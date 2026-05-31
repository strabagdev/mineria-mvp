import type { AssignmentTypeDto, PlanningAssignmentDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { getPlanningAssignmentSummaryEntries } from "@/modules/planning-assignments/presentation/planning-assignments-form-model";

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
    <article className="detail-notes-card">
      <p className="detail-label">Asignaciones</p>
      <div className="assignments-summary-list">
        {entries.map(({ assignment, type, values }) => (
          <div key={assignment.id}><strong>{type.label} #{assignment.instance_order}</strong>{values.length ? <p className="detail-notes-copy">{values.map(({ field, value }) => `${field.label}: ${value}`).join(" · ")}</p> : null}</div>
        ))}
      </div>
    </article>
  );
}
