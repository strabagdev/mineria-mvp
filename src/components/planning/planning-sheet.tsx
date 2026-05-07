import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { SheetPanel } from "@/components/ui/sheet-panel";

type CatalogDetail = {
  id: number;
  label: string;
};

type CatalogType = {
  id: number;
  label: string;
  details: CatalogDetail[];
};

type CatalogCategory = {
  slug: "actividad" | "interferencia";
  label: string;
  types: CatalogType[];
};

type CatalogLevel = {
  id: number;
  label: string;
};

type PlanningItemForm = {
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  description: string;
  notes: string;
};

type PlanningSheetProps = {
  titleId: string;
  eyebrow: string;
  title: string;
  isRealForm: boolean;
  formState: PlanningItemForm;
  setFormState: Dispatch<SetStateAction<PlanningItemForm>>;
  catalog: CatalogCategory[];
  availableFormCategories: CatalogCategory[];
  availableTypes: CatalogType[];
  availableDescriptions: CatalogDetail[];
  levels: CatalogLevel[];
  error: string;
  busy: boolean;
  isEditing: boolean;
  deleteLabel: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRequestDelete: () => void;
};

export function PlanningSheet({
  titleId,
  eyebrow,
  title,
  isRealForm,
  formState,
  setFormState,
  catalog,
  availableFormCategories,
  availableTypes,
  availableDescriptions,
  levels,
  error,
  busy,
  isEditing,
  deleteLabel,
  submitLabel,
  onClose,
  onSubmit,
  onRequestDelete,
}: PlanningSheetProps) {
  return (
    <SheetPanel
      titleId={titleId}
      eyebrow={eyebrow}
      title={title}
      className="planning-sheet-card"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={onSubmit}>
        {isRealForm ? (
          <label className="field">
            Categoria
            <select
              className="field-input"
              value={formState.category}
              onChange={(event) => {
                const category = event.target.value as "actividad" | "interferencia";
                const nextCategory = catalog.find((entry) => entry.slug === category) ?? null;
                const nextType = nextCategory?.types[0] ?? null;
                const nextDetail = nextType?.details[0] ?? null;

                setFormState((current) => ({
                  ...current,
                  category,
                  item_type: nextType?.label ?? "",
                  description: nextDetail?.label ?? "",
                }));
              }}
            >
              {availableFormCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="planning-category-title">Actividad</p>
        )}

        <div className="modal-grid">
          <label className="field">
            Tipo
            <select
              className="field-input"
              value={formState.item_type}
              onChange={(event) => {
                const nextType = availableTypes.find((type) => type.label === event.target.value) ?? null;

                setFormState((current) => ({
                  ...current,
                  item_type: nextType?.label ?? "",
                  description: nextType?.details[0]?.label ?? "",
                }));
              }}
            >
              {availableTypes.map((type) => (
                <option key={type.id} value={type.label}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Detalle
            <select
              className="field-input"
              value={formState.description}
              onChange={(event) =>
                setFormState((current) => ({ ...current, description: event.target.value }))
              }
            >
              {availableDescriptions.map((detail) => (
                <option key={detail.id} value={detail.label}>
                  {detail.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Hora inicio
            <input
              className="field-input"
              type="time"
              value={formState.start_time}
              onChange={(event) =>
                setFormState((current) => ({ ...current, start_time: event.target.value }))
              }
            />
          </label>

          <label className="field">
            Hora termino
            <input
              className="field-input"
              type="time"
              value={formState.end_time}
              onChange={(event) =>
                setFormState((current) => ({ ...current, end_time: event.target.value }))
              }
            />
          </label>

          <label className="field">
            Nivel
            <select
              className="field-input"
              value={formState.level}
              onChange={(event) => setFormState((current) => ({ ...current, level: event.target.value }))}
              disabled={!levels.length}
            >
              {levels.map((level) => (
                <option key={level.id} value={level.label}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Frente
            <input
              className="field-input"
              value={formState.front}
              onChange={(event) => setFormState((current) => ({ ...current, front: event.target.value }))}
              placeholder="Ej: Frente Norte 2"
            />
          </label>
        </div>

        <label className="field">
          Notas
          <textarea
            className="field-input field-textarea"
            value={formState.notes}
            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Observaciones operacionales, restricciones o contexto"
          />
        </label>

        {error ? <p className="feedback">{error}</p> : null}

        <div className="modal-actions">
          {isEditing ? (
            <button type="button" className="button danger" onClick={onRequestDelete} disabled={busy}>
              {deleteLabel}
            </button>
          ) : null}
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={busy || !availableDescriptions.length}>
            {busy ? "Guardando..." : submitLabel}
          </button>
        </div>
      </form>
    </SheetPanel>
  );
}
