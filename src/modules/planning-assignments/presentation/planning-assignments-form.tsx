import { Plus, Trash2 } from "lucide-react";
import type { AssignmentFieldDto, AssignmentTypeDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  createEmptyPlanningAssignmentInstance,
  type PlanningAssignmentFieldFormValue,
  type PlanningAssignmentsFormState,
} from "@/modules/planning-assignments/presentation/planning-assignments-form-model";

function visibleOptions(field: AssignmentFieldDto, selectedIds: string[]) {
  const selected = new Set(selectedIds.map(Number));
  return field.options.filter((option) => option.active || selected.has(option.id));
}

type PlanningAssignmentsFormProps = {
  types: AssignmentTypeDto[];
  value: PlanningAssignmentsFormState;
  onChange: (value: PlanningAssignmentsFormState) => void;
  online: boolean;
  title?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
};

export function PlanningAssignmentsForm({ types, value, onChange, online, title = "Asignaciones", disabled, loading, error }: PlanningAssignmentsFormProps) {
  if (loading) {
    return <section className="assignments-form-section"><div className="custom-fields-heading"><p className="eyebrow">{title}</p><span className="catalog-count">Cargando</span></div></section>;
  }

  if (error) {
    return <section className="assignments-form-section"><p className="feedback">{error}</p></section>;
  }

  if (!types.length) {
    return online ? null : <section className="assignments-form-section"><p className="feedback">Sin conexion. No hay definiciones locales de asignaciones disponibles para este equipo.</p></section>;
  }

  function updateInstances(typeId: number, instances: PlanningAssignmentsFormState[number]) {
    onChange({ ...value, [typeId]: instances });
  }

  function updateField(typeId: number, instanceOrder: number, fieldId: number, nextValue: PlanningAssignmentFieldFormValue) {
    updateInstances(typeId, (value[typeId] ?? []).map((instance) =>
      instance.instanceOrder === instanceOrder
        ? { ...instance, values: { ...instance.values, [fieldId]: { ...(instance.values[fieldId] ?? {}), ...nextValue } } }
        : instance
    ));
  }

  return (
    <section className="assignments-form-section">
      <div className="custom-fields-heading"><p className="eyebrow">{title}</p><span className="catalog-count">{online ? "Online" : "Offline"}</span></div>
      {!online ? <p className="feedback">Trabajando con definiciones locales. Las asignaciones se sincronizaran cuando vuelva la conexion.</p> : null}
      {types.map((type) => {
        const instances = value[type.id] ?? [];
        return (
          <div className="assignments-form-type" key={type.id}>
            <div className="custom-fields-heading">
              <div><h3 className="card-title">{type.label}</h3>{type.description ? <p className="body-copy">{type.description}</p> : null}</div>
              <button type="button" className="button small" disabled={disabled || instances.length >= type.max_instances} onClick={() => updateInstances(type.id, [...instances, createEmptyPlanningAssignmentInstance(instances.length + 1)])}><Plus className="button-icon" />Agregar</button>
            </div>
            {instances.length === 0 ? <p className="body-copy">Sin instancias agregadas.</p> : null}
            {instances.map((instance) => (
              <article className="assignments-form-instance" key={instance.instanceOrder}>
                <div className="custom-fields-heading"><h4 className="custom-fields-options-title">{type.label} #{instance.instanceOrder}</h4><button type="button" className="button icon-button small danger" title="Eliminar instancia" aria-label={`Eliminar ${type.label} ${instance.instanceOrder}`} disabled={disabled} onClick={() => updateInstances(type.id, instances.filter((entry) => entry.instanceOrder !== instance.instanceOrder).map((entry, index) => ({ ...entry, instanceOrder: index + 1 })))}><Trash2 /></button></div>
                <div className="modal-grid">
                  {type.fields.map((field) => {
                    const current = instance.values[field.id] ?? {};
                    const fieldDisabled = disabled || !field.active;
                    const label = field.active ? field.label : `${field.label} (inactivo)`;
                    if (field.input_type === "select") return <label className="field" key={field.id}>{label}<select className="field-input" value={current.optionId ?? ""} disabled={fieldDisabled} required={field.required} onChange={(event) => updateField(type.id, instance.instanceOrder, field.id, { optionId: event.target.value })}><option value="">Sin seleccionar</option>{visibleOptions(field, current.optionId ? [current.optionId] : []).map((option) => <option key={option.id} value={option.id}>{option.active ? option.label : `${option.label} (inactiva)`}</option>)}</select></label>;
                    if (field.input_type === "multi_select") return <div className="field" key={field.id}><span>{label}</span><div className="assignments-multi-options">{visibleOptions(field, current.optionIds ?? []).map((option) => { const optionId = String(option.id); return <label className="custom-fields-multi-option" key={option.id}><input type="checkbox" checked={(current.optionIds ?? []).includes(optionId)} disabled={fieldDisabled} onChange={(event) => updateField(type.id, instance.instanceOrder, field.id, { optionIds: event.target.checked ? [...(current.optionIds ?? []), optionId] : (current.optionIds ?? []).filter((id) => id !== optionId) })} /><span>{option.label}</span></label>; })}</div>{field.required && !(current.optionIds ?? []).length ? <input className="custom-fields-required-proxy" tabIndex={-1} required value="" onChange={() => undefined} /> : null}</div>;
                    if (field.input_type === "number") return <label className="field" key={field.id}>{label}<input className="field-input" type="number" value={current.valueNumber ?? ""} disabled={fieldDisabled} required={field.required} onChange={(event) => updateField(type.id, instance.instanceOrder, field.id, { valueNumber: event.target.value })} /></label>;
                    if (field.input_type === "date") return <label className="field" key={field.id}>{label}<input className="field-input" type="date" value={current.valueDate ?? ""} disabled={fieldDisabled} required={field.required} onChange={(event) => updateField(type.id, instance.instanceOrder, field.id, { valueDate: event.target.value })} /></label>;
                    if (field.input_type === "boolean") return <label className="field custom-fields-checkbox" key={field.id}><input type="checkbox" checked={current.valueBoolean ?? false} disabled={fieldDisabled} onChange={(event) => updateField(type.id, instance.instanceOrder, field.id, { valueBoolean: event.target.checked })} /><span>{label}</span></label>;
                    return <label className="field" key={field.id}>{label}<input className="field-input" value={current.valueText ?? ""} disabled={fieldDisabled} required={field.required} onChange={(event) => updateField(type.id, instance.instanceOrder, field.id, { valueText: event.target.value })} /></label>;
                  })}
                </div>
              </article>
            ))}
          </div>
        );
      })}
    </section>
  );
}
