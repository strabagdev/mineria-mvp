import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  fieldAppliesTo,
  fieldHasFormValue,
  type PlanningCustomFieldFormState,
} from "@/modules/planning-custom-fields/presentation/planning-custom-fields-form-model";

function visibleOptionsForField(field: PlanningCustomFieldDto, selectedOptionIds: string[]) {
  const selectedIds = new Set(selectedOptionIds.map(Number));
  return field.options.filter((option) => option.active || selectedIds.has(option.id));
}

function formatMultiSelectLabel(field: PlanningCustomFieldDto, selectedOptionIds: string[]) {
  if (!selectedOptionIds.length) {
    return "Seleccionar";
  }

  const selectedLabels = selectedOptionIds
    .map((optionId) => field.options.find((option) => option.id === Number(optionId))?.label)
    .filter(Boolean);

  if (!selectedLabels.length) {
    return "Seleccionar";
  }

  if (selectedLabels.length <= 2) {
    return selectedLabels.join(", ");
  }

  return `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;
}

type PlanningCustomFieldsFormProps = {
  fields: PlanningCustomFieldDto[];
  phase: PlanningCustomFieldAppliesTo;
  value: PlanningCustomFieldFormState;
  onChange: (value: PlanningCustomFieldFormState) => void;
  disabled?: boolean;
};

export function PlanningCustomFieldsForm({
  fields,
  phase,
  value,
  onChange,
  disabled,
}: PlanningCustomFieldsFormProps) {
  const visibleFields = fields.filter((field) => fieldAppliesTo(field, phase) || fieldHasFormValue(field.id, value));

  if (!visibleFields.length) {
    return null;
  }

  function updateField(fieldId: number, nextValue: PlanningCustomFieldFormState[number]) {
    onChange({
      ...value,
      [fieldId]: {
        ...(value[fieldId] ?? {}),
        ...nextValue,
      },
    });
  }

  return (
    <section className="custom-fields-section">
      <div className="custom-fields-heading">
        <p className="eyebrow">Campos configurables</p>
        <span className="catalog-count">{visibleFields.length} visibles</span>
      </div>
      <div className="modal-grid custom-fields-grid">
        {visibleFields.map((field) => {
          const current = value[field.id] ?? {};
          const isHistoricalInactive = !fieldAppliesTo(field, phase);
          const fieldLabel = isHistoricalInactive ? `${field.label} (inactivo)` : field.label;
          const fieldDisabled = disabled || isHistoricalInactive;
          const fieldRequired = field.required && !isHistoricalInactive;

          if (field.input_type === "select") {
            const visibleOptions = visibleOptionsForField(field, current.optionId ? [current.optionId] : []);

            return (
              <label key={field.id} className="field">
                {fieldLabel}
                <select
                  className="field-input"
                  value={current.optionId ?? ""}
                  onChange={(event) => updateField(field.id, { optionId: event.target.value })}
                  disabled={fieldDisabled}
                  required={fieldRequired}
                >
                  <option value="">Sin seleccionar</option>
                  {visibleOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.active ? option.label : `${option.label} (inactiva)`}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.input_type === "multi_select") {
            const visibleOptions = visibleOptionsForField(field, current.optionIds ?? []);
            const selectedOptionIds = current.optionIds ?? [];

            return (
              <div key={field.id} className="field">
                <span>{fieldLabel}</span>
                <details className="custom-fields-multi-menu">
                  <summary
                    className={`field-input custom-fields-multi-trigger ${fieldDisabled ? "disabled" : ""}`}
                    aria-disabled={fieldDisabled}
                  >
                    <span>{formatMultiSelectLabel(field, selectedOptionIds)}</span>
                    <span className="custom-fields-multi-count">{selectedOptionIds.length}</span>
                  </summary>
                  <div className="custom-fields-multi-options">
                    {visibleOptions.map((option) => {
                      const optionId = String(option.id);
                      const checked = selectedOptionIds.includes(optionId);

                      return (
                        <label key={option.id} className="custom-fields-multi-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={fieldDisabled}
                            onChange={(event) => {
                              const nextIds = event.target.checked
                                ? [...selectedOptionIds, optionId]
                                : selectedOptionIds.filter((selectedId) => selectedId !== optionId);
                              updateField(field.id, { optionIds: nextIds });
                            }}
                          />
                          <span>{option.active ? option.label : `${option.label} (inactiva)`}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
                {fieldRequired && !selectedOptionIds.length ? (
                  <input className="custom-fields-required-proxy" tabIndex={-1} required value="" onChange={() => undefined} />
                ) : null}
              </div>
            );
          }

          if (field.input_type === "number") {
            return (
              <label key={field.id} className="field">
                {fieldLabel}
                <input
                  className="field-input"
                  type="number"
                  value={current.valueNumber ?? ""}
                  onChange={(event) => updateField(field.id, { valueNumber: event.target.value })}
                  disabled={fieldDisabled}
                  required={fieldRequired}
                />
              </label>
            );
          }

          if (field.input_type === "date") {
            return (
              <label key={field.id} className="field">
                {fieldLabel}
                <input
                  className="field-input"
                  type="date"
                  value={current.valueDate ?? ""}
                  onChange={(event) => updateField(field.id, { valueDate: event.target.value })}
                  disabled={fieldDisabled}
                  required={fieldRequired}
                />
              </label>
            );
          }

          if (field.input_type === "boolean") {
            return (
              <label key={field.id} className="field custom-fields-checkbox">
                <input
                  type="checkbox"
                  checked={current.valueBoolean ?? false}
                  onChange={(event) => updateField(field.id, { valueBoolean: event.target.checked })}
                  disabled={fieldDisabled}
                />
                <span>{fieldLabel}</span>
              </label>
            );
          }

          return (
            <label key={field.id} className="field">
              {fieldLabel}
              <input
                className="field-input"
                value={current.valueText ?? ""}
                onChange={(event) => updateField(field.id, { valueText: event.target.value })}
                disabled={fieldDisabled}
                required={fieldRequired}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}
