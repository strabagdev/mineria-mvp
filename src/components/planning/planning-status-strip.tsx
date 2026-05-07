type PendingPlanningMutation = {
  id: string;
  status?: "pending" | "conflict";
};

type PlanningStatusStripProps = {
  itemsError: string;
  catalogError: string;
  retryablePlanningMutations: PendingPlanningMutation[];
  conflictedPlanningMutations: PendingPlanningMutation[];
  queueSyncing: boolean;
  onDiscardConflicts: () => void;
};

export function PlanningStatusStrip({
  itemsError,
  catalogError,
  retryablePlanningMutations,
  conflictedPlanningMutations,
  queueSyncing,
  onDiscardConflicts,
}: PlanningStatusStripProps) {
  const hasVisibleStatus =
    Boolean(itemsError) ||
    Boolean(catalogError && catalogError !== itemsError) ||
    Boolean(retryablePlanningMutations.length) ||
    Boolean(conflictedPlanningMutations.length);

  if (!hasVisibleStatus) {
    return null;
  }

  return (
    <div className="gantt-status-strip" aria-live="polite">
      {itemsError ? <p className="feedback">{itemsError}</p> : null}
      {catalogError && catalogError !== itemsError ? <p className="feedback">{catalogError}</p> : null}
      {retryablePlanningMutations.length ? (
        <p className={`feedback sync-feedback ${queueSyncing ? "syncing" : ""}`}>
          {queueSyncing ? <span className="sync-spinner" aria-hidden="true" /> : null}
          <span>
            {queueSyncing
              ? "Sincronizando registros pendientes..."
              : `${retryablePlanningMutations.length} registro${
                  retryablePlanningMutations.length === 1 ? "" : "s"
                } pendiente${retryablePlanningMutations.length === 1 ? "" : "s"} de sincronizacion.`}
          </span>
        </p>
      ) : null}
      {conflictedPlanningMutations.length ? (
        <div className="feedback sync-feedback conflict-feedback">
          <span>
            {conflictedPlanningMutations.length} registro
            {conflictedPlanningMutations.length === 1 ? "" : "s"} pendiente
            {conflictedPlanningMutations.length === 1 ? "" : "s"} con conflicto. Otro usuario pudo haber ocupado ese horario o la informacion ya no es valida.
          </span>
          <button type="button" className="button small danger" onClick={onDiscardConflicts}>
            Descartar
          </button>
        </div>
      ) : null}
    </div>
  );
}
