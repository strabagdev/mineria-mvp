import { useEffect, useMemo, useState } from "react";
import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
  PlanningCustomFieldInputType,
  PlanningCustomFieldOptionDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  createPlanningCustomField,
  createPlanningCustomFieldOption,
  deletePlanningCustomField,
  deletePlanningCustomFieldOption,
  fetchPlanningCustomFields,
  updatePlanningCustomField,
  updatePlanningCustomFieldOption,
} from "@/modules/planning-custom-fields/application/planning-custom-fields.client";

type FieldForm = {
  label: string;
  inputType: PlanningCustomFieldInputType;
  appliesTo: PlanningCustomFieldAppliesTo;
  required: boolean;
  sortOrder: string;
};

type OptionForm = {
  label: string;
  sortOrder: string;
};

const defaultFieldForm: FieldForm = {
  label: "",
  inputType: "select",
  appliesTo: "planned",
  required: false,
  sortOrder: "100",
};

const defaultOptionForm: OptionForm = {
  label: "",
  sortOrder: "100",
};

function normalizeAdminValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canHaveOptions(field?: PlanningCustomFieldDto | null) {
  return field?.input_type === "select" || field?.input_type === "multi_select";
}

type PlanningCustomFieldsAdminPanelProps = {
  accessToken?: string;
  onFieldsChange?: (fields: PlanningCustomFieldDto[]) => void;
};

