"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import {
  createAssignmentField,
  createAssignmentFieldOption,
  createAssignmentType,
  deleteAssignmentField,
  deleteAssignmentFieldOption,
  deleteAssignmentType,
  fetchAssignmentTypes,
  updateAssignmentField,
  updateAssignmentFieldOption,
  updateAssignmentType,
} from "@/modules/planning-assignments/application/planning-assignments.client";
import type {
  AssignmentFieldDto,
  AssignmentFieldInputType,
  AssignmentFieldOptionDto,
  AssignmentTypeIconKey,
  AssignmentTypeDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  formatAssignmentOptionMetadata,
  parseAssignmentOptionMetadata,
} from "@/modules/planning-assignments/presentation/planning-assignments-admin-metadata";
import {
  ASSIGNMENT_TYPE_ICON_OPTIONS,
  getAssignmentTypeIcon,
} from "@/modules/planning-assignments/presentation/planning-assignment-type-icons";

type AssignmentTypeForm = {
  slug: string;
  label: string;
  description: string;
  iconKey: AssignmentTypeIconKey | "";
  maxInstances: string;
  sortOrder: string;
  active: boolean;
};

type AssignmentFieldForm = {
  slug: string;
  label: string;
  inputType: AssignmentFieldInputType;
  suffix: string;
  required: boolean;
  sortOrder: string;
  active: boolean;
  config: string;
};

type AssignmentOptionForm = {
  value: string;
  label: string;
  sortOrder: string;
  active: boolean;
  metadata: string;
};

const defaultTypeForm: AssignmentTypeForm = {
  slug: "",
  label: "",
  description: "",
  iconKey: "",
  maxInstances: "2",
  sortOrder: "100",
  active: true,
};

const defaultFieldForm: AssignmentFieldForm = {
  slug: "",
  label: "",
  inputType: "text",
  suffix: "",
  required: false,
  sortOrder: "100",
  active: true,
  config: "",
};

