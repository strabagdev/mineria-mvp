type HistoricalModeStripProps = {
  editingEnabled: boolean;
  onToggleEditing: () => void;
};

export function HistoricalModeStrip({ editingEnabled, onToggleEditing }: HistoricalModeStripProps) {
  return (
    <div className={`historical-mode-strip ${editingEnabled ? "editing" : ""}`} aria-live="polite">
      <div>
        <p className="historical-mode-title">
          {editingEnabled ? "Edicion historica activa" : "Vista historica: solo lectura"}
        </p>
        <p className="historical-mode-copy">
          {editingEnabled
            ? "Puedes editar registros de esta fecha. Los cambios quedaran asociados al dia seleccionado."
            : "Para proteger datos cerrados, las acciones de edicion estan ocultas hasta que las habilites."}
        </p>
      </div>
      <button type="button" className="button historical-mode-action" onClick={onToggleEditing}>
        {editingEnabled ? "Bloquear edicion" : "Habilitar edicion"}
      </button>
    </div>
  );
}