export function PlanningCustomFieldsAdminPanel({
  accessToken,
  onFieldsChange,
}: PlanningCustomFieldsAdminPanelProps) {
  const [fields, setFields] = useState<PlanningCustomFieldDto[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState<FieldForm>(defaultFieldForm);
  const [editingField, setEditingField] = useState<PlanningCustomFieldDto | null>(null);
  const [optionForm, setOptionForm] = useState<OptionForm>(defaultOptionForm);
  const [editingOption, setEditingOption] = useState<PlanningCustomFieldOptionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? fields[0] ?? null,
    [fields, selectedFieldId]
  );

  async function refreshFields() {
    const nextFields = await fetchPlanningCustomFields(accessToken, { activeOnly: false });
    setFields(nextFields);
    setSelectedFieldId((current) => current ?? nextFields[0]?.id ?? null);
    onFieldsChange?.(nextFields);
  }

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let active = true;

    fetchPlanningCustomFields(accessToken, { activeOnly: false })
      .then((nextFields) => {
        if (!active) return;
        setFields(nextFields);
        setSelectedFieldId((current) => current ?? nextFields[0]?.id ?? null);
      })
      .catch((nextError: unknown) => {
        if (active) setError(nextError instanceof Error ? nextError.message : "No se pudieron cargar los campos.");
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  async function submitField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = {
        label: fieldForm.label,
        input_type: fieldForm.inputType,
        applies_to: fieldForm.appliesTo,
        required: fieldForm.required,
        sort_order: Number(fieldForm.sortOrder) || 100,
      };

      if (editingField) {
        await updatePlanningCustomField({ id: editingField.id, ...payload }, accessToken);
      } else {
        await createPlanningCustomField(payload, accessToken);
      }

      setFieldForm(defaultFieldForm);
      setEditingField(null);
      await refreshFields();
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el campo.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedField) return;

    setBusy(true);
    setError("");

    try {
      const nextValue = normalizeAdminValue(optionForm.label);
      const duplicatedOption = selectedField.options.find(
        (option) =>
          option.id !== editingOption?.id &&
          (normalizeAdminValue(option.label) === nextValue || option.value === nextValue)
      );

      if (!nextValue) {
        setError("La opcion debe tener un nombre valido.");
        return;
      }

      if (duplicatedOption) {
        setError("Ya existe una opcion con ese nombre o valor para este campo.");
        return;
      }

      const payload = {
        field_id: selectedField.id,
        label: optionForm.label,
        value: nextValue,
        sort_order: Number(optionForm.sortOrder) || 100,
      };

      if (editingOption) {
        await updatePlanningCustomFieldOption({ id: editingOption.id, ...payload }, accessToken);
      } else {
        await createPlanningCustomFieldOption(payload, accessToken);
      }

      setOptionForm(defaultOptionForm);
      setEditingOption(null);
      await refreshFields();
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  function startEditingField(field: PlanningCustomFieldDto) {
    setEditingField(field);
    setFieldForm({
      label: field.label,
      inputType: field.input_type,
      appliesTo: field.applies_to,
      required: field.required,
      sortOrder: String(field.sort_order),
    });
  }

  function startEditingOption(option: PlanningCustomFieldOptionDto) {
    setEditingOption(option);
    setOptionForm({
      label: option.label,
      sortOrder: String(option.sort_order),
    });
  }

  async function removeField(field: PlanningCustomFieldDto) {
    setBusy(true);
    setError("");

    try {
      await deletePlanningCustomField(field.id, accessToken);
      if (editingField?.id === field.id) {
        setEditingField(null);
        setFieldForm(defaultFieldForm);
      }
      await refreshFields();
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo eliminar el campo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeOption(option: PlanningCustomFieldOptionDto) {
    setBusy(true);
    setError("");

    try {
      await deletePlanningCustomFieldOption(option.id, accessToken);
      if (editingOption?.id === option.id) {
        setEditingOption(null);
        setOptionForm(defaultOptionForm);
      }
      await refreshFields();
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo eliminar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="surface-card soft padded custom-fields-admin">
      <div className="catalog-category-header">
        <div>
          <p className="eyebrow">Campos configurables</p>
          <h3 className="card-title" style={{ marginTop: 10 }}>
            Programado
          </h3>
        </div>
        <span className="catalog-count">{fields.length} campos</span>
      </div>

      <form className="modal-form custom-fields-admin-form" onSubmit={submitField}>
        <label className="field">
          Nombre del campo
          <input
            className="field-input"
            value={fieldForm.label}
            onChange={(event) => setFieldForm((current) => ({ ...current, label: event.target.value }))}
            placeholder="Ej: Equipo"
          />
        </label>
        <div className="modal-grid">
          <label className="field">
            Tipo
            <select
              className="field-input"
              value={fieldForm.inputType}
              onChange={(event) =>
                setFieldForm((current) => ({
                  ...current,
                  inputType: event.target.value as PlanningCustomFieldInputType,
                }))
              }
            >
              <option value="select">Select</option>
              <option value="multi_select">Multi select</option>
              <option value="number">Number</option>
              <option value="text">Text</option>
              <option value="date">Date</option>
              <option value="boolean">Boolean</option>
            </select>
          </label>
          <label className="field">
            Aplica a
            <select
              className="field-input"
              value={fieldForm.appliesTo}
              onChange={(event) =>
                setFieldForm((current) => ({
                  ...current,
                  appliesTo: event.target.value as PlanningCustomFieldAppliesTo,
                }))
              }
            >
              <option value="planned">Programado</option>
              <option value="actual">Real</option>
              <option value="both">Ambos</option>
            </select>
          </label>
        </div>
        <div className="custom-fields-admin-row">
          <label className="field">
            Orden
            <input
              className="field-input"
              type="number"
              value={fieldForm.sortOrder}
              onChange={(event) => setFieldForm((current) => ({ ...current, sortOrder: event.target.value }))}
            />
          </label>
          <label className="field custom-fields-checkbox">
            <input
              type="checkbox"
              checked={fieldForm.required}
              onChange={(event) => setFieldForm((current) => ({ ...current, required: event.target.checked }))}
            />
            <span>Requerido</span>
          </label>
        </div>
        <div className="catalog-inline-actions">
          <button type="submit" className="button primary" disabled={busy || !fieldForm.label.trim()}>
            {editingField ? "Guardar campo" : "Crear campo"}
          </button>
          {editingField ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                setEditingField(null);
                setFieldForm(defaultFieldForm);
              }}
              disabled={busy}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="catalog-detail-list custom-fields-admin-list">
        {fields.map((field) => (
          <div key={field.id} className="catalog-detail-row">
            <button
              type="button"
              className={`custom-field-select-button ${selectedField?.id === field.id ? "active" : ""}`}
              onClick={() => setSelectedFieldId(field.id)}
            >
              <span>{field.label}</span>
              <small>{field.input_type} · {field.active ? "activo" : "inactivo"}</small>
            </button>
            <div className="catalog-inline-actions">
              <button type="button" className="button small" onClick={() => startEditingField(field)}>
                Editar
              </button>
              <button
                type="button"
                className="button small"
                onClick={() => void updatePlanningCustomField({ id: field.id, active: !field.active }, accessToken).then(refreshFields)}
                disabled={busy}
              >
                {field.active ? "Desactivar campo" : "Activar campo"}
              </button>
              <button
                type="button"
                className="button small danger"
                onClick={() => void removeField(field)}
                disabled={busy}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedField && canHaveOptions(selectedField) ? (
        <div className="custom-fields-options-block">
          <p className="eyebrow">Opciones de {selectedField.label}</p>
          <form className="modal-form" onSubmit={submitOption}>
            <div className="modal-grid">
              <label className="field">
                Nombre opcion
                <input
                  className="field-input"
                  value={optionForm.label}
                  onChange={(event) => setOptionForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="Ej: Mixer"
                />
              </label>
              <label className="field">
                Orden
                <input
                  className="field-input"
                  type="number"
                  value={optionForm.sortOrder}
                  onChange={(event) => setOptionForm((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </label>
            </div>
            <div className="catalog-inline-actions">
              <button type="submit" className="button primary" disabled={busy || !optionForm.label.trim()}>
                {editingOption ? "Guardar opcion" : "Crear opcion"}
              </button>
              {editingOption ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setEditingOption(null);
                    setOptionForm(defaultOptionForm);
                  }}
                  disabled={busy}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="catalog-detail-list">
            {selectedField.options.map((option) => (
              <div key={option.id} className="catalog-detail-row">
                <span className="catalog-detail-chip">
                  {option.label}
                  {!option.active ? " (inactiva)" : ""}
                </span>
                <div className="catalog-inline-actions">
                  <button type="button" className="button small" onClick={() => startEditingOption(option)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="button small"
                    onClick={() =>
                      void updatePlanningCustomFieldOption({ id: option.id, active: !option.active }, accessToken).then(refreshFields)
                    }
                    disabled={busy}
                  >
                    {option.active ? "Desactivar opcion" : "Activar opcion"}
                  </button>
                  <button
                    type="button"
                    className="button small danger"
                    onClick={() => void removeOption(option)}
                    disabled={busy}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="feedback">{error}</p> : null}
    </article>
  );
}
