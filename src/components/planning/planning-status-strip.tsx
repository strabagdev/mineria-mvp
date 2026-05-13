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
  const isLocalPlanningMessage = /^Usando planificacion local guardada\./.test(itemsError);
  const isLocalCatalogMessage = /^Usando catalogo local guardado\./.test(catalogError);
  const unifiedLocalMessage =
    isLocalPlanningMessage && isLocalCatalogMessage
      ? itemsError.replace("Usando planificacion local guardada.", "Usando datos locales guardados.")
      : "";
  const visibleItemsError = unifiedLocalMessage || itemsError;
  const visibleCatalogError = unifiedLocalMessage ? "" : catalogError;
  const hasVisibleStatus =
    Boolean(visibleItemsError) ||
    Boolean(visibleCatalogError && visibleCatalogError !== visibleItemsError) ||
    Boolean(retryablePlanningMutations.length) ||
    Boolean(conflictedPlanningMutations.length);

  if (!hasVisibleStatus) {
    return null;
  }

  return (
    <div className="gantt-status-strip" aria-live="polite">
      {visibleItemsError ? <p className="feedback">{visibleItemsError}</p> : null}
      {visibleCatalogError && visibleCatalogError !== visibleItemsError ? <p className="feedback">{visibleCatalogError}</p> : null}
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
