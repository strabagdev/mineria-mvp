type DeleteConfirmationDialogProps = {
  title: string;
  label: string;
  error?: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationDialog({
  title,
  label,
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
            <p className="body-copy" style={{ marginTop: 8 }}>
              Vas a eliminar <strong>{label}</strong>. Esta accion no se puede deshacer.
            </p>
          </div>
        </div>

        {error ? <p className="feedback">{error}</p> : null}

        <div className="modal-actions" style={{ marginTop: 20 }}>
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="button danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Eliminando..." : "Confirmar eliminacion"}
          </button>
        </div>
      </div>
    </div>
  );
}
