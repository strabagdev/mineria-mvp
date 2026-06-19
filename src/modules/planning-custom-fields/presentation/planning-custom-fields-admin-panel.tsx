import { useEffect, useMemo, useState } from "react";
import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
  PlanningCustomFieldIconKey,
  PlanningCustomFieldInputType,
  PlanningCustomFieldOptionDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  getPlanningCustomFieldIcon,
  PLANNING_CUSTOM_FIELD_ICON_OPTIONS,
} from "@/modules/planning-custom-fields/presentation/planning-custom-field-icons";
import {
  createPlanningCustomField,
  createPlanningCustomFieldOption,
  deletePlanningCustomField,
  deletePlanningCustomFieldOption,
  fetchPlanningCustomFieldOptions,
  fetchPlanningCustomFields,
  updatePlanningCustomField,
  updatePlanningCustomFieldOption,
} from "@/modules/planning-custom-fields/application/planning-custom-fields.client";
import { DeleteConfirmationDialog } from "@/components/planning/delete-confirmation-dialog";

type FieldForm = {
  label: string;
  iconKey: PlanningCustomFieldIconKey | "";
  inputType: PlanningCustomFieldInputType;
  appliesTo: PlanningCustomFieldAppliesTo;
  required: boolean;
  sortOrder: string;
};

type OptionForm = {
  label: string;
  value: string;
  active: boolean;
  sortOrder: string;
};

type DraftOption = OptionForm & {
  localId: string;
};

const defaultFieldForm: FieldForm = {
  label: "",
  iconKey: "",
  inputType: "select",
  appliesTo: "planned",
  required: false,
  sortOrder: "100",
};

