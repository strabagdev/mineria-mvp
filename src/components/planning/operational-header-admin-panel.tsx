"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  createOperationalHeaderDependency,
  createOperationalHeaderField,
  createOperationalHeaderOption,
  deleteOperationalHeaderDependency,
  deleteOperationalHeaderField,
  deleteOperationalHeaderOption,
  updateOperationalHeaderField,
  updateOperationalHeaderOption,
} from "@/modules/operational-header/application/operational-header.client";
import type {
  OperationalHeaderFieldDto,
  OperationalHeaderFieldOptionDto,
  OperationalHeaderInputType,
  OperationalHeaderOptionDependencyDto,
  OperationalHeaderResponseDto,
} from "@/modules/operational-header/contracts/operational-header";

type OperationalHeaderAdminPanelProps = {
  accessToken?: string;
  config: OperationalHeaderResponseDto | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
};

type FieldFormState = {
  id: number | null;
  slug: string;
  label: string;
  input_type: OperationalHeaderInputType;
  required: boolean;
  active: boolean;
  sort_order: number;
  groupable: boolean;
  filterable: boolean;
  visible_in_gantt: boolean;
  exportable: boolean;
};

type OptionFormState = {
  id: number | null;
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadataText: string;
};

type DependencyFormState = {
  field_id: number;
  option_id: number;
  depends_on_field_id: number;
  depends_on_option_id: number;
};

export type BulkDependencyFormState = {
  field_id: number;
  option_ids: number[];
  depends_on_field_id: number;
  depends_on_option_id: number;
};

export type BulkDependencySummary = {
  created: number;
  skipped: number;
  blocked: number;
};

const emptyForm: FieldFormState = {
  id: null,
  slug: "",
  label: "",
  input_type: "text",
  required: false,
  active: true,
  sort_order: 100,
  groupable: false,
  filterable: false,
  visible_in_gantt: false,
  exportable: false,
};

const emptyOptionForm: OptionFormState = {
  id: null,
  field_id: 0,
  value: "",
  label: "",
  active: true,
  sort_order: 100,
  metadataText: "{}",
};

const emptyDependencyForm: DependencyFormState = {
  field_id: 0,
  option_id: 0,
  depends_on_field_id: 0,
  depends_on_option_id: 0,
};

const emptyBulkDependencyForm: BulkDependencyFormState = {
  field_id: 0,
  option_ids: [],
  depends_on_field_id: 0,
  depends_on_option_id: 0,
};

export function getBulkDependencyCandidateOptionIds(input: {
  draft: BulkDependencyFormState;
  dependencies: OperationalHeaderOptionDependencyDto[];
}) {
  return input.draft.option_ids.filter((optionId) =>
    !input.dependencies.some((dependency) =>
      dependency.option_id === optionId &&
      dependency.depends_on_option_id === input.draft.depends_on_option_id
    )
  );
}

export function isBulkDependencySameField(draft: BulkDependencyFormState) {
  return Boolean(draft.field_id && draft.field_id === draft.depends_on_field_id);
}

export function createBulkDependencySummary(input: {
  selectedCount: number;
  candidateCount: number;
  created: number;
  blocked: number;
}): BulkDependencySummary {
  return {
    created: input.created,
    skipped: input.selectedCount - input.candidateCount,
    blocked: input.blocked,
  };
}

function formFromField(field: OperationalHeaderFieldDto): FieldFormState {
  return {
    id: field.id,
    slug: field.slug,
    label: field.label,
    input_type: field.input_type,
    required: field.required,
    active: field.active,
    sort_order: field.sort_order,
    groupable: field.groupable,
    filterable: field.filterable,
    visible_in_gantt: field.visible_in_gantt,
    exportable: field.exportable,
  };
}

function optionFormFromOption(option: OperationalHeaderFieldOptionDto): OptionFormState {
  return {
    id: option.id,
    field_id: option.field_id,
    value: option.value,
    label: option.label,
    active: option.active,
    sort_order: option.sort_order,
    metadataText: JSON.stringify(option.metadata ?? {}, null, 2),
  };
}

function BooleanFlag({ label, value }: { label: string; value: boolean }) {
  return (
    <span className={value ? "operational-header-flag enabled" : "operational-header-flag"}>
      {label}: {value ? "Si" : "No"}
    </span>
  );
}

