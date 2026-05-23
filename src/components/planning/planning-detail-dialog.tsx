import { Calendar, Clock, FileText, Layers, Link2, MapPin, X } from "lucide-react";

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
  const categoryLabel = toDisplayCategory(item.category);
  const trackingTypeLabel = toTrackingTypeLabel(item.tracking_type);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card detail-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="detail-modal-header">
          <div className="detail-modal-heading">
            <div className="detail-badge-row">
              <span className={`detail-badge category-${item.category}`}>{categoryLabel}</span>
              <span className={`detail-badge tracking-${item.tracking_type}`}>{trackingTypeLabel}</span>
            </div>
            <h2 id="planning-detail-title" className="card-title detail-modal-title">
              {title}
            </h2>
          </div>
          <button type="button" className="detail-close-button" onClick={onClose} aria-label="Cerrar detalle">
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="detail-modal-body">
          <div className="detail-primary-grid">
            <article className="detail-primary-card">
              <Calendar aria-hidden="true" />
              <div>
                <p className="detail-label">Fecha</p>
                <p className="detail-value">{formatDateLabel(item.item_date)}</p>
              </div>
            </article>
            <article className="detail-primary-card">
              <Clock aria-hidden="true" />
              <div>
                <p className="detail-label">Horario</p>
                <p className="detail-value">
                  {item.start} - {item.end}
                </p>
              </div>
            </article>
          </div>

          <div className="detail-compact-grid">
            <article className="detail-card compact">
              <p className="detail-label">Turno</p>
              <p className="detail-value">{item.shift}</p>
            </article>
            <article className="detail-card compact">
              <p className="detail-label">Duracion</p>
              <p className="detail-value">{formatDuration(item.start, item.end)}</p>
            </article>
            <article className="detail-card compact">
              <p className="detail-label">Tipo</p>
              <p className="detail-value">{item.item_type}</p>
            </article>
          </div>

          <div className="detail-highlight-grid">
            <article className="detail-highlight-card level">
              <div className="detail-highlight-label">
                <Layers aria-hidden="true" />
                <p className="detail-label">Nivel</p>
              </div>
              <p className="detail-highlight-value">{item.level}</p>
            </article>
            <article className="detail-highlight-card">
              <div className="detail-highlight-label">
                <MapPin aria-hidden="true" />
                <p className="detail-label">Frente</p>
              </div>
              <p className="detail-highlight-value">{item.front}</p>
            </article>
          </div>

          {continuation ? (
            <article className="detail-notes-card">
              <div className="detail-section-heading">
                <Link2 aria-hidden="true" />
                <p className="detail-label">Continuidad</p>
              </div>
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
              <div className="detail-section-heading">
                <FileText aria-hidden="true" />
                <p className="detail-label">Notas</p>
              </div>
              <p className="detail-notes-copy">{item.notes}</p>
            </article>
          ) : null}
        </div>

        <div className="modal-actions detail-modal-actions">
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