const defaultOptionForm: OptionForm = {
  label: "",
  value: "",
  active: true,
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

type PlanningCustomFieldsAdminPanelProps = {
  accessToken?: string;
  onFieldsChange?: (fields: PlanningCustomFieldDto[]) => void;
};

type CustomFieldDeletionRequest = {
  entityType: string;
  label: string;
  warning: string;
  onConfirm: () => void;
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
  const [draftOptions, setDraftOptions] = useState<DraftOption[]>([]);
  const [editingDraftOptionId, setEditingDraftOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDeletion, setPendingDeletion] = useState<CustomFieldDeletionRequest | null>(null);

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) ?? fields[0] ?? null,
    [fields, selectedFieldId]
  );
  const editingFieldSnapshot = useMemo(
    () => fields.find((field) => field.id === editingField?.id) ?? editingField,
    [editingField, fields]
  );
  const optionTargetField = editingFieldSnapshot ?? selectedField;
  const isOptionFieldForm = fieldForm.inputType === "select" || fieldForm.inputType === "multi_select";
  const optionSectionLabel = editingFieldSnapshot?.label ?? (fieldForm.label.trim() || "este campo");
  const SelectedIcon = getPlanningCustomFieldIcon(fieldForm.iconKey || null);

  async function refreshFields(preferredFieldId?: number) {
    const nextFields = await fetchPlanningCustomFields(accessToken, { activeOnly: false });
    setFields(nextFields);
    setSelectedFieldId((current) => preferredFieldId ?? current ?? nextFields[0]?.id ?? null);
    onFieldsChange?.(nextFields);
    return nextFields;
  }

  async function refreshOptionsForField(fieldId: number) {
    const options = await fetchPlanningCustomFieldOptions(fieldId, accessToken);
    const baseField = fields.find((field) => field.id === fieldId) ?? null;
    const nextField = baseField ? { ...baseField, options } : null;

    setFields((current) =>
      current.map((field) => {
        if (field.id !== fieldId) {
          return field;
        }

        return { ...field, options };
      })
    );

    return nextField;
  }

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    fetchPlanningCustomFields(accessToken, { activeOnly: false })
      .then((nextFields) => {
        if (!active) return;
        setFields(nextFields);
        setSelectedFieldId((current) => current ?? nextFields[0]?.id ?? null);
      })
      .catch((nextError: unknown) => {
        if (active) setError(nextError instanceof Error ? nextError.message : "No se pudieron cargar los campos.");
      })
      .finally(() => {
        if (active) setLoading(false);
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
        icon_key: fieldForm.iconKey || null,
        input_type: fieldForm.inputType,
        applies_to: fieldForm.appliesTo,
        required: fieldForm.required,
        sort_order: Number(fieldForm.sortOrder) || 100,
      };

      if (editingField) {
        await updatePlanningCustomField({ id: editingField.id, ...payload }, accessToken);
      } else {
        const field = await createPlanningCustomField(payload, accessToken);
        if (payload.input_type === "select" || payload.input_type === "multi_select") {
          for (const option of draftOptions) {
            await createPlanningCustomFieldOption(
              {
                field_id: field.id,
                label: option.label,
                value: option.value || normalizeAdminValue(option.label),
                active: option.active,
                sort_order: Number(option.sortOrder) || 100,
              },
              accessToken
            );
          }
        }
        const nextFields = await refreshFields(field.id);
        const createdField = nextFields.find((entry) => entry.id === field.id) ?? { ...field, options: [] };
        setEditingField(createdField);
        setFieldForm({
          label: createdField.label,
          iconKey: createdField.icon_key ?? "",
          inputType: createdField.input_type,
          appliesTo: createdField.applies_to,
          required: createdField.required,
          sortOrder: String(createdField.sort_order),
        });
        setDraftOptions([]);
        setEditingDraftOptionId(null);
        setOptionForm(defaultOptionForm);
        setEditingOption(null);
        return;
      }

      setFieldForm(defaultFieldForm);
      setEditingField(null);
      setDraftOptions([]);
      setEditingDraftOptionId(null);
      setOptionForm(defaultOptionForm);
      setEditingOption(null);
      await refreshFields(editingField.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el campo.");
    } finally {
      setBusy(false);
    }
  }

  function validateOptionForTarget(input: OptionForm, options: Array<{ id?: number; localId?: string; label: string; value: string }>) {
    const nextValue = normalizeAdminValue(input.value || input.label);
    const editingId = editingOption?.id;
    const editingLocalId = editingDraftOptionId;
    const duplicatedOption = options.find(
      (option) =>
        option.id !== editingId &&
        option.localId !== editingLocalId &&
        (normalizeAdminValue(option.label) === nextValue || option.value === nextValue)
    );

    if (!nextValue) {
      return "La opcion debe tener un nombre o valor valido.";
    }

    if (duplicatedOption) {
      return "Ya existe una opcion con ese nombre o valor para este campo.";
    }

    return "";
  }

  async function submitExistingOption() {
    if (!optionTargetField) return;

    setBusy(true);
    setError("");

    try {
      const nextValue = normalizeAdminValue(optionForm.value || optionForm.label);
      const validationError = validateOptionForTarget(optionForm, optionTargetField.options);
      if (validationError) {
        setError(validationError);
        return;
      }

      const payload = {
        field_id: optionTargetField.id,
        label: optionForm.label,
        value: nextValue,
        active: optionForm.active,
        sort_order: Number(optionForm.sortOrder) || 100,
      };

      if (editingOption) {
        await updatePlanningCustomFieldOption({ id: editingOption.id, ...payload }, accessToken);
      } else {
        await createPlanningCustomFieldOption(payload, accessToken);
      }

      setOptionForm(defaultOptionForm);
      setEditingOption(null);
      await refreshFields(optionTargetField.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  function submitDraftOption() {
    setError("");
    const nextValue = normalizeAdminValue(optionForm.value || optionForm.label);
    const validationError = validateOptionForTarget(optionForm, draftOptions);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingDraftOptionId) {
      setDraftOptions((current) =>
        current.map((option) =>
          option.localId === editingDraftOptionId
            ? {
                ...option,
                label: optionForm.label,
                value: nextValue,
                active: optionForm.active,
                sortOrder: optionForm.sortOrder,
              }
            : option
        )
      );
    } else {
      setDraftOptions((current) => [
        ...current,
        {
          localId: crypto.randomUUID(),
          label: optionForm.label,
          value: nextValue,
          active: optionForm.active,
          sortOrder: optionForm.sortOrder,
        },
      ]);
    }

    setOptionForm(defaultOptionForm);
    setEditingDraftOptionId(null);
  }

  async function startEditingField(field: PlanningCustomFieldDto) {
    setSelectedFieldId(field.id);
    setEditingField(field);
    setEditingOption(null);
    setEditingDraftOptionId(null);
    setOptionForm(defaultOptionForm);
    setFieldForm({
      label: field.label,
      iconKey: field.icon_key ?? "",
      inputType: field.input_type,
      appliesTo: field.applies_to,
      required: field.required,
      sortOrder: String(field.sort_order),
    });

    if (field.input_type === "select" || field.input_type === "multi_select") {
      const nextField = await refreshOptionsForField(field.id);
      if (nextField) {
        setEditingField(nextField);
      }
    }
  }

  function startEditingOption(option: PlanningCustomFieldOptionDto) {
    setEditingDraftOptionId(null);
    setEditingOption(option);
    setOptionForm({
      label: option.label,
      value: option.value,
      active: option.active,
      sortOrder: String(option.sort_order),
    });
  }

  function startEditingDraftOption(option: DraftOption) {
    setEditingOption(null);
    setEditingDraftOptionId(option.localId);
    setOptionForm({
      label: option.label,
      value: option.value,
      active: option.active,
      sortOrder: option.sortOrder,
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
      await refreshFields(option.field_id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo eliminar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  function requestDeletion(request: CustomFieldDeletionRequest) {
    setPendingDeletion(request);
  }

  function confirmDeletion() {
    if (!pendingDeletion) {
      return;
    }

    pendingDeletion.onConfirm();
    setPendingDeletion(null);
  }

  return (
    <article className="surface-card soft padded custom-fields-admin">
      {pendingDeletion ? (
        <DeleteConfirmationDialog
          title="Eliminar campo configurable"
          entityType={pendingDeletion.entityType}
          label={pendingDeletion.label}
          warning={pendingDeletion.warning}
          busy={busy}
          onCancel={() => setPendingDeletion(null)}
          onConfirm={confirmDeletion}
        />
      ) : null}

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
        <label className="field">
          Icono
          <div className="custom-field-icon-select-row">
            <select
              className="field-input"
              value={fieldForm.iconKey}
              onChange={(event) =>
                setFieldForm((current) => ({
                  ...current,
                  iconKey: event.target.value as PlanningCustomFieldIconKey | "",
                }))
              }
            >
              <option value="">Sin icono</option>
              {PLANNING_CUSTOM_FIELD_ICON_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="custom-field-icon-preview" aria-hidden="true">
              {SelectedIcon ? <SelectedIcon /> : null}
            </span>
          </div>
        </label>
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
        {isOptionFieldForm ? (
          <div className="custom-fields-options-block embedded">
            <div className="custom-fields-heading">
              <div>
                <p className="eyebrow">{editingField ? "Opciones configuradas" : "Opciones iniciales"}</p>
                <h4 className="custom-fields-options-title">Opciones de {optionSectionLabel}</h4>
              </div>
              <span className="catalog-count">
                {editingField ? `${optionTargetField?.options.length ?? 0} opciones` : `${draftOptions.length} pendientes`}
              </span>
            </div>

            <div className="modal-grid">
              <label className="field">
                Label visible
                <input
                  className="field-input"
                  value={optionForm.label}
                  onChange={(event) =>
                    setOptionForm((current) => ({
                      ...current,
                      label: event.target.value,
                      value: current.value || normalizeAdminValue(event.target.value),
                    }))
                  }
                  placeholder="Ej: Mixer"
                />
              </label>
              <label className="field">
                Value interno
                <input
                  className="field-input"
                  value={optionForm.value}
                  onChange={(event) => setOptionForm((current) => ({ ...current, value: normalizeAdminValue(event.target.value) }))}
                  placeholder="mixer"
                />
              </label>
            </div>
            <div className="custom-fields-admin-row">
              <label className="field">
                Orden
                <input
                  className="field-input"
                  type="number"
                  value={optionForm.sortOrder}
                  onChange={(event) => setOptionForm((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </label>
              <label className="field custom-fields-checkbox">
                <input
                  type="checkbox"
                  checked={optionForm.active}
                  onChange={(event) => setOptionForm((current) => ({ ...current, active: event.target.checked }))}
                />
                <span>Activa</span>
              </label>
            </div>
            <div className="catalog-inline-actions">
              <button
                type="button"
                className="button"
                onClick={() => void (editingField ? submitExistingOption() : submitDraftOption())}
                disabled={busy || !optionForm.label.trim()}
              >
                {editingOption || editingDraftOptionId ? "Guardar opcion" : "Agregar opcion"}
              </button>
              {editingOption || editingDraftOptionId ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    setEditingOption(null);
                    setEditingDraftOptionId(null);
                    setOptionForm(defaultOptionForm);
                  }}
                  disabled={busy}
                >
                  Cancelar opcion
                </button>
              ) : null}
            </div>

            {editingField ? (
              <div className="catalog-detail-list">
                {(optionTargetField?.options.length ?? 0) === 0 ? (
                  <p className="body-copy">Sin opciones configuradas para {optionSectionLabel}.</p>
                ) : null}
                {(optionTargetField?.options ?? []).map((option) => (
                  <div key={option.id} className="catalog-detail-row">
                    <span className="catalog-detail-chip">
                      {option.label}
                      {!option.active ? " (inactiva)" : ""}
                    </span>
                    <span className="catalog-count">{option.value}</span>
                    <div className="catalog-inline-actions">
                      <button type="button" className="button small" onClick={() => startEditingOption(option)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button small"
                        onClick={() =>
                          void updatePlanningCustomFieldOption({ id: option.id, active: !option.active }, accessToken).then(() =>
                            refreshFields(option.field_id)
                          )
                        }
                        disabled={busy}
                      >
                        {option.active ? "Desactivar opcion" : "Activar opcion"}
                      </button>
                      <button
                        type="button"
                        className="button small danger"
                        onClick={() =>
                          requestDeletion({
                            entityType: "Custom Field Option",
                            label: option.label,
                            warning: "La opcion dejara de estar disponible para nuevas selecciones.",
                            onConfirm: () => void removeOption(option),
                          })
                        }
                        disabled={busy}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="catalog-detail-list">
                {draftOptions.length === 0 ? (
                  <p className="body-copy">Sin opciones iniciales para {optionSectionLabel}.</p>
                ) : null}
                {draftOptions.map((option) => (
                  <div key={option.localId} className="catalog-detail-row">
                    <span className="catalog-detail-chip">
                      {option.label}
                      {!option.active ? " (inactiva)" : ""}
                    </span>
                    <span className="catalog-count">{option.value}</span>
                    <div className="catalog-inline-actions">
                      <button type="button" className="button small" onClick={() => startEditingDraftOption(option)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button small"
                        onClick={() =>
                          setDraftOptions((current) =>
                            current.map((entry) =>
                              entry.localId === option.localId ? { ...entry, active: !entry.active } : entry
                            )
                          )
                        }
                      >
                        {option.active ? "Desactivar opcion" : "Activar opcion"}
                      </button>
                      <button
                        type="button"
                        className="button small danger"
                        onClick={() =>
                          requestDeletion({
                            entityType: "Custom Field Option",
                            label: option.label,
                            warning: "La opcion inicial sera removida del campo antes de guardarlo.",
                            onConfirm: () =>
                              setDraftOptions((current) => current.filter((entry) => entry.localId !== option.localId)),
                          })
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

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
                setDraftOptions([]);
                setEditingDraftOptionId(null);
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

      <div className="catalog-detail-list custom-fields-admin-list">
        {loading ? (
          <div className="custom-fields-admin-loading" aria-busy="true">
            <div className="custom-fields-skeleton-field" />
            <div className="custom-fields-skeleton-field" />
          </div>
        ) : null}
        {!loading && fields.length === 0 ? <p className="body-copy">Sin campos configurables definidos.</p> : null}
        {fields.map((field) => (
          <div key={field.id} className="catalog-detail-row">
            <button
              type="button"
              className={`custom-field-select-button ${selectedField?.id === field.id ? "active" : ""}`}
              onClick={() => setSelectedFieldId(field.id)}
            >
              <span>{field.label}</span>
              <small>
                {field.input_type} · {field.active ? "activo" : "inactivo"}
                {field.input_type === "select" || field.input_type === "multi_select" ? ` · ${field.options.length} opciones` : ""}
              </small>
            </button>
            <div className="catalog-inline-actions">
              <button type="button" className="button small" onClick={() => void startEditingField(field)}>
                {field.input_type === "select" || field.input_type === "multi_select" ? "Editar campo y opciones" : "Editar"}
              </button>
              <button
                type="button"
                className="button small"
                onClick={() =>
                  void updatePlanningCustomField({ id: field.id, active: !field.active }, accessToken).then(() =>
                    refreshFields(field.id)
                  )
                }
                disabled={busy}
              >
                {field.active ? "Desactivar campo" : "Activar campo"}
              </button>
              <button
                type="button"
                className="button small danger"
                onClick={() =>
                  requestDeletion({
                    entityType: "Custom Field",
                    label: field.label,
                    warning: "Las opciones asociadas tambien seran eliminadas.",
                    onConfirm: () => void removeField(field),
                  })
                }
                disabled={busy}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {error ? <p className="feedback">{error}</p> : null}
    </article>
  );
}