function buildFieldLookup(fields: OperationalHeaderFieldDto[]) {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const optionsById = new Map(fields.flatMap((field) =>
    field.options.map((option) => [option.id, { field, option }] as const)
  ));

  return { fieldsById, optionsById };
}

function DependencyRow({
  dependency,
  fieldsById,
  optionsById,
}: {
  dependency: OperationalHeaderOptionDependencyDto;
  fieldsById: Map<number, OperationalHeaderFieldDto>;
  optionsById: ReturnType<typeof buildFieldLookup>["optionsById"];
}) {
  const dependentField = fieldsById.get(dependency.field_id);
  const dependentOption = optionsById.get(dependency.option_id)?.option;
  const sourceField = fieldsById.get(dependency.depends_on_field_id);
  const sourceOption = optionsById.get(dependency.depends_on_option_id)?.option;

  return (
    <div className="operational-header-dependency-row">
      <span>
        <strong>{dependentField?.label ?? `Campo ${dependency.field_id}`}</strong>
        {" / "}
        {dependentOption?.label ?? `Opcion ${dependency.option_id}`}
      </span>
      <span className="operational-header-dependency-arrow">depende de</span>
      <span>
        <strong>{sourceField?.label ?? `Campo ${dependency.depends_on_field_id}`}</strong>
        {" / "}
        {sourceOption?.label ?? `Opcion ${dependency.depends_on_option_id}`}
      </span>
    </div>
  );
}

function FlagCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="operational-header-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function OperationalHeaderAdminPanel({
  accessToken,
  config,
  loading,
  error,
  onRefresh,
}: OperationalHeaderAdminPanelProps) {
  const fields = config?.fields ?? [];
  const dependencies = config?.dependencies ?? [];
  const { fieldsById, optionsById } = buildFieldLookup(fields);
  const activeSelectFields = fields.filter((field) => field.active && field.input_type === "select");
  const [form, setForm] = useState<FieldFormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [optionForm, setOptionForm] = useState<OptionFormState>(emptyOptionForm);
  const [optionFormOpen, setOptionFormOpen] = useState(false);
  const [dependencyForm, setDependencyForm] = useState<DependencyFormState>(emptyDependencyForm);
  const [dependencyFormOpen, setDependencyFormOpen] = useState(false);
  const [bulkDependencyForm, setBulkDependencyForm] = useState<BulkDependencyFormState>(emptyBulkDependencyForm);
  const [bulkDependencySummary, setBulkDependencySummary] = useState<BulkDependencySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const isEditing = form.id !== null;
  const isEditingOption = optionForm.id !== null;
  const editingField = isEditing ? fields.find((field) => field.id === form.id) ?? null : null;
  const isTextToSelectConversion = editingField?.input_type === "text" && form.input_type === "select";

  function resetForm() {
    setForm(emptyForm);
    setFormOpen(false);
    setFormError("");
  }

  function resetOptionForm() {
    setOptionForm(emptyOptionForm);
    setOptionFormOpen(false);
    setFormError("");
  }

  function resetDependencyForm() {
    setDependencyForm(emptyDependencyForm);
    setDependencyFormOpen(false);
    setFormError("");
  }

  function startCreate() {
    setForm(emptyForm);
    setFormOpen(true);
    setFormError("");
  }

  function startEdit(field: OperationalHeaderFieldDto) {
    setForm(formFromField(field));
    setFormOpen(true);
    setFormError("");
  }

  function startCreateOption(field: OperationalHeaderFieldDto) {
    setOptionForm({
      ...emptyOptionForm,
      field_id: field.id,
      sort_order: (field.options.length + 1) * 10,
    });
    setOptionFormOpen(true);
    setFormError("");
  }

  function startEditOption(option: OperationalHeaderFieldOptionDto) {
    setOptionForm(optionFormFromOption(option));
    setOptionFormOpen(true);
    setFormError("");
  }

  function startCreateDependency() {
    const firstField = activeSelectFields[0];
    const secondField = activeSelectFields.find((field) => field.id !== firstField?.id);

    setDependencyForm({
      field_id: firstField?.id ?? 0,
      option_id: firstField?.options.find((option) => option.active)?.id ?? 0,
      depends_on_field_id: secondField?.id ?? 0,
      depends_on_option_id: secondField?.options.find((option) => option.active)?.id ?? 0,
    });
    setDependencyFormOpen(true);
    setFormError("");
  }

  function startBulkDependencyDefaults() {
    const firstField = activeSelectFields[0];
    const secondField = activeSelectFields.find((field) => field.id !== firstField?.id);

    setBulkDependencyForm({
      field_id: firstField?.id ?? 0,
      option_ids: [],
      depends_on_field_id: secondField?.id ?? 0,
      depends_on_option_id: secondField?.options.find((option) => option.active)?.id ?? 0,
    });
    setBulkDependencySummary(null);
    setFormError("");
  }

  function activeOptionsForField(fieldId: number) {
    return fields.find((field) => field.id === fieldId)?.options.filter((option) => option.active) ?? [];
  }

  function parseMetadata() {
    try {
      const parsed = JSON.parse(optionForm.metadataText || "{}");

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("La metadata debe ser un objeto JSON.");
      }

      return parsed as Record<string, string | number | boolean | null>;
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : "La metadata no es JSON valido.");
    }
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      const payload: {
        slug: string;
        label: string;
        input_type: OperationalHeaderInputType;
        required: boolean;
        active: boolean;
        sort_order: number;
        groupable: boolean;
        filterable: boolean;
        visible_in_gantt: boolean;
        exportable: boolean;
      } = {
        slug: form.slug,
        label: form.label,
        input_type: form.input_type,
        required: form.required,
        active: form.active,
        sort_order: form.sort_order,
        groupable: form.groupable,
        filterable: form.filterable,
        visible_in_gantt: form.visible_in_gantt,
        exportable: form.exportable,
      };

      if (isEditing && form.id) {
        await updateOperationalHeaderField({ id: form.id, ...payload }, accessToken);
      } else {
        await createOperationalHeaderField(payload, accessToken);
      }

      resetForm();
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar el campo.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteField(field: OperationalHeaderFieldDto) {
    const confirmed = window.confirm(`Eliminar el campo "${field.label}"?`);

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      await deleteOperationalHeaderField(field.id, accessToken);
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo eliminar el campo.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOptionForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      const payload = {
        field_id: optionForm.field_id,
        value: optionForm.value,
        label: optionForm.label,
        active: optionForm.active,
        sort_order: optionForm.sort_order,
        metadata: parseMetadata(),
      };

      if (isEditingOption && optionForm.id) {
        await updateOperationalHeaderOption({ id: optionForm.id, ...payload }, accessToken);
      } else {
        await createOperationalHeaderOption(payload, accessToken);
      }

      resetOptionForm();
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleOption(option: OperationalHeaderFieldOptionDto) {
    setBusy(true);
    setFormError("");

    try {
      await updateOperationalHeaderOption({ id: option.id, active: !option.active }, accessToken);
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo actualizar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOption(option: OperationalHeaderFieldOptionDto) {
    const confirmed = window.confirm(`Eliminar la opcion "${option.label}"?`);

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      await deleteOperationalHeaderOption(option.id, accessToken);
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo eliminar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDependencyForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    try {
      await createOperationalHeaderDependency(dependencyForm, accessToken);
      resetDependencyForm();
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar la dependencia.");
    } finally {
      setBusy(false);
    }
  }

  async function submitBulkDependencyForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError("");

    if (isBulkDependencySameField(bulkDependencyForm)) {
      setBulkDependencySummary({
        created: 0,
        skipped: 0,
        blocked: bulkDependencyForm.option_ids.length,
      });
      setFormError("No se puede usar el mismo campo como dependiente y padre.");
      setBusy(false);
      return;
    }

    const candidateOptionIds = getBulkDependencyCandidateOptionIds({
      draft: bulkDependencyForm,
      dependencies,
    });
    const summary = createBulkDependencySummary({
      selectedCount: bulkDependencyForm.option_ids.length,
      candidateCount: candidateOptionIds.length,
      created: 0,
      blocked: 0,
    });

    try {
      for (const optionId of candidateOptionIds) {
        try {
          await createOperationalHeaderDependency({
            field_id: bulkDependencyForm.field_id,
            option_id: optionId,
            depends_on_field_id: bulkDependencyForm.depends_on_field_id,
            depends_on_option_id: bulkDependencyForm.depends_on_option_id,
          }, accessToken);
          summary.created += 1;
        } catch {
          summary.blocked += 1;
        }
      }

      setBulkDependencySummary(summary);
      if (summary.created > 0) {
        onRefresh();
      }
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudieron crear las dependencias.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDependency(dependency: OperationalHeaderOptionDependencyDto) {
    const dependentField = fieldsById.get(dependency.field_id);
    const dependentOption = optionsById.get(dependency.option_id)?.option;
    const confirmed = window.confirm(
      `Eliminar dependencia "${dependentField?.label ?? dependency.field_id} / ${dependentOption?.label ?? dependency.option_id}"?`
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      await deleteOperationalHeaderDependency(dependency.id, accessToken);
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo eliminar la dependencia.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="operational-header-admin">
      <div className="catalog-category-header">
        <div>
          <p className="eyebrow">Cabecera Operacional</p>
          <h2 className="card-title" style={{ marginTop: 10 }}>
            Configuracion de campos
          </h2>
        </div>
        <div className="catalog-inline-actions">
          <span className="catalog-count">{fields.length} campos</span>
          <button type="button" className="button small primary" onClick={startCreate}>
            Nuevo campo
          </button>
        </div>
      </div>

      {loading ? <p className="body-copy">Cargando cabecera operacional...</p> : null}
      {error ? <p className="feedback">{error}</p> : null}
      {formError ? <p className="feedback">{formError}</p> : null}

      {formOpen ? (
        <form className="operational-header-field-form" onSubmit={submitForm}>
          <div className="catalog-category-header">
            <div>
              <p className="eyebrow">{isEditing ? "Editar campo" : "Nuevo campo"}</p>
              <h3 className="card-title">{isEditing ? form.label || "Campo" : "Campo de cabecera"}</h3>
            </div>
          </div>

          <section className="operational-header-config-section">
            <p className="eyebrow">Configuración del campo</p>
            <div className="operational-header-form-grid">
              <label className="field">
                Nombre visible
                <input
                  className="field-input"
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  disabled={busy}
                />
              </label>

              <label className="field">
                Slug
                <input
                  className="field-input"
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  disabled={busy}
                />
              </label>

              <label className="field">
                Tipo
                <select
                  className="field-input"
                  value={form.input_type}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    input_type: event.target.value as OperationalHeaderInputType,
                  }))}
                  disabled={busy}
                >
                  <option value="text">text</option>
                  <option value="select">select</option>
                </select>
                {isTextToSelectConversion ? (
                  <span className="field-hint">
                    Los valores existentes se conservarán como texto. Los nuevos registros usarán opciones configuradas.
                  </span>
                ) : null}
              </label>

              <label className="field">
                Orden
                <input
                  className="field-input"
                  type="number"
                  value={form.sort_order}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    sort_order: Number(event.target.value),
                  }))}
                  disabled={busy}
                />
              </label>
            </div>

            <div className="operational-header-form-flags">
              <FlagCheckbox label="required" checked={form.required} onChange={(required) => setForm((current) => ({ ...current, required }))} />
              <FlagCheckbox label="active" checked={form.active} onChange={(active) => setForm((current) => ({ ...current, active }))} />
              <FlagCheckbox label="groupable" checked={form.groupable} onChange={(groupable) => setForm((current) => ({ ...current, groupable }))} />
              <FlagCheckbox label="filterable" checked={form.filterable} onChange={(filterable) => setForm((current) => ({ ...current, filterable }))} />
              <FlagCheckbox label="visible_in_gantt" checked={form.visible_in_gantt} onChange={(visible_in_gantt) => setForm((current) => ({ ...current, visible_in_gantt }))} />
              <FlagCheckbox label="exportable" checked={form.exportable} onChange={(exportable) => setForm((current) => ({ ...current, exportable }))} />
            </div>
          </section>

          <div className="catalog-inline-actions">
            <button type="submit" className="button small primary" disabled={busy || !form.label.trim() || !form.slug.trim()}>
              {isEditing ? "Guardar" : "Crear campo"}
            </button>
            <button type="button" className="button small" onClick={resetForm} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {!loading && !error && !fields.length ? (
        <div className="catalog-future-card">
          <p className="eyebrow">Sin campos</p>
          <p className="body-copy">
            Aun no hay campos de cabecera operacional configurados.
          </p>
        </div>
      ) : null}

      {fields.length ? (
        <div className="operational-header-field-list">
          {fields.map((field) => (
            <article key={field.id} className="operational-header-field-row">
              <section className="operational-header-config-section">
                <p className="eyebrow">Configuración del campo</p>
                <div className="operational-header-field-main">
                  <div>
                    <h3>{field.label}</h3>
                    <p>
                      slug: <code>{field.slug}</code> · tipo: <code>{field.input_type}</code> · orden:{" "}
                      <code>{field.sort_order}</code>
                    </p>
                  </div>
                  <div className="catalog-inline-actions">
                    <button type="button" className="button icon-button small" onClick={() => startEdit(field)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="button icon-button small danger"
                      disabled={busy}
                      title="Eliminar campo"
                      onClick={() => void deleteField(field)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <div className="operational-header-flags" aria-label={`Flags de ${field.label}`}>
                  <BooleanFlag label="required" value={field.required} />
                  <BooleanFlag label="active" value={field.active} />
                  <BooleanFlag label="groupable" value={field.groupable} />
                  <BooleanFlag label="filterable" value={field.filterable} />
                  <BooleanFlag label="visible_in_gantt" value={field.visible_in_gantt} />
                  <BooleanFlag label="exportable" value={field.exportable} />
                </div>
              </section>

              <div className="operational-header-options">
                <div className="operational-header-options-header">
                  <p className="eyebrow">Opciones del campo</p>
                  {field.input_type === "select" ? (
                    <button
                      type="button"
                      className="button small"
                      disabled={busy}
                      onClick={() => startCreateOption(field)}
                    >
                      Nueva opción
                    </button>
                  ) : null}
                </div>

                {optionFormOpen && optionForm.field_id === field.id ? (
                  <form className="operational-header-option-form" onSubmit={submitOptionForm}>
                    <div className="operational-header-form-grid">
                      <label className="field">
                        Valor
                        <input
                          className="field-input"
                          value={optionForm.value}
                          onChange={(event) => setOptionForm((current) => ({ ...current, value: event.target.value }))}
                          disabled={busy}
                        />
                      </label>
                      <label className="field">
                        Nombre
                        <input
                          className="field-input"
                          value={optionForm.label}
                          onChange={(event) => setOptionForm((current) => ({ ...current, label: event.target.value }))}
                          disabled={busy}
                        />
                      </label>
                      <label className="field">
                        Orden
                        <input
                          className="field-input"
                          type="number"
                          value={optionForm.sort_order}
                          onChange={(event) => setOptionForm((current) => ({
                            ...current,
                            sort_order: Number(event.target.value),
                          }))}
                          disabled={busy}
                        />
                      </label>
                      <FlagCheckbox
                        label="active"
                        checked={optionForm.active}
                        onChange={(active) => setOptionForm((current) => ({ ...current, active }))}
                      />
                    </div>
                    <label className="field">
                      Metadata JSON
                      <textarea
                        className="field-input"
                        rows={4}
                        value={optionForm.metadataText}
                        onChange={(event) => setOptionForm((current) => ({ ...current, metadataText: event.target.value }))}
                        disabled={busy}
                      />
                    </label>
                    <div className="catalog-inline-actions">
                      <button
                        type="submit"
                        className="button small primary"
                        disabled={busy || !optionForm.value.trim() || !optionForm.label.trim()}
                      >
                        {isEditingOption ? "Guardar opcion" : "Crear opcion"}
                      </button>
                      <button type="button" className="button small" onClick={resetOptionForm} disabled={busy}>
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : null}

                {field.options.length ? (
                  <div className="operational-header-option-grid">
                    {field.options.map((option) => (
                      <div key={option.id} className="operational-header-option-row">
                        <span>{option.label}</span>
                        <code>{option.value}</code>
                        <span>{option.active ? "Activa" : "Inactiva"}</span>
                        <span>Orden {option.sort_order}</span>
                        <div className="catalog-inline-actions">
                          <button type="button" className="button icon-button small" onClick={() => startEditOption(option)}>
                            Editar opcion
                          </button>
                          <button
                            type="button"
                            className="button icon-button small"
                            disabled={busy}
                            onClick={() => void toggleOption(option)}
                          >
                            {option.active ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            className="button icon-button small danger"
                            disabled={busy}
                            onClick={() => void deleteOption(option)}
                          >
                            Eliminar opcion
                          </button>
                        </div>
                        {Object.keys(option.metadata).length ? (
                          <code className="operational-header-option-metadata">
                            {JSON.stringify(option.metadata)}
                          </code>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="body-copy">
                    {field.input_type === "select" ? "Sin opciones." : "Este campo no usa opciones porque es de tipo texto."}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {fields.length ? (
        <section className="operational-header-dependencies">
          <div className="operational-header-options-header">
            <p className="eyebrow">Dependencias</p>
            <button
              type="button"
              className="button small"
              disabled={busy || activeSelectFields.length < 2}
              onClick={startCreateDependency}
            >
              Nueva dependencia
            </button>
          </div>

          {dependencyFormOpen ? (
            <form className="operational-header-option-form" onSubmit={submitDependencyForm}>
              <div className="operational-header-form-grid">
                <label className="field">
                  Campo dependiente
                  <select
                    className="field-input"
                    value={dependencyForm.field_id}
                    onChange={(event) => {
                      const fieldId = Number(event.target.value);
                      setDependencyForm((current) => ({
                        ...current,
                        field_id: fieldId,
                        option_id: activeOptionsForField(fieldId)[0]?.id ?? 0,
                      }));
                    }}
                    disabled={busy}
                  >
                    <option value={0}>Selecciona</option>
                    {activeSelectFields.map((field) => (
                      <option key={field.id} value={field.id}>{field.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Opcion dependiente
                  <select
                    className="field-input"
                    value={dependencyForm.option_id}
                    onChange={(event) => setDependencyForm((current) => ({
                      ...current,
                      option_id: Number(event.target.value),
                    }))}
                    disabled={busy || !dependencyForm.field_id}
                  >
                    <option value={0}>Selecciona</option>
                    {activeOptionsForField(dependencyForm.field_id).map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Campo padre
                  <select
                    className="field-input"
                    value={dependencyForm.depends_on_field_id}
                    onChange={(event) => {
                      const fieldId = Number(event.target.value);
                      setDependencyForm((current) => ({
                        ...current,
                        depends_on_field_id: fieldId,
                        depends_on_option_id: activeOptionsForField(fieldId)[0]?.id ?? 0,
                      }));
                    }}
                    disabled={busy}
                  >
                    <option value={0}>Selecciona</option>
                    {activeSelectFields.map((field) => (
                      <option key={field.id} value={field.id}>{field.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Opcion padre
                  <select
                    className="field-input"
                    value={dependencyForm.depends_on_option_id}
                    onChange={(event) => setDependencyForm((current) => ({
                      ...current,
                      depends_on_option_id: Number(event.target.value),
                    }))}
                    disabled={busy || !dependencyForm.depends_on_field_id}
                  >
                    <option value={0}>Selecciona</option>
                    {activeOptionsForField(dependencyForm.depends_on_field_id).map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="catalog-inline-actions">
                <button
                  type="submit"
                  className="button small primary"
                  disabled={
                    busy ||
                    !dependencyForm.field_id ||
                    !dependencyForm.option_id ||
                    !dependencyForm.depends_on_field_id ||
                    !dependencyForm.depends_on_option_id
                  }
                >
                  Crear dependencia
                </button>
                <button type="button" className="button small" onClick={resetDependencyForm} disabled={busy}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          <form className="operational-header-option-form" onSubmit={submitBulkDependencyForm}>
            <div className="operational-header-options-header">
              <div>
                <p className="eyebrow">Acción masiva</p>
                <p className="body-copy">
                  Selecciona varias opciones hijas y asígnalas a una opción padre.
                </p>
              </div>
              <button
                type="button"
                className="button small"
                disabled={busy || activeSelectFields.length < 2}
                onClick={startBulkDependencyDefaults}
              >
                Preparar acción masiva
              </button>
            </div>

            <div className="operational-header-form-grid">
              <label className="field">
                Campo dependiente
                <select
                  className="field-input"
                  value={bulkDependencyForm.field_id}
                  onChange={(event) => {
                    const fieldId = Number(event.target.value);
                    setBulkDependencyForm((current) => ({
                      ...current,
                      field_id: fieldId,
                      option_ids: [],
                    }));
                    setBulkDependencySummary(null);
                  }}
                  disabled={busy || activeSelectFields.length < 2}
                >
                  <option value={0}>Selecciona</option>
                  {activeSelectFields.map((field) => (
                    <option key={field.id} value={field.id}>{field.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                Opciones hijas
                <select
                  className="field-input"
                  multiple
                  size={Math.min(Math.max(activeOptionsForField(bulkDependencyForm.field_id).length, 3), 8)}
                  value={bulkDependencyForm.option_ids.map(String)}
                  onChange={(event) => {
                    const optionIds = Array.from(event.currentTarget.selectedOptions, (option) => Number(option.value));
                    setBulkDependencyForm((current) => ({
                      ...current,
                      option_ids: optionIds,
                    }));
                    setBulkDependencySummary(null);
                  }}
                  disabled={busy || !bulkDependencyForm.field_id}
                >
                  {activeOptionsForField(bulkDependencyForm.field_id).map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                Campo padre
                <select
                  className="field-input"
                  value={bulkDependencyForm.depends_on_field_id}
                  onChange={(event) => {
                    const fieldId = Number(event.target.value);
                    setBulkDependencyForm((current) => ({
                      ...current,
                      depends_on_field_id: fieldId,
                      depends_on_option_id: activeOptionsForField(fieldId)[0]?.id ?? 0,
                    }));
                    setBulkDependencySummary(null);
                  }}
                  disabled={busy || activeSelectFields.length < 2}
                >
                  <option value={0}>Selecciona</option>
                  {activeSelectFields.map((field) => (
                    <option key={field.id} value={field.id}>{field.label}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                Opción padre
                <select
                  className="field-input"
                  value={bulkDependencyForm.depends_on_option_id}
                  onChange={(event) => {
                    setBulkDependencyForm((current) => ({
                      ...current,
                      depends_on_option_id: Number(event.target.value),
                    }));
                    setBulkDependencySummary(null);
                  }}
                  disabled={busy || !bulkDependencyForm.depends_on_field_id}
                >
                  <option value={0}>Selecciona</option>
                  {activeOptionsForField(bulkDependencyForm.depends_on_field_id).map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="catalog-inline-actions">
              <button
                type="submit"
                className="button small primary"
                disabled={
                  busy ||
                  !bulkDependencyForm.field_id ||
                  !bulkDependencyForm.option_ids.length ||
                  !bulkDependencyForm.depends_on_field_id ||
                  !bulkDependencyForm.depends_on_option_id ||
                  isBulkDependencySameField(bulkDependencyForm)
                }
              >
                Crear dependencias
              </button>
            </div>

            {isBulkDependencySameField(bulkDependencyForm) ? (
              <p className="feedback">No se puede usar el mismo campo como dependiente y padre.</p>
            ) : null}

            {bulkDependencySummary ? (
              <p className="body-copy">
                Resultado: creadas: {bulkDependencySummary.created} · omitidas por existir:{" "}
                {bulkDependencySummary.skipped} · bloqueadas/error: {bulkDependencySummary.blocked}
              </p>
            ) : null}
          </form>

          {dependencies.length ? (
            dependencies.map((dependency) => (
              <div key={dependency.id} className="operational-header-dependency-item">
                <DependencyRow
                  dependency={dependency}
                  fieldsById={fieldsById}
                  optionsById={optionsById}
                />
                <button
                  type="button"
                  className="button icon-button small danger"
                  disabled={busy}
                  onClick={() => void deleteDependency(dependency)}
                >
                  Eliminar dependencia
                </button>
              </div>
            ))
          ) : (
            <p className="body-copy">Sin dependencias configuradas.</p>
          )}
        </section>
      ) : null}
    </section>
  );
}
