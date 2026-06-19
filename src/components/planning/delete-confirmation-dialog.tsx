type DeleteConfirmationDialogProps = {
  title: string;
  label: string;
  entityType?: string;
  warning?: string;
  error?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationDialog({
  title,
  label,
  entityType,
  warning,
  error,
  busy,
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card confirm-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Confirmacion</p>
            <h2 id="delete-confirmation-title" className="card-title" style={{ marginTop: 12 }}>
              {title}
            </h2>
            <div className="body-copy" style={{ marginTop: 8 }}>
              {entityType ? <p>Tipo de entidad: <strong>{entityType}</strong></p> : null}
              <p>Elemento: <strong>{label}</strong></p>
              {warning ? <p>{warning}</p> : null}
              <p>Esta accion no se puede deshacer.</p>
            </div>
          </div>
        </div>

        {error ? <p className="feedback">{error}</p> : null}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="button danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