const defaultOptionForm: AssignmentOptionForm = {
  value: "",
  label: "",
  sortOrder: "100",
  active: true,
  metadata: "{}",
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

function parseConfig(value: string) {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("La configuracion avanzada debe ser un objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

function formatConfig(value: Record<string, unknown>) {
  return Object.keys(value).length ? JSON.stringify(value, null, 2) : "";
}

const ASSIGNMENT_FIELD_SUFFIX_MAX_LENGTH = 24;

function getConfigSuffix(config: Record<string, unknown>) {
  return typeof config.suffix === "string" ? config.suffix : "";
}

function withConfigSuffix(config: Record<string, unknown>, suffix: string) {
  const nextConfig = { ...config };
  const normalizedSuffix = suffix.trim();
  if (normalizedSuffix.length > ASSIGNMENT_FIELD_SUFFIX_MAX_LENGTH) {
    throw new Error(`El sufijo debe tener maximo ${ASSIGNMENT_FIELD_SUFFIX_MAX_LENGTH} caracteres.`);
  }
  if (normalizedSuffix) {
    nextConfig.suffix = normalizedSuffix;
  } else {
    delete nextConfig.suffix;
  }
  return nextConfig;
}

function isOptionField(field?: AssignmentFieldDto | null) {
  return field?.input_type === "select" || field?.input_type === "multi_select";
}

function AssignmentTypeIcon({ iconKey }: { iconKey?: AssignmentTypeIconKey | null }) {
  const TypeIcon = getAssignmentTypeIcon(iconKey);
  return <TypeIcon aria-hidden="true" />;
}

type PlanningAssignmentsAdminPanelProps = {
  accessToken?: string;
};

export function PlanningAssignmentsAdminPanel({ accessToken }: PlanningAssignmentsAdminPanelProps) {
  const [types, setTypes] = useState<AssignmentTypeDto[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [typeForm, setTypeForm] = useState<AssignmentTypeForm>(defaultTypeForm);
  const [fieldForm, setFieldForm] = useState<AssignmentFieldForm>(defaultFieldForm);
  const [optionForm, setOptionForm] = useState<AssignmentOptionForm>(defaultOptionForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedType = useMemo(
    () => types.find((type) => type.id === selectedTypeId) ?? types[0] ?? null,
    [selectedTypeId, types]
  );
  const selectedField = useMemo(
    () => selectedType?.fields.find((field) => field.id === selectedFieldId) ?? selectedType?.fields[0] ?? null,
    [selectedFieldId, selectedType]
  );

  async function refreshTypes(preferredTypeId?: number | null, preferredFieldId?: number | null) {
    const nextTypes = await fetchAssignmentTypes(accessToken, { activeOnly: false });
    const nextTypeId = preferredTypeId ?? selectedTypeId ?? nextTypes[0]?.id ?? null;
    const nextType = nextTypes.find((type) => type.id === nextTypeId) ?? nextTypes[0] ?? null;
    setTypes(nextTypes);
    setSelectedTypeId(nextType?.id ?? null);
    setSelectedFieldId((current) => {
      const nextFieldId = preferredFieldId ?? current;
      return nextType?.fields.some((field) => field.id === nextFieldId) ? nextFieldId : nextType?.fields[0]?.id ?? null;
    });
    return nextTypes;
  }

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetchAssignmentTypes(accessToken, { activeOnly: false })
      .then((nextTypes) => {
        if (!active) return;
        setTypes(nextTypes);
        setSelectedTypeId((current) => current ?? nextTypes[0]?.id ?? null);
      })
      .catch((nextError: unknown) => {
        if (active) setError(nextError instanceof Error ? nextError.message : "No se pudieron cargar las asignaciones.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  function resetTypeForm() {
    setEditingTypeId(null);
    setTypeForm(defaultTypeForm);
  }

  function resetFieldForm() {
    setEditingFieldId(null);
    setFieldForm(defaultFieldForm);
  }

  function resetOptionForm() {
    setEditingOptionId(null);
    setOptionForm(defaultOptionForm);
  }

  function selectType(type: AssignmentTypeDto) {
    setSelectedTypeId(type.id);
    setSelectedFieldId(type.fields[0]?.id ?? null);
    resetFieldForm();
    resetOptionForm();
  }

  function selectField(field: AssignmentFieldDto) {
    setSelectedFieldId(field.id);
    resetOptionForm();
  }

  async function submitType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        slug: typeForm.slug || normalizeAdminValue(typeForm.label),
        label: typeForm.label,
        description: typeForm.description || null,
        icon_key: typeForm.iconKey || null,
        max_instances: Number(typeForm.maxInstances),
        sort_order: Number(typeForm.sortOrder) || 100,
        active: typeForm.active,
      };
      const type = editingTypeId
        ? await updateAssignmentType({ id: editingTypeId, ...payload }, accessToken)
        : await createAssignmentType(payload, accessToken);
      resetTypeForm();
      await refreshTypes(type.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el tipo de asignacion.");
    } finally {
      setBusy(false);
    }
  }

  async function submitField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedType) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        assignment_type_id: selectedType.id,
        slug: fieldForm.slug || normalizeAdminValue(fieldForm.label),
        label: fieldForm.label,
        input_type: fieldForm.inputType,
        required: fieldForm.required,
        sort_order: Number(fieldForm.sortOrder) || 100,
        active: fieldForm.active,
        config: withConfigSuffix(parseConfig(fieldForm.config), fieldForm.suffix),
      };
      const field = editingFieldId
        ? await updateAssignmentField({ id: editingFieldId, ...payload }, accessToken)
        : await createAssignmentField(payload, accessToken);
      resetFieldForm();
      await refreshTypes(selectedType.id, field.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el campo.");
    } finally {
      setBusy(false);
    }
  }

  async function submitOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedField || !isOptionField(selectedField)) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        field_id: selectedField.id,
        value: optionForm.value || normalizeAdminValue(optionForm.label),
        label: optionForm.label,
        sort_order: Number(optionForm.sortOrder) || 100,
        active: optionForm.active,
        metadata: parseAssignmentOptionMetadata(optionForm.metadata),
      };
      if (editingOptionId) {
        await updateAssignmentFieldOption({ id: editingOptionId, ...payload }, accessToken);
      } else {
        await createAssignmentFieldOption(payload, accessToken);
      }
      resetOptionForm();
      await refreshTypes(selectedType?.id, selectedField.id);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo guardar la opcion.");
    } finally {
      setBusy(false);
    }
  }

  function editType(type: AssignmentTypeDto) {
    setEditingTypeId(type.id);
    setTypeForm({
      slug: type.slug,
      label: type.label,
      description: type.description ?? "",
      iconKey: type.icon_key ?? "",
      maxInstances: String(type.max_instances),
      sortOrder: String(type.sort_order),
      active: type.active,
    });
  }

  function editField(field: AssignmentFieldDto) {
    setEditingFieldId(field.id);
    setFieldForm({
      slug: field.slug,
      label: field.label,
      inputType: field.input_type,
      suffix: getConfigSuffix(field.config),
      required: field.required,
      sortOrder: String(field.sort_order),
      active: field.active,
      config: formatConfig(field.config),
    });
  }

  function editOption(option: AssignmentFieldOptionDto) {
    setEditingOptionId(option.id);
    setOptionForm({
      value: option.value,
      label: option.label,
      sortOrder: String(option.sort_order),
      active: option.active,
      metadata: formatAssignmentOptionMetadata(option.metadata),
    });
  }

  async function runMutation(action: () => Promise<unknown>, fallback: string, preferredFieldId?: number | null) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refreshTypes(selectedType?.id, preferredFieldId);
    } catch (nextError: unknown) {
      setError(nextError instanceof Error ? nextError.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="body-copy">Cargando asignaciones...</p>;
  }

  return (
    <div className="assignments-admin">
      {error ? <p className="feedback">{error}</p> : null}
      <div className="assignments-admin-grid">
        <section className="surface-card soft padded assignments-admin-column">
          <div className="catalog-category-header">
            <div>
              <p className="eyebrow">Asignaciones</p>
              <h3 className="card-title">Tipos</h3>
            </div>
            <span className="catalog-count">{types.length}</span>
          </div>
          <form className="modal-form" onSubmit={submitType}>
            <label className="field">Nombre<input className="field-input" value={typeForm.label} onChange={(event) => setTypeForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ej: Cuadrillas" /></label>
            <label className="field">Slug<input className="field-input" value={typeForm.slug} onChange={(event) => setTypeForm((current) => ({ ...current, slug: normalizeAdminValue(event.target.value) }))} placeholder="cuadrillas" /></label>
            <label className="field">Descripcion<input className="field-input" value={typeForm.description} onChange={(event) => setTypeForm((current) => ({ ...current, description: event.target.value }))} placeholder="Opcional" /></label>
            <label className="field">Icono<select className="field-input" value={typeForm.iconKey} onChange={(event) => setTypeForm((current) => ({ ...current, iconKey: event.target.value as AssignmentTypeIconKey | "" }))}><option value="">Sin icono especifico</option>{ASSIGNMENT_TYPE_ICON_OPTIONS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></label>
            <div className="assignment-type-icon-preview"><AssignmentTypeIcon iconKey={typeForm.iconKey || null} /><span>{typeForm.iconKey ? "Vista previa" : "Icono por defecto"}</span></div>
            <div className="modal-grid">
              <label className="field">Maximo<input className="field-input" type="number" min="1" value={typeForm.maxInstances} onChange={(event) => setTypeForm((current) => ({ ...current, maxInstances: event.target.value }))} /></label>
              <label className="field">Orden<input className="field-input" type="number" value={typeForm.sortOrder} onChange={(event) => setTypeForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
            </div>
            <label className="field custom-fields-checkbox"><input type="checkbox" checked={typeForm.active} onChange={(event) => setTypeForm((current) => ({ ...current, active: event.target.checked }))} /><span>Activo</span></label>
            <div className="catalog-inline-actions">
              <button className="button small primary" type="submit" disabled={busy || !typeForm.label.trim()}><Plus className="button-icon" />{editingTypeId ? "Guardar" : "Crear tipo"}</button>
              {editingTypeId ? <button className="button small" type="button" onClick={resetTypeForm}><X className="button-icon" />Cancelar</button> : null}
            </div>
          </form>
          <div className="catalog-detail-list">
            {types.length === 0 ? <p className="body-copy">Sin tipos de asignacion.</p> : null}
            {types.map((type) => (
              <div className="catalog-detail-row assignments-admin-list-row" key={type.id}>
                <button type="button" className={`custom-field-select-button ${selectedType?.id === type.id ? "active" : ""}`} onClick={() => selectType(type)}>
                  <span className="assignment-type-list-label"><AssignmentTypeIcon iconKey={type.icon_key} />{type.label}</span><small>{type.max_instances} max. · {type.active ? "activo" : "inactivo"}</small>
                </button>
                <div className="catalog-inline-actions">
                  <button className="button icon-button small" type="button" title="Editar tipo" aria-label={`Editar ${type.label}`} onClick={() => editType(type)}><Pencil /></button>
                  <button className="button icon-button small" type="button" title={type.active ? "Desactivar tipo" : "Activar tipo"} aria-label={type.active ? `Desactivar ${type.label}` : `Activar ${type.label}`} disabled={busy} onClick={() => void runMutation(() => updateAssignmentType({ id: type.id, active: !type.active }, accessToken), "No se pudo actualizar el tipo.")}><Power /></button>
                  <button className="button icon-button small danger" type="button" title="Eliminar tipo" aria-label={`Eliminar ${type.label}`} disabled={busy} onClick={() => void runMutation(() => deleteAssignmentType(type.id, accessToken), "No se pudo eliminar el tipo.")}><Trash2 /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card soft padded assignments-admin-column">
          <div className="catalog-category-header">
            <div><p className="eyebrow">Campos del tipo</p><h3 className="card-title">{selectedType?.label ?? "Selecciona un tipo"}</h3></div>
            <span className="catalog-count">{selectedType?.fields.length ?? 0}</span>
          </div>
          {selectedType ? (
            <>
              <form className="modal-form" onSubmit={submitField}>
                <label className="field">Nombre<input className="field-input" value={fieldForm.label} onChange={(event) => setFieldForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ej: Departamento" /></label>
                <label className="field">Slug<input className="field-input" value={fieldForm.slug} onChange={(event) => setFieldForm((current) => ({ ...current, slug: normalizeAdminValue(event.target.value) }))} placeholder="departamento" /></label>
                <div className="modal-grid">
                  <label className="field">Tipo<select className="field-input" value={fieldForm.inputType} onChange={(event) => setFieldForm((current) => ({ ...current, inputType: event.target.value as AssignmentFieldInputType }))}><option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="boolean">Boolean</option><option value="select">Select</option><option value="multi_select">Multi select</option></select></label>
                  <label className="field">Orden<input className="field-input" type="number" value={fieldForm.sortOrder} onChange={(event) => setFieldForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
                </div>
                <label className="field">Sufijo<input className="field-input" maxLength={ASSIGNMENT_FIELD_SUFFIX_MAX_LENGTH} value={fieldForm.suffix} onChange={(event) => setFieldForm((current) => ({ ...current, suffix: event.target.value }))} placeholder="Ej: pers." /></label>
                <div className="custom-fields-admin-row"><label className="field custom-fields-checkbox"><input type="checkbox" checked={fieldForm.required} onChange={(event) => setFieldForm((current) => ({ ...current, required: event.target.checked }))} /><span>Requerido</span></label><label className="field custom-fields-checkbox"><input type="checkbox" checked={fieldForm.active} onChange={(event) => setFieldForm((current) => ({ ...current, active: event.target.checked }))} /><span>Activo</span></label></div>
                <details><summary>Configuracion avanzada</summary><label className="field">Config JSON<textarea className="field-input assignments-config-input" value={fieldForm.config} onChange={(event) => setFieldForm((current) => ({ ...current, config: event.target.value }))} placeholder="{}" /></label></details>
                <div className="catalog-inline-actions"><button className="button small primary" type="submit" disabled={busy || !fieldForm.label.trim()}><Plus className="button-icon" />{editingFieldId ? "Guardar" : "Crear campo"}</button>{editingFieldId ? <button className="button small" type="button" onClick={resetFieldForm}><X className="button-icon" />Cancelar</button> : null}</div>
              </form>
              <div className="catalog-detail-list">
                {selectedType.fields.length === 0 ? <p className="body-copy">Sin campos configurados.</p> : null}
                {selectedType.fields.map((field) => (
                  <div className="catalog-detail-row assignments-admin-list-row" key={field.id}>
                    <button type="button" className={`custom-field-select-button ${selectedField?.id === field.id ? "active" : ""}`} onClick={() => selectField(field)}><span>{field.label}</span><small>{field.input_type} · {field.required ? "requerido" : "opcional"} · {field.active ? "activo" : "inactivo"}</small></button>
                    <div className="catalog-inline-actions"><button className="button icon-button small" type="button" title="Editar campo" aria-label={`Editar ${field.label}`} onClick={() => editField(field)}><Pencil /></button><button className="button icon-button small" type="button" title={field.active ? "Desactivar campo" : "Activar campo"} aria-label={field.active ? `Desactivar ${field.label}` : `Activar ${field.label}`} disabled={busy} onClick={() => void runMutation(() => updateAssignmentField({ id: field.id, active: !field.active }, accessToken), "No se pudo actualizar el campo.", field.id)}><Power /></button><button className="button icon-button small danger" type="button" title="Eliminar campo" aria-label={`Eliminar ${field.label}`} disabled={busy} onClick={() => void runMutation(() => deleteAssignmentField(field.id, accessToken), "No se pudo eliminar el campo.")}><Trash2 /></button></div>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="body-copy">Crea un tipo para agregar campos.</p>}
        </section>

        <section className="surface-card soft padded assignments-admin-column">
          <div className="catalog-category-header"><div><p className="eyebrow">Opciones del campo</p><h3 className="card-title">{selectedField?.label ?? "Selecciona un campo"}</h3></div><span className="catalog-count">{selectedField?.options.length ?? 0}</span></div>
          {selectedField && isOptionField(selectedField) ? (
            <>
              <form className="modal-form" onSubmit={submitOption}>
                <label className="field">Label visible<input className="field-input" value={optionForm.label} onChange={(event) => setOptionForm((current) => ({ ...current, label: event.target.value, value: current.value || normalizeAdminValue(event.target.value) }))} placeholder="Ej: Operaciones" /></label>
                <label className="field">Value interno<input className="field-input" value={optionForm.value} onChange={(event) => setOptionForm((current) => ({ ...current, value: normalizeAdminValue(event.target.value) }))} placeholder="operaciones" /></label>
                <label className="field">Orden<input className="field-input" type="number" value={optionForm.sortOrder} onChange={(event) => setOptionForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
                <label className="field">Metadata JSON<textarea className="field-input assignments-config-input" value={optionForm.metadata} onChange={(event) => setOptionForm((current) => ({ ...current, metadata: event.target.value }))} placeholder={'{ "familia": "Jumbo" }'} /></label>
                <label className="field custom-fields-checkbox"><input type="checkbox" checked={optionForm.active} onChange={(event) => setOptionForm((current) => ({ ...current, active: event.target.checked }))} /><span>Activa</span></label>
                <div className="catalog-inline-actions"><button className="button small primary" type="submit" disabled={busy || !optionForm.label.trim()}><Plus className="button-icon" />{editingOptionId ? "Guardar" : "Crear opcion"}</button>{editingOptionId ? <button className="button small" type="button" onClick={resetOptionForm}><X className="button-icon" />Cancelar</button> : null}</div>
              </form>
              <div className="catalog-detail-list">
                {selectedField.options.length === 0 ? <p className="body-copy">Sin opciones configuradas.</p> : null}
                {selectedField.options.map((option) => (
                  <div className="catalog-detail-row assignments-admin-list-row" key={option.id}><span className="catalog-detail-chip">{option.label}{option.active ? "" : " (inactiva)"}</span><div className="catalog-inline-actions"><button className="button icon-button small" type="button" title="Editar opcion" aria-label={`Editar ${option.label}`} onClick={() => editOption(option)}><Pencil /></button><button className="button icon-button small" type="button" title={option.active ? "Desactivar opcion" : "Activar opcion"} aria-label={option.active ? `Desactivar ${option.label}` : `Activar ${option.label}`} disabled={busy} onClick={() => void runMutation(() => updateAssignmentFieldOption({ id: option.id, active: !option.active }, accessToken), "No se pudo actualizar la opcion.", selectedField.id)}><Power /></button><button className="button icon-button small danger" type="button" title="Eliminar opcion" aria-label={`Eliminar ${option.label}`} disabled={busy} onClick={() => void runMutation(() => deleteAssignmentFieldOption(option.id, accessToken), "No se pudo eliminar la opcion.", selectedField.id)}><Trash2 /></button></div></div>
                ))}
              </div>
            </>
          ) : <p className="body-copy">{selectedField ? "Este campo no usa opciones." : "Selecciona un campo select o multi select."}</p>}
        </section>
      </div>
    </div>
  );
}
