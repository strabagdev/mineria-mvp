import { useEffect, useMemo } from "react";
import type { Dispatch, FormEventHandler, ReactNode, SetStateAction } from "react";
import { SheetPanel } from "@/components/ui/sheet-panel";
import {
  resolveOperationalHeaderDynamicFormFields,
} from "@/modules/operational-header/application/operational-header-form-dependencies";
import type {
  OperationalHeaderResponseDto,
} from "@/modules/operational-header/contracts/operational-header";

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

type PlanningItemForm = {
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
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
  formState: PlanningItemForm;
  setFormState: Dispatch<SetStateAction<PlanningItemForm>>;
  availableFormCategories: CatalogCategory[];
  availableTypes: CatalogType[];
  availableDescriptions: CatalogDetail[];
  operationalHeaderConfig?: OperationalHeaderResponseDto | null;
  dynamicHeaderValues: Record<number, string>;
  onDynamicHeaderValuesChange: Dispatch<SetStateAction<Record<number, string>>>;
  error: string;
  busy: boolean;
  isEditing: boolean;
  deleteLabel: string;
  submitLabel: string;
  assignmentsSlot?: ReactNode;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onRequestDelete: () => void;
};

function formatFieldNameForPrompt(label: string) {
  return label.trim().toLocaleLowerCase("es-CL");
}

export function PlanningSheet({
  titleId,
  eyebrow,
  title,
  formState,
  setFormState,
  availableFormCategories,
  availableTypes,
  availableDescriptions,
  operationalHeaderConfig,
  dynamicHeaderValues,
  onDynamicHeaderValuesChange,
  error,
  busy,
  isEditing,
  deleteLabel,
  submitLabel,
  assignmentsSlot,
  onClose,
  onSubmit,
  onRequestDelete,
}: PlanningSheetProps) {
  const dynamicHeaderFields = useMemo(() => resolveOperationalHeaderDynamicFormFields({
    config: operationalHeaderConfig,
    dynamicValues: dynamicHeaderValues,
  }), [dynamicHeaderValues, operationalHeaderConfig]);

  useEffect(() => {
    onDynamicHeaderValuesChange((current) => {
      const next: Record<number, string> = {};
      let changed = false;

      for (const { field, options } of dynamicHeaderFields) {
        const currentValue = current[field.id] ?? "";

        if (field.input_type === "select") {
          const nextValue = options.some((option) => option.value === currentValue) ? currentValue : "";
          next[field.id] = nextValue;
          changed ||= nextValue !== currentValue;
        } else {
          next[field.id] = currentValue;
        }
      }

      changed ||= Object.keys(current).length !== Object.keys(next).length;

      return changed ? next : current;
    });
  }, [dynamicHeaderFields, onDynamicHeaderValuesChange]);

  return (
    <SheetPanel
      titleId={titleId}
      eyebrow={eyebrow}
      title={title}
      className="planning-sheet-card"
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <section className="planning-sheet-section operational-header-form-section">
          <div className="planning-sheet-section-heading">
            <div>
              <p className="eyebrow">Cabecera Operacional</p>
              <h3>Cabecera Operacional</h3>
            </div>
            <p>Identifica dónde y bajo qué eje se registra el evento.</p>
          </div>

          {!operationalHeaderConfig ? (
            <p className="feedback">Configura la Cabecera Operacional en Catálogo para poder identificar eventos.</p>
          ) : dynamicHeaderFields.length === 0 ? (
            <p className="feedback">No hay campos activos de Cabecera Operacional para este formulario.</p>
          ) : null}

          {dynamicHeaderFields.length ? (
            <div className="modal-grid">
              {dynamicHeaderFields.map(({ field, options, captureState }) => {
                const currentValue = dynamicHeaderValues[field.id] ?? "";
                const validCurrentValue = options.some((option) => option.value === currentValue) ? currentValue : "";
                const parentLabel = captureState.missingParentFields[0]?.label ??
                  captureState.parentFields[0]?.label ??
                  "";
                const emptySelectMessage = field.input_type === "select"
                  ? captureState.unavailableReason === "missing_parent"
                    ? `Selecciona primero ${formatFieldNameForPrompt(parentLabel)}.`
                    : captureState.unavailableReason === "no_active_options"
                      ? `No hay opciones activas para ${formatFieldNameForPrompt(field.label)}.`
                      : captureState.unavailableReason === "no_valid_options"
                        ? `No hay opciones disponibles para la selección actual de ${formatFieldNameForPrompt(parentLabel)}.`
                        : ""
                  : "";

                return (
                  <label key={field.id} className="field">
                    <span className="field-label-row">
                      <span>{field.label}{field.required ? " *" : ""}</span>
                      {field.required ? <span className="required-badge">Requerido</span> : null}
                    </span>
                    {field.input_type === "select" ? (
                      <>
                        <select
                          className="field-input"
                          value={validCurrentValue}
                          onChange={(event) => onDynamicHeaderValuesChange((current) => ({
                            ...current,
                            [field.id]: event.target.value,
                          }))}
                          disabled={!options.length}
                        >
                          <option value="">
                            {`Seleccionar ${formatFieldNameForPrompt(field.label)}`}
                          </option>
                          {options.map((option) => (
                            <option key={option.id} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {emptySelectMessage ? (
                          <span className="field-help">{emptySelectMessage}</span>
                        ) : null}
                      </>
                    ) : (
                      <input
                        className="field-input"
                        value={currentValue}
                        placeholder={`Ingresar ${formatFieldNameForPrompt(field.label)}`}
                        onChange={(event) => onDynamicHeaderValuesChange((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }))}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="planning-sheet-section">
          <div className="planning-sheet-section-heading">
            <div>
              <p className="eyebrow">{formState.category === "interferencia" ? "Interferencia" : "Actividad"}</p>
              <h3>Actividad / Interferencia</h3>
            </div>
          </div>

          <label className="field">
            Categoria
            <select
              className="field-input"
              value={formState.category}
              onChange={(event) => {
                const category = event.target.value as "actividad" | "interferencia";
                const nextCategory = availableFormCategories.find((entry) => entry.slug === category) ?? null;
                const nextType = nextCategory?.types[0] ?? null;
                const nextDetail = nextType?.details[0] ?? null;

                setFormState((current) => ({
                  ...current,
                  category,
                  item_type: nextType?.label ?? "",
                  description: nextDetail?.label ?? "",
                }));
              }}
              disabled={!availableFormCategories.length}
            >
              {availableFormCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

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
          </div>
        </section>

        <section className="planning-sheet-section">
          <div className="planning-sheet-section-heading">
            <div>
              <p className="eyebrow">Horario / Turno</p>
              <h3>Horario / Turno</h3>
            </div>
          </div>

          <div className="modal-grid">
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
          </div>
        </section>

        {assignmentsSlot}

        <section className="planning-sheet-section">
          <div className="planning-sheet-section-heading">
            <div>
              <p className="eyebrow">Notas</p>
              <h3>Notas</h3>
            </div>
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
        </section>

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
