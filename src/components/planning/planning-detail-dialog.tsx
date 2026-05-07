type PlanningDetailItem = {
  tracking_type: "programado" | "real";
  category: "actividad" | "interferencia";
  item_type: string;
  item_date: string;
  shift: string;
  start: string;
  end: string;
  level: string;
  front: string;
  notes?: string | null;
};

type SegmentContinuation = {
  previous: PlanningDetailItem | null;
  next: PlanningDetailItem | null;
} | null;

type PlanningDetailDialogProps = {
  item: PlanningDetailItem;
  title: string;
  continuation: SegmentContinuation;
  readOnly: boolean;
  formatDateLabel: (date: string) => string;
  formatDuration: (start: string, end: string) => string;
  toDisplayCategory: (category: PlanningDetailItem["category"]) => string;
  toTrackingTypeLabel: (trackingType: PlanningDetailItem["tracking_type"]) => string;
  onClose: () => void;
  onEdit: () => void;
};

export function PlanningDetailDialog({
  item,
  title,
  continuation,
  readOnly,
  formatDateLabel,
  formatDuration,
  toDisplayCategory,
  toTrackingTypeLabel,
  onClose,
  onEdit,
}: PlanningDetailDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card detail-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Detalle</p>
            <h2 id="planning-detail-title" className="card-title" style={{ marginTop: 12 }}>
              {title}
            </h2>
          </div>
          <button type="button" className="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="detail-modal-grid">
          <article className="detail-card">
            <p className="detail-label">Vista</p>
            <p className="detail-value">{toTrackingTypeLabel(item.tracking_type)}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Categoria</p>
            <p className="detail-value">{toDisplayCategory(item.category)}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Tipo</p>
            <p className="detail-value">{item.item_type}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Fecha</p>
            <p className="detail-value">{formatDateLabel(item.item_date)}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Turno</p>
            <p className="detail-value">{item.shift}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Horario</p>
            <p className="detail-value">
              {item.start} - {item.end}
            </p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Duracion</p>
            <p className="detail-value">{formatDuration(item.start, item.end)}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Nivel</p>
            <p className="detail-value">{item.level}</p>
          </article>
          <article className="detail-card">
            <p className="detail-label">Frente</p>
            <p className="detail-value">{item.front}</p>
          </article>
        </div>

        {continuation ? (
          <article className="detail-notes-card" style={{ marginTop: 16 }}>
            <p className="detail-label">Continuidad</p>
            <p className="detail-notes-copy">
              {continuation.previous
                ? `Este registro es la continuacion del tramo ${formatDateLabel(
                    continuation.previous.item_date
                  )} (${continuation.previous.shift}) ${continuation.previous.start} - ${continuation.previous.end}.`
                : "Este registro corresponde al primer tramo del real."}
              {continuation.next
                ? ` Tiene continuacion el ${formatDateLabel(
                    continuation.next.item_date
                  )} (${continuation.next.shift}) ${continuation.next.start} - ${continuation.next.end}.`
                : " No tiene continuacion posterior."}
            </p>
          </article>
        ) : null}

        {item.notes ? (
          <article className="detail-notes-card">
            <p className="detail-label">Notas</p>
            <p className="detail-notes-copy">{item.notes}</p>
          </article>
        ) : null}

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cerrar
          </button>
          {!readOnly ? (
            <button type="button" className="button primary" onClick={onEdit}>
              Editar registro
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
