"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
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

export { resolveOperationalHeaderGroupingOrder } from "../../modules/operational-header/application/operational-header-ordering";

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
  grouping_order: string;
  groupable: boolean;
  filterable: boolean;
  visible_in_gantt: boolean;
  exportable: boolean;
};

export type OperationalHeaderBehaviorWarningForm = Pick<FieldFormState,
  "active" |
  "required" |
  "input_type" |
  "groupable" |
  "filterable" |
  "visible_in_gantt" |
  "exportable" |
  "grouping_order"
>;

type OptionFormState = {
  id: number | null;
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadataText: string;
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

export type OperationalHeaderDependencyMatrixParentOption = {
  parentOption: OperationalHeaderFieldOptionDto;
  children: Array<{
    option: OperationalHeaderFieldOptionDto;
    dependency: OperationalHeaderOptionDependencyDto | null;
  }>;
  allowedCount: number;
};

export type OperationalHeaderDependencyMatrixField = {
  parentField: OperationalHeaderFieldDto;
  parentOptions: OperationalHeaderDependencyMatrixParentOption[];
};

export type OperationalHeaderRequiredDependencyWarningInput = {
  childFieldLabel: string;
  parentFieldLabel: string;
  parentOptionLabels: string[];
};

const emptyForm: FieldFormState = {
  id: null,
  slug: "",
  label: "",
  input_type: "text",
  required: false,
  active: true,
  sort_order: 100,
  grouping_order: "",
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
    grouping_order: field.grouping_order === null ? "" : String(field.grouping_order),
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

function buildFieldLookup(fields: OperationalHeaderFieldDto[]) {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const optionsById = new Map(fields.flatMap((field) =>
    field.options.map((option) => [option.id, { field, option }] as const)
  ));

  return { fieldsById, optionsById };
}

export function sortOperationalHeaderFields(fields: OperationalHeaderFieldDto[]) {
  return [...fields].sort((left, right) =>
    left.sort_order - right.sort_order || left.label.localeCompare(right.label)
  );
}

export function getInitialOperationalHeaderFieldId(fields: OperationalHeaderFieldDto[]) {
  return sortOperationalHeaderFields(fields)[0]?.id ?? null;
}

export function getNextOperationalHeaderFieldIdAfterDelete(
  fields: OperationalHeaderFieldDto[],
  deletedFieldId: number
) {
  return sortOperationalHeaderFields(fields).find((field) => field.id !== deletedFieldId)?.id ?? null;
}

export function sortOperationalHeaderOptions(options: OperationalHeaderFieldOptionDto[]) {
  return [...options].sort((left, right) =>
    left.sort_order - right.sort_order || left.label.localeCompare(right.label)
  );
}

export function parseOptionalOperationalHeaderOrder(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? Math.trunc(parsedValue) : null;
}

export function getOperationalHeaderBehaviorWarnings(input: {
  form: OperationalHeaderBehaviorWarningForm;
  activeOptionCount: number;
  requiredDependencyWarning?: OperationalHeaderRequiredDependencyWarningInput | null;
}) {
  const warnings: string[] = [];

  if (input.form.required && !input.form.active) {
    warnings.push("Mientras este campo esté inactivo, no será obligatorio en la captura.");
  }

  if (input.form.exportable && !input.form.active) {
    warnings.push("Mientras este campo esté inactivo, no aparecerá en tabla, CSV ni Excel.");
  }

  if (input.form.groupable && !input.form.visible_in_gantt) {
    warnings.push("Este campo puede generar breakdowns si es exportable, pero no agrupará Gantt mientras no sea visible en Gantt.");
  }

  if (input.form.visible_in_gantt && !input.form.groupable) {
    warnings.push("Visible en Gantt no tendrá efecto hasta que el campo sea agrupable.");
  }

  if (input.form.grouping_order.trim() && (!input.form.groupable || !input.form.visible_in_gantt)) {
    warnings.push("El orden de agrupación configurado no tendrá efecto hasta que el campo sea agrupable y visible en Gantt.");
  }

  if (input.form.filterable && !input.form.exportable) {
    warnings.push("Se podrá filtrar por este campo en reportes, pero no aparecerá como columna ni se exportará.");
  }

  if (input.form.required && input.form.active && input.form.input_type === "select" && input.activeOptionCount === 0) {
    warnings.push("Este campo es obligatorio, pero no tiene opciones activas disponibles. Crea o activa opciones en la sección Opciones.");
  }

  if (input.requiredDependencyWarning) {
    warnings.push(formatOperationalHeaderRequiredDependencyWarning(input.requiredDependencyWarning));
  }

  return warnings;
}

function joinOperationalHeaderOptionLabels(labels: string[]) {
  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} y ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

export function formatOperationalHeaderRequiredDependencyWarning(input: OperationalHeaderRequiredDependencyWarningInput) {
  const labels = input.parentOptionLabels.filter(Boolean);

  if (labels.length === 0) {
    return `${input.parentFieldLabel} no tiene opciones con ${input.childFieldLabel} permitido. Como ${input.childFieldLabel} es obligatorio, esa configuración impedirá completar el formulario.`;
  }

  if (labels.length === 1) {
    return `${labels[0]} no tiene ningún ${input.childFieldLabel} permitido. Como ${input.childFieldLabel} es obligatorio, esa combinación impedirá completar el formulario.`;
  }

  if (labels.length <= 3) {
    return `${joinOperationalHeaderOptionLabels(labels)} no tienen ningún ${input.childFieldLabel} permitido. Como ${input.childFieldLabel} es obligatorio, esas combinaciones impedirán completar el formulario.`;
  }

  const visibleLabels = labels.slice(0, 2);
  const hiddenCount = labels.length - visibleLabels.length;

  return `${visibleLabels.join(", ")} y ${hiddenCount} opciones más no tienen ningún ${input.childFieldLabel} permitido. Como ${input.childFieldLabel} es obligatorio, esas combinaciones impedirán completar el formulario.`;
}

export function getOperationalHeaderOptionSelection(input: {
  selectedIds: number[];
  optionId: number;
  checked: boolean;
}) {
  if (input.checked) {
    return Array.from(new Set([...input.selectedIds, input.optionId]));
  }

  return input.selectedIds.filter((id) => id !== input.optionId);
}

export function getAllOperationalHeaderOptionIds(options: OperationalHeaderFieldOptionDto[]) {
  return sortOperationalHeaderOptions(options).map((option) => option.id);
}

export function getOperationalHeaderDependenciesForField(input: {
  fieldId: number;
  dependencies: OperationalHeaderOptionDependencyDto[];
}) {
  return input.dependencies.filter((dependency) => dependency.field_id === input.fieldId);
}

export function getOperationalHeaderDependencyParentFieldIds(dependencies: OperationalHeaderOptionDependencyDto[]) {
  return Array.from(new Set(dependencies.map((dependency) => dependency.depends_on_field_id)));
}

export function buildOperationalHeaderDependencyMatrix(input: {
  field: OperationalHeaderFieldDto;
  fields: OperationalHeaderFieldDto[];
  dependencies: OperationalHeaderOptionDependencyDto[];
  fallbackParentFieldId?: number;
}): OperationalHeaderDependencyMatrixField[] {
  const parentFieldIds = Array.from(new Set([
    ...getOperationalHeaderDependencyParentFieldIds(input.dependencies),
    ...(input.fallbackParentFieldId ? [input.fallbackParentFieldId] : []),
  ]));
  const parentFields = sortOperationalHeaderFields(input.fields.filter((field) =>
    field.id !== input.field.id && parentFieldIds.includes(field.id)
  ));
  const childOptions = sortOperationalHeaderOptions(input.field.options);

  return parentFields.map((parentField) => {
    const parentOptions = sortOperationalHeaderOptions(parentField.options.filter((option) => option.active))
      .map((parentOption) => {
        const children = childOptions.map((option) => {
          const dependency = input.dependencies.find((candidate) =>
            candidate.option_id === option.id &&
            candidate.depends_on_field_id === parentField.id &&
            candidate.depends_on_option_id === parentOption.id
          ) ?? null;

          return { option, dependency };
        });

        return {
          parentOption,
          children,
          allowedCount: children.filter((child) => child.dependency !== null).length,
        };
      });

    return { parentField, parentOptions };
  });
}

export function getInitialOperationalHeaderDependencyParentOptionIds(
  matrix: OperationalHeaderDependencyMatrixField[]
) {
  return matrix.reduce<Record<number, number>>((accumulator, parentField) => {
    accumulator[parentField.parentField.id] = parentField.parentOptions[0]?.parentOption.id ?? 0;
    return accumulator;
  }, {});
}

export function getOperationalHeaderDependencyParentOptionId(input: {
  selectedParentOptionIds: Record<number, number>;
  parentField: OperationalHeaderDependencyMatrixField;
}) {
  const selectedId = input.selectedParentOptionIds[input.parentField.parentField.id] ?? 0;

  if (input.parentField.parentOptions.some((group) => group.parentOption.id === selectedId)) {
    return selectedId;
  }

  return input.parentField.parentOptions[0]?.parentOption.id ?? 0;
}

export function reconcileOperationalHeaderDependencyParentOptionIds(input: {
  selectedParentOptionIds: Record<number, number>;
  matrix: OperationalHeaderDependencyMatrixField[];
}) {
  const next = { ...input.selectedParentOptionIds };
  let changed = false;

  for (const parentField of input.matrix) {
    const currentOptionId = getOperationalHeaderDependencyParentOptionId({
      selectedParentOptionIds: next,
      parentField,
    });

    if (next[parentField.parentField.id] !== currentOptionId) {
      next[parentField.parentField.id] = currentOptionId;
      changed = true;
    }
  }

  for (const parentFieldId of Object.keys(next)) {
    if (!input.matrix.some((parentField) => parentField.parentField.id === Number(parentFieldId))) {
      delete next[Number(parentFieldId)];
      changed = true;
    }
  }

  return changed ? next : input.selectedParentOptionIds;
}

export function getOperationalHeaderDependencyParentOptionSelection(input: {
  selectedParentOptionIds: Record<number, number>;
  parentFieldId: number;
  parentOptionId: number;
}) {
  return {
    ...input.selectedParentOptionIds,
    [input.parentFieldId]: input.parentOptionId,
  };
}

export function getOperationalHeaderRequiredDependencyWarning(input: {
  field: OperationalHeaderFieldDto;
  matrix: OperationalHeaderDependencyMatrixField[];
}): OperationalHeaderRequiredDependencyWarningInput | null {
  if (!input.field.required || !input.field.active || input.field.input_type !== "select") {
    return null;
  }

  const parentGroup = input.matrix.find((group) =>
    group.parentOptions.some((parentOption) => parentOption.allowedCount === 0)
  );

  if (!parentGroup) {
    return null;
  }

  return {
    childFieldLabel: input.field.label,
    parentFieldLabel: parentGroup.parentField.label,
    parentOptionLabels: parentGroup.parentOptions
      .filter((parentOption) => parentOption.allowedCount === 0)
      .map((parentOption) => parentOption.parentOption.label),
  };
}

function getFieldFlagSummary(field: OperationalHeaderFieldDto) {
  return [
    field.required ? "Req" : null,
    field.active ? "Activo" : "Inactivo",
    field.groupable ? "Agrupable" : null,
    field.filterable ? "Filtro" : null,
    field.visible_in_gantt ? "Gantt" : null,
    field.exportable ? "Export" : null,
  ].filter(Boolean).join(" · ");
}

function getFieldDependencySummary(input: {
  field: OperationalHeaderFieldDto;
  dependencies: OperationalHeaderOptionDependencyDto[];
  fieldsById: Map<number, OperationalHeaderFieldDto>;
}) {
  const parentLabels = Array.from(new Set(input.dependencies
    .filter((dependency) => dependency.field_id === input.field.id)
    .map((dependency) => input.fieldsById.get(dependency.depends_on_field_id)?.label)
    .filter(Boolean)));

  return parentLabels.length ? `Depende de ${parentLabels.join(", ")}` : "Sin dependencia";
}

function OperationalHeaderFieldList({
  fields,
  selectedFieldId,
  dependencies,
  fieldsById,
  onSelect,
  onCreate,
}: {
  fields: OperationalHeaderFieldDto[];
  selectedFieldId: number | null;
  dependencies: OperationalHeaderOptionDependencyDto[];
  fieldsById: Map<number, OperationalHeaderFieldDto>;
  onSelect: (field: OperationalHeaderFieldDto) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="operational-header-master-panel" aria-label="Campos de cabecera operacional">
      <div className="operational-header-master-header">
        <div>
          <p className="eyebrow">Campos</p>
          <p className="body-copy">{fields.length} campos ordenados por uso operacional</p>
        </div>
        <button type="button" className="button small primary" onClick={onCreate}>
          Nuevo campo
        </button>
      </div>

      {fields.length ? (
        <div className="operational-header-master-list">
          {fields.map((field) => (
            <button
              key={field.id}
              type="button"
              className={[
                "operational-header-master-item",
                selectedFieldId === field.id ? "active" : "",
              ].filter(Boolean).join(" ")}
              aria-pressed={selectedFieldId === field.id}
              onClick={() => onSelect(field)}
            >
              <span className="operational-header-master-item-title">
                <strong>{field.label}</strong>
                <code>{field.input_type}</code>
              </span>
              <span>{field.options.length} opciones</span>
              <span>{getFieldFlagSummary(field)}</span>
              <span>{getFieldDependencySummary({ field, dependencies, fieldsById })}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="catalog-future-card">
          <p className="eyebrow">Sin campos configurados</p>
          <p className="body-copy">
            Crea el primer campo para identificar, filtrar y agrupar eventos desde Cabecera Operacional.
          </p>
          <button type="button" className="button small primary" onClick={onCreate}>
            Crear primer campo
          </button>
        </div>
      )}
    </aside>
  );
}

function OperationalHeaderFieldDetail({
  field,
  formOpen,
  children,
}: {
  field: OperationalHeaderFieldDto | null;
  formOpen: boolean;
  children: ReactNode;
}) {
  return (
    <section className="operational-header-detail-panel">
      {field ? (
        <div className="operational-header-detail-header">
          <div>
            <p className="eyebrow">Campo seleccionado</p>
            <h3 className="card-title">{field.label}</h3>
            <p className="body-copy">
              Configura este campo, sus opciones y sus dependencias en un solo lugar.
            </p>
            <div className="operational-header-detail-meta">
              <code>{field.slug}</code>
              <span>{field.input_type}</span>
              <span>Orden {field.sort_order}</span>
            </div>
          </div>
        </div>
      ) : formOpen ? (
        <div className="operational-header-detail-header">
          <div>
            <p className="eyebrow">Nuevo campo</p>
            <h3 className="card-title">Campo de cabecera</h3>
          </div>
        </div>
      ) : (
        <div className="catalog-future-card">
            <p className="eyebrow">Sin selección</p>
            <p className="body-copy">Selecciona un campo de la lista para configurar su comportamiento operacional.</p>
        </div>
      )}

      {children}
    </section>
  );
}

function FlagCheckbox({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <label className="operational-header-checkbox" title={help}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        {help ? <small>{help}</small> : null}
      </span>
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
  const fields = useMemo(() => config?.fields ?? [], [config?.fields]);
  const dependencies = useMemo(() => config?.dependencies ?? [], [config?.dependencies]);
  const { fieldsById, optionsById } = buildFieldLookup(fields);
  const sortedFields = useMemo(() => sortOperationalHeaderFields(fields), [fields]);
  const activeSelectFields = useMemo(() =>
    fields.filter((field) => field.active && field.input_type === "select"),
  [fields]);
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(() =>
    getInitialOperationalHeaderFieldId(fields)
  );
  const [form, setForm] = useState<FieldFormState>(() => {
    const initialField = sortOperationalHeaderFields(fields)[0];
    return initialField ? formFromField(initialField) : emptyForm;
  });
  const [formOpen, setFormOpen] = useState(() => fields.length > 0);
  const [optionForm, setOptionForm] = useState<OptionFormState>(emptyOptionForm);
  const [optionFormOpen, setOptionFormOpen] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [dependencyParentFieldId, setDependencyParentFieldId] = useState(0);
  const [selectedDependencyParentOptionIds, setSelectedDependencyParentOptionIds] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const previousSelectedFieldIdRef = useRef<number | null>(null);
  const isEditing = form.id !== null;
  const isEditingOption = optionForm.id !== null;
  const editingField = isEditing ? fields.find((field) => field.id === form.id) ?? null : null;
  const selectedField = selectedFieldId === null
    ? null
    : sortedFields.find((field) => field.id === selectedFieldId) ?? null;
  const selectedFieldOptions = selectedField ? sortOperationalHeaderOptions(selectedField.options) : [];
  const selectedFieldActiveOptionCount = selectedFieldOptions.filter((option) => option.active).length;
  const selectedFieldDependencies = useMemo(() =>
    selectedField
      ? getOperationalHeaderDependenciesForField({ fieldId: selectedField.id, dependencies })
      : [],
  [dependencies, selectedField]);
  const selectedFieldParentFieldIds = getOperationalHeaderDependencyParentFieldIds(selectedFieldDependencies);
  const selectedFieldParentLabels = selectedFieldParentFieldIds
    .map((fieldId) => fieldsById.get(fieldId)?.label)
    .filter(Boolean);
  const selectedFieldDependencyMatrix = useMemo(() =>
    selectedField
      ? buildOperationalHeaderDependencyMatrix({
        field: selectedField,
        fields,
        dependencies: selectedFieldDependencies,
        fallbackParentFieldId: dependencyParentFieldId,
      })
      : [],
  [dependencyParentFieldId, fields, selectedField, selectedFieldDependencies]);
  const requiredDependencyWarning = selectedField
    ? getOperationalHeaderRequiredDependencyWarning({
      field: selectedField,
      matrix: selectedFieldDependencyMatrix,
    })
    : null;
  const behaviorWarnings = getOperationalHeaderBehaviorWarnings({
    form,
    activeOptionCount: selectedFieldActiveOptionCount,
    requiredDependencyWarning,
  });
  const isTextToSelectConversion = editingField?.input_type === "text" && form.input_type === "select";

  useEffect(() => {
    setSelectedFieldId((current) => {
      if (current !== null && sortedFields.some((field) => field.id === current)) {
        return current;
      }

      return getInitialOperationalHeaderFieldId(sortedFields);
    });
  }, [sortedFields]);

  useEffect(() => {
    if (selectedField) {
      const selectedFieldChanged = previousSelectedFieldIdRef.current !== selectedField.id;
      previousSelectedFieldIdRef.current = selectedField.id;
      setForm(formFromField(selectedField));
      setFormOpen(true);
      setOptionForm(emptyOptionForm);
      setOptionFormOpen(false);
      if (selectedFieldChanged) {
        setSelectedOptionIds([]);
        const parentField = activeSelectFields.find((field) => field.id !== selectedField.id);
        setDependencyParentFieldId(parentField?.id ?? 0);
        setSelectedDependencyParentOptionIds({});
      }
    } else if (!formOpen) {
      previousSelectedFieldIdRef.current = null;
      setForm(emptyForm);
    }
  }, [activeSelectFields, formOpen, selectedField]);

  useEffect(() => {
    if (!selectedField || !dependencyParentFieldId) {
      return;
    }

    const parentFieldStillAvailable = activeSelectFields.some((field) =>
      field.id === dependencyParentFieldId && field.id !== selectedField.id
    );

    if (!parentFieldStillAvailable) {
      const parentField = activeSelectFields.find((field) => field.id !== selectedField.id);
      setDependencyParentFieldId(parentField?.id ?? 0);
      setSelectedDependencyParentOptionIds({});
    }
  }, [activeSelectFields, dependencyParentFieldId, selectedField]);

  useEffect(() => {
    setSelectedDependencyParentOptionIds((current) => {
      return reconcileOperationalHeaderDependencyParentOptionIds({
        selectedParentOptionIds: current,
        matrix: selectedFieldDependencyMatrix,
      });
    });
  }, [selectedFieldDependencyMatrix]);

  function resetForm() {
    setForm(emptyForm);
    setFormOpen(false);
    setFormError("");
  }

  function cancelFieldForm() {
    if (selectedField) {
      setForm(formFromField(selectedField));
      setFormOpen(true);
      setFormError("");
      return;
    }

    resetForm();
  }

  function resetOptionForm() {
    setOptionForm(emptyOptionForm);
    setOptionFormOpen(false);
    setFormError("");
  }

  function startCreate() {
    setForm(emptyForm);
    setSelectedFieldId(null);
    setFormOpen(true);
    setFormError("");
  }

  function selectField(field: OperationalHeaderFieldDto) {
    setSelectedFieldId(field.id);
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
    setSelectedOptionIds([]);
    setFormError("");
  }

  function startEditOption(option: OperationalHeaderFieldOptionDto) {
    setOptionForm(optionFormFromOption(option));
    setOptionFormOpen(true);
    setSelectedOptionIds([]);
    setFormError("");
  }

  function toggleOptionSelection(optionId: number, checked: boolean) {
    setSelectedOptionIds((current) => getOperationalHeaderOptionSelection({
      selectedIds: current,
      optionId,
      checked,
    }));
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
        grouping_order: number | null;
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
        grouping_order: parseOptionalOperationalHeaderOrder(form.grouping_order),
        groupable: form.groupable,
        filterable: form.filterable,
        visible_in_gantt: form.visible_in_gantt,
        exportable: form.exportable,
      };

      let savedField: OperationalHeaderFieldDto;
      if (isEditing && form.id) {
        savedField = await updateOperationalHeaderField({ id: form.id, ...payload }, accessToken);
      } else {
        savedField = await createOperationalHeaderField(payload, accessToken);
      }

      setSelectedFieldId(savedField.id);
      setForm(formFromField(savedField));
      setFormOpen(true);
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
      const nextFieldId = getNextOperationalHeaderFieldIdAfterDelete(sortedFields, field.id);
      await deleteOperationalHeaderField(field.id, accessToken);
      setSelectedFieldId(nextFieldId);
      const nextField = sortedFields.find((candidate) => candidate.id === nextFieldId) ?? null;
      if (nextField) {
        setForm(formFromField(nextField));
        setFormOpen(true);
      } else {
        resetForm();
      }
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

  async function toggleMatrixDependency(input: {
    parentFieldId: number;
    parentOptionId: number;
    childOptionId: number;
    dependency: OperationalHeaderOptionDependencyDto | null;
    checked: boolean;
  }) {
    if (!selectedField) {
      return;
    }

    if (!input.checked && input.dependency) {
      await deleteDependency(input.dependency);
      return;
    }

    if (!input.checked || input.dependency) {
      return;
    }

    setBusy(true);
    setFormError("");

    try {
      await createOperationalHeaderDependency({
        field_id: selectedField.id,
        option_id: input.childOptionId,
        depends_on_field_id: input.parentFieldId,
        depends_on_option_id: input.parentOptionId,
      }, accessToken);
      onRefresh();
    } catch (mutationError: unknown) {
      setFormError(mutationError instanceof Error ? mutationError.message : "No se pudo guardar la dependencia.");
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
            Configuración operacional
          </h2>
          <p className="body-copy">
            Administra cada campo con sus opciones y reglas de dependencia desde el mismo contexto.
          </p>
        </div>
      </div>

      {loading ? <p className="body-copy">Cargando cabecera operacional...</p> : null}
      {error ? <p className="feedback" role="alert">{error}</p> : null}
      {formError ? <p className="feedback" role="alert">{formError}</p> : null}
      {busy ? <p className="body-copy operational-header-admin-status" role="status">Guardando cambios...</p> : null}

      <div className="operational-header-master-detail">
        <OperationalHeaderFieldList
          fields={sortedFields}
          selectedFieldId={selectedFieldId}
          dependencies={dependencies}
          fieldsById={fieldsById}
          onSelect={selectField}
          onCreate={startCreate}
        />

        <OperationalHeaderFieldDetail field={selectedField} formOpen={formOpen}>
          {formOpen ? (
            <form className="operational-header-field-form" onSubmit={submitForm}>
              <section className="operational-header-config-section">
                <div className="operational-header-options-header">
                  <div>
                    <p className="eyebrow">Configuración</p>
                    <p className="body-copy">Define cómo se identifica y se usa este campo en la operación.</p>
                  </div>
                  {selectedField ? (
                    <button
                      type="button"
                      className="button icon-button small danger"
                      disabled={busy}
                      title="Eliminar campo"
                      onClick={() => void deleteField(selectedField)}
                    >
                      Eliminar campo
                    </button>
                  ) : null}
                </div>
                <div className="operational-header-behavior-groups">
                  <section className="operational-header-behavior-group">
                    <p className="eyebrow">Identidad</p>
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
                        Orden visual
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
                    <div className="operational-header-form-flags" aria-label="Identidad del campo">
                      <FlagCheckbox
                        label="Activo"
                        help="Participa en captura, Gantt y reportes."
                        checked={form.active}
                        onChange={(active) => setForm((current) => ({ ...current, active }))}
                      />
                    </div>
                  </section>

                  <section className="operational-header-behavior-group">
                    <p className="eyebrow">Captura</p>
                    <div className="operational-header-form-flags" aria-label="Captura del campo">
                      <FlagCheckbox
                        label="Requerido"
                        help="Obligatorio durante la captura mientras esté activo."
                        checked={form.required}
                        onChange={(required) => setForm((current) => ({ ...current, required }))}
                      />
                    </div>
                  </section>

                  <section className="operational-header-behavior-group">
                    <p className="eyebrow">Gantt</p>
                    <div className="operational-header-form-flags" aria-label="Comportamiento Gantt">
                      <FlagCheckbox
                        label="Visible en Gantt"
                        help="Permite usarlo como nivel visual si también es agrupable."
                        checked={form.visible_in_gantt}
                        onChange={(visible_in_gantt) => setForm((current) => ({ ...current, visible_in_gantt }))}
                      />
                      <FlagCheckbox
                        label="Agrupable"
                        help="Agrupa en Gantt y breakdowns según el contexto."
                        checked={form.groupable}
                        onChange={(groupable) => setForm((current) => ({ ...current, groupable }))}
                      />
                    </div>
                    <label className="field">
                      Orden de agrupación
                      <input
                        className="field-input"
                        type="number"
                        value={form.grouping_order}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          grouping_order: event.target.value,
                        }))}
                        disabled={busy || !form.groupable}
                      />
                      <span className="field-hint">
                        {!form.visible_in_gantt
                          ? "No tendrá efecto mientras el campo no sea visible en Gantt."
                          : form.groupable
                          ? "Si queda vacío, se utilizará el orden visual."
                          : "Activa Agrupable para definir un orden de agrupación."}
                      </span>
                    </label>
                  </section>

                  <section className="operational-header-behavior-group">
                    <p className="eyebrow">Reportes</p>
                    <div className="operational-header-form-flags" aria-label="Reportabilidad del campo">
                      <FlagCheckbox
                        label="Filtrable"
                        help="Disponible como filtro en reportes."
                        checked={form.filterable}
                        onChange={(filterable) => setForm((current) => ({ ...current, filterable }))}
                      />
                      <FlagCheckbox
                        label="Exportable"
                        help="Visible en tabla, CSV y Excel."
                        checked={form.exportable}
                        onChange={(exportable) => setForm((current) => ({ ...current, exportable }))}
                      />
                    </div>
                  </section>
                </div>

                {behaviorWarnings.map((warning) => (
                  <p className="feedback" key={warning}>{warning}</p>
                ))}
              </section>

              <div className="catalog-inline-actions operational-header-save-row">
                <button type="submit" className="button small primary" disabled={busy || !form.label.trim() || !form.slug.trim()}>
                  {isEditing ? "Guardar" : "Crear campo"}
                </button>
                <button type="button" className="button small" onClick={cancelFieldForm} disabled={busy}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          {selectedField ? (
            <section className="operational-header-options">
              <div className="operational-header-options-header">
                <div>
                  <p className="eyebrow">Opciones</p>
                  <p className="body-copy">
                    {selectedField.input_type === "select"
                      ? `${selectedFieldOptions.length} opciones · ${selectedFieldActiveOptionCount} activas`
                      : "Los campos de texto reciben valores escritos directamente en el formulario operacional."}
                  </p>
                </div>
                {selectedField.input_type === "select" ? (
                  <div className="catalog-inline-actions">
                    <button
                      type="button"
                      className="button small primary"
                      disabled={busy}
                      onClick={() => startCreateOption(selectedField)}
                    >
                      Nueva opción
                    </button>
                    <span className="catalog-count">{selectedOptionIds.length} seleccionadas</span>
                    <button
                      type="button"
                      className="button small"
                      aria-label={`Seleccionar todas las opciones de ${selectedField.label}`}
                      disabled={busy || !selectedFieldOptions.length}
                      onClick={() => setSelectedOptionIds(getAllOperationalHeaderOptionIds(selectedFieldOptions))}
                    >
                      Seleccionar todas
                    </button>
                    <button
                      type="button"
                      className="button small"
                      aria-label={`Limpiar selección de opciones de ${selectedField.label}`}
                      disabled={busy || !selectedOptionIds.length}
                      onClick={() => setSelectedOptionIds([])}
                    >
                      Limpiar selección
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedField.input_type === "text" ? (
                <div className="catalog-future-card">
                  <p className="eyebrow">Campo de texto</p>
                  <p className="body-copy">No hay opciones que administrar. Si necesitas una lista cerrada, cambia el tipo del campo a select.</p>
                </div>
              ) : null}

              {selectedField.input_type === "select" && optionFormOpen && optionForm.field_id === selectedField.id ? (
                <form className="operational-header-option-form" onSubmit={submitOptionForm}>
                  <div className="operational-header-options-header">
                    <div>
                      <p className="eyebrow">{isEditingOption ? "Editar opción" : "Nueva opción"}</p>
                      <p className="body-copy">Se guardará dentro de {selectedField.label}.</p>
                    </div>
                  </div>
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

              {selectedField.input_type === "select" && !selectedFieldOptions.length && !optionFormOpen ? (
                <div className="catalog-future-card">
                  <p className="eyebrow">Sin opciones</p>
                  <p className="body-copy">Crea opciones para que este campo pueda seleccionarse y participar en dependencias.</p>
                  <button
                    type="button"
                    className="button small primary"
                    disabled={busy}
                    onClick={() => startCreateOption(selectedField)}
                  >
                    Crear primera opción
                  </button>
                </div>
              ) : null}

              {selectedField.input_type === "select" && selectedFieldOptions.length ? (
                <div className="operational-header-option-grid">
                  {selectedFieldOptions.map((option) => (
                    <div
                      key={option.id}
                      className={[
                        "operational-header-option-row",
                        option.active ? "" : "inactive",
                      ].filter(Boolean).join(" ")}
                    >
                      <label className="operational-header-option-select">
                        <input
                          type="checkbox"
                          checked={selectedOptionIds.includes(option.id)}
                          aria-label={`Seleccionar opción ${option.label}`}
                          onChange={(event) => toggleOptionSelection(option.id, event.target.checked)}
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <code>{option.value}</code>
                        </span>
                      </label>
                      <span>{option.active ? "Activa" : "Inactiva"}</span>
                      <span>Orden {option.sort_order}</span>
                      <div className="catalog-inline-actions">
                        <button type="button" className="button icon-button small" onClick={() => startEditOption(option)}>
                          Editar opción
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
                          Eliminar opción
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
              ) : null}
            </section>
          ) : null}

          {selectedField ? (
            <section className="operational-header-dependencies">
              <div className="operational-header-options-header">
                <div>
                  <p className="eyebrow">Dependencias</p>
                  <p className="body-copy">
                    {selectedField.input_type === "select"
                      ? selectedFieldParentLabels.length
                        ? `Depende de ${selectedFieldParentLabels.join(", ")}. Revisa cada opción padre y marca sus opciones permitidas.`
                        : "Este campo no depende de otro campo. Elige un campo padre para comenzar."
                      : "Los campos de texto no utilizan dependencias por opción."}
                  </p>
                </div>
                {selectedField.input_type === "select" ? (
                  <span className="catalog-count">{selectedFieldDependencies.length} relaciones</span>
                ) : null}
              </div>

              {selectedField.input_type === "text" ? (
                <div className="catalog-future-card">
                  <p className="eyebrow">Campo de texto</p>
                  <p className="body-copy">No hay matriz de dependencias porque este campo acepta texto libre.</p>
                </div>
              ) : null}

              {selectedField.input_type === "select" && !selectedFieldOptions.length ? (
                <div className="catalog-future-card">
                  <p className="eyebrow">Sin opciones hijas</p>
                  <p className="body-copy">Crea opciones para este campo antes de permitirlas según una opción padre.</p>
                </div>
              ) : null}

              {selectedField.input_type === "select" && selectedFieldOptions.length ? (
                <div className="operational-header-option-form">
                  <div className="operational-header-options-header">
                    <div>
                      <p className="eyebrow">Campo padre</p>
                      <p className="body-copy">
                        Las opciones de {selectedField.label} se habilitan según la opción padre seleccionada.
                      </p>
                    </div>
                  </div>

                  <label className="field">
                    Campo padre
                    <select
                      className="field-input"
                      value={dependencyParentFieldId}
                      onChange={(event) => {
                        setDependencyParentFieldId(Number(event.target.value));
                        setSelectedDependencyParentOptionIds({});
                      }}
                      disabled={busy || activeSelectFields.length < 2}
                    >
                      <option value={0}>Seleccionar campo padre</option>
                      {activeSelectFields
                        .filter((field) => field.id !== selectedField.id)
                        .map((field) => (
                          <option key={field.id} value={field.id}>{field.label}</option>
                        ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {selectedFieldDependencyMatrix.length ? (
                <div className="operational-header-dependency-matrix">
                  {selectedFieldDependencyMatrix.map((parentGroup) => (
                    <section key={parentGroup.parentField.id} className="operational-header-dependency-parent">
                      <div className="operational-header-dependency-parent-header">
                        <div>
                          <p className="eyebrow">Campo padre</p>
                          <h4>{parentGroup.parentField.label}</h4>
                        </div>
                      </div>

                      {parentGroup.parentOptions.length ? (
                        <div className="operational-header-dependency-master-detail">
                          <div className="operational-header-dependency-parent-list" aria-label={`Opciones padre de ${parentGroup.parentField.label}`}>
                            {parentGroup.parentOptions.map((parentOptionGroup) => {
                              const selectedParentOptionId = getOperationalHeaderDependencyParentOptionId({
                                selectedParentOptionIds: selectedDependencyParentOptionIds,
                                parentField: parentGroup,
                              });
                              const selected = selectedParentOptionId === parentOptionGroup.parentOption.id;

                              return (
                                <button
                                  key={parentOptionGroup.parentOption.id}
                                  type="button"
                                  className={[
                                    "operational-header-dependency-parent-list-item",
                                    selected ? "active" : "",
                                  ].filter(Boolean).join(" ")}
                                  onClick={() =>
                                    setSelectedDependencyParentOptionIds((current) =>
                                      getOperationalHeaderDependencyParentOptionSelection({
                                        selectedParentOptionIds: current,
                                        parentFieldId: parentGroup.parentField.id,
                                        parentOptionId: parentOptionGroup.parentOption.id,
                                      })
                                    )
                                  }
                                  aria-pressed={selected}
                                >
                                  <span>
                                    <strong>{parentOptionGroup.parentOption.label}</strong>
                                    <code>{parentOptionGroup.parentOption.value}</code>
                                  </span>
                                  <span className="catalog-count">
                                    {parentOptionGroup.allowedCount} permitidas
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {(() => {
                            const selectedParentOptionId = getOperationalHeaderDependencyParentOptionId({
                              selectedParentOptionIds: selectedDependencyParentOptionIds,
                              parentField: parentGroup,
                            });
                            const parentOptionGroup = parentGroup.parentOptions.find((group) =>
                              group.parentOption.id === selectedParentOptionId
                            ) ?? parentGroup.parentOptions[0];

                            return parentOptionGroup ? (
                              <div className="operational-header-dependency-detail">
                                <div className="operational-header-dependency-parent-option-header">
                                  <div>
                                    <strong>{parentOptionGroup.parentOption.label}</strong>
                                    <code>{parentOptionGroup.parentOption.value}</code>
                                  </div>
                                  <span className="catalog-count">
                                    {parentOptionGroup.allowedCount} permitidas
                                  </span>
                                </div>

                                <p className="body-copy">
                                  Marca las opciones de {selectedField.label} disponibles cuando se seleccione {parentOptionGroup.parentOption.label}.
                                </p>

                                <div className="operational-header-dependency-child-grid">
                                  {parentOptionGroup.children.map((child) => (
                                    <label
                                      key={child.option.id}
                                      className={[
                                        "operational-header-dependency-child",
                                        child.option.active ? "" : "inactive",
                                      ].filter(Boolean).join(" ")}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={child.dependency !== null}
                                        disabled={busy}
                                        aria-label={`${child.dependency ? "Quitar" : "Permitir"} ${child.option.label} cuando ${parentOptionGroup.parentOption.label} esté seleccionado`}
                                        onChange={(event) => void toggleMatrixDependency({
                                          parentFieldId: parentGroup.parentField.id,
                                          parentOptionId: parentOptionGroup.parentOption.id,
                                          childOptionId: child.option.id,
                                          dependency: child.dependency,
                                          checked: event.target.checked,
                                        })}
                                      />
                                      <span>
                                        <strong>{child.option.label}</strong>
                                        <code>{child.option.value}</code>
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <div className="catalog-future-card">
                          <p className="eyebrow">Sin opciones padre activas</p>
                          <p className="body-copy">Activa opciones en {parentGroup.parentField.label} para editar esta matriz.</p>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              ) : selectedField.input_type === "select" ? (
                <div className="catalog-future-card">
                  <p className="eyebrow">Sin dependencias</p>
                  <p className="body-copy">Selecciona un campo padre para definir qué opciones de {selectedField.label} estarán permitidas.</p>
                </div>
              ) : null}
            </section>
          ) : null}
        </OperationalHeaderFieldDetail>
      </div>
    </section>
  );
}
