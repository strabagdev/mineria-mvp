import "server-only";

import type {
  OperationalHeaderFieldDto,
  OperationalHeaderInputType,
  OperationalHeaderJson,
  OperationalHeaderResponseDto,
} from "@/modules/operational-header/contracts/operational-header";
import {
  resolveOperationalHeaderDynamicFormFields,
  resolveSelectedOperationalHeaderOptionId,
  shouldValidateOperationalHeaderRequiredField,
} from "../../modules/operational-header/application/operational-header-form-dependencies";
import {
  countOperationalHeaderOptionsByFieldId,
  countOperationalHeaderValuesByOptionId,
  countOperationalHeaderValuesByFieldId,
  createOperationalHeaderOptionDependency,
  createOperationalHeaderFieldOption,
  createOperationalHeaderField,
  deleteOperationalHeaderOptionDependency,
  deleteOperationalHeaderFieldOption,
  deleteOperationalHeaderField,
  findOperationalHeaderOptionDependencyRow,
  findOperationalHeaderFieldOptionRow,
  findOperationalHeaderFieldRow,
  listOperationalHeaderFieldOptionRows,
  listOperationalHeaderFieldRows,
  listOperationalHeaderOptionDependencyRows,
  listOperationalHeaderValueRowsByActivityGroupIds,
  listOperationalHeaderValueRowsByExecutionSegmentIds,
  listOperationalHeaderValueRowsByPlanningItemIds,
  type OperationalHeaderFieldOptionRow,
  type OperationalHeaderFieldRow,
  type OperationalHeaderValueRow,
  updateOperationalHeaderFieldOption,
  updateOperationalHeaderField,
  upsertOperationalHeaderValueForExecutionSegment,
  upsertOperationalHeaderValueForPlanningItem,
} from "@/server/repositories/operational-header.repository";

type OperationalHeaderFieldEditableInput = {
  slug: string;
  label: string;
  inputType: OperationalHeaderInputType;
  required: boolean;
  active: boolean;
  sortOrder: number;
  groupingOrder: number | null;
  groupable: boolean;
  filterable: boolean;
  visibleInGantt: boolean;
  exportable: boolean;
};

type OperationalHeaderFieldUpdateInput = Partial<OperationalHeaderFieldEditableInput>;

type OperationalHeaderOptionEditableInput = {
  fieldId: number;
  value: string;
  label: string;
  active: boolean;
  sortOrder: number;
  metadata: OperationalHeaderJson;
};

type OperationalHeaderOptionUpdateInput = Partial<OperationalHeaderOptionEditableInput>;

type OperationalHeaderDependencyEditableInput = {
  fieldId: number;
  optionId: number;
  dependsOnFieldId: number;
  dependsOnOptionId: number;
};

export type OperationalHeaderDynamicValueInput = {
  field_id: number;
  value: string;
  option_id?: number | null;
};

export type PreparedOperationalHeaderMutationValues = {
  values: OperationalHeaderDynamicValueInput[];
};

function withStatus(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export function slugifyOperationalHeaderField(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function slugifyOperationalHeaderOptionValue(value: string) {
  return slugifyOperationalHeaderField(value);
}

function mapFieldRowToDto(field: OperationalHeaderFieldRow): OperationalHeaderFieldDto {
  return {
    ...field,
    options: [],
  };
}

async function assertSlugAvailable(slug: string, currentFieldId?: number) {
  const existing = await findOperationalHeaderFieldRow({ slug });

  if (existing && existing.id !== currentFieldId) {
    throw withStatus("Ya existe un campo de cabecera operacional con ese slug.", 409);
  }
}

async function assertOptionValueAvailable(fieldId: number, value: string, currentOptionId?: number) {
  const existing = await findOperationalHeaderFieldOptionRow({ fieldId, value });

  if (existing && existing.id !== currentOptionId) {
    throw withStatus("Ya existe una opcion de cabecera operacional con ese valor para este campo.", 409);
  }
}

function assertMetadataObject(metadata: OperationalHeaderJson) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw withStatus("La metadata de la opcion debe ser un objeto JSON.", 400);
  }
}

async function getSelectField(fieldId: number) {
  const field = await findOperationalHeaderFieldRow({ fieldId });

  if (!field) {
    throw withStatus("El campo de cabecera operacional no existe.", 404);
  }

  if (field.input_type !== "select") {
    throw withStatus("Solo los campos select pueden tener opciones.", 400);
  }

  return field;
}

async function getActiveSelectField(fieldId: number) {
  const field = await getSelectField(fieldId);

  if (!field.active) {
    throw withStatus("No se pueden crear dependencias con campos inactivos.", 400);
  }

  return field;
}

async function getActiveOptionForField(input: { fieldId: number; optionId: number }) {
  const [field, option] = await Promise.all([
    getActiveSelectField(input.fieldId),
    findOperationalHeaderFieldOptionRow({ optionId: input.optionId }),
  ]);

  if (!option) {
    throw withStatus("La opcion de cabecera operacional no existe.", 404);
  }

  if (option.field_id !== field.id) {
    throw withStatus("La opcion indicada no pertenece al campo seleccionado.", 400);
  }

  if (!option.active) {
    throw withStatus("No se pueden crear dependencias con opciones inactivas.", 400);
  }

  return { field, option };
}

export async function listOperationalHeaderFields(input: { activeOnly?: boolean } = {}) {
  const [fields, options] = await Promise.all([
    listOperationalHeaderFieldRows({ activeOnly: input.activeOnly }),
    listOperationalHeaderFieldOptionRows({ activeOnly: input.activeOnly }),
  ]);
  const optionsByFieldId = new Map<number, typeof options>();

  for (const option of options) {
    optionsByFieldId.set(option.field_id, [
      ...(optionsByFieldId.get(option.field_id) ?? []),
      option,
    ]);
  }

  return fields.map((field): OperationalHeaderFieldDto => ({
    ...field,
    options: optionsByFieldId.get(field.id) ?? [],
  }));
}

export async function getOperationalHeaderConfig(input: {
  activeOnly?: boolean;
} = {}): Promise<OperationalHeaderResponseDto> {
  const [fields, dependencies] = await Promise.all([
    listOperationalHeaderFields({ activeOnly: input.activeOnly }),
    listOperationalHeaderOptionDependencyRows(),
  ]);
  const fieldIds = new Set(fields.map((field) => field.id));
  const optionIds = new Set(fields.flatMap((field) => field.options.map((option) => option.id)));

  return {
    fields,
    dependencies: dependencies.filter((dependency) =>
      fieldIds.has(dependency.field_id)
      && fieldIds.has(dependency.depends_on_field_id)
      && optionIds.has(dependency.option_id)
      && optionIds.has(dependency.depends_on_option_id)
    ),
  };
}

export async function createOperationalHeaderFieldDefinition(
  input: OperationalHeaderFieldEditableInput
) {
  const slug = slugifyOperationalHeaderField(input.slug);
  const label = input.label.trim();

  if (!slug || !label) {
    throw withStatus("Debes indicar slug y nombre validos para el campo.", 400);
  }

  await assertSlugAvailable(slug);

  const field = await createOperationalHeaderField({
    slug,
    label,
    input_type: input.inputType,
    required: input.required,
    active: input.active,
    sort_order: input.sortOrder,
    grouping_order: input.groupingOrder,
    groupable: input.groupable,
    filterable: input.filterable,
    visible_in_gantt: input.visibleInGantt,
    exportable: input.exportable,
  });

  return mapFieldRowToDto(field);
}

export async function updateOperationalHeaderFieldDefinition(input: {
  id: number;
  updates: OperationalHeaderFieldUpdateInput;
}) {
  const before = await findOperationalHeaderFieldRow({ fieldId: input.id });

  if (!before) {
    throw withStatus("El campo de cabecera operacional no existe.", 404);
  }

  const updates: Parameters<typeof updateOperationalHeaderField>[1] = {};

  if (input.updates.label !== undefined) {
    const label = input.updates.label.trim();

    if (!label) {
      throw withStatus("El nombre del campo no puede quedar vacio.", 400);
    }

    updates.label = label;
  }

  if (input.updates.slug !== undefined) {
    const slug = slugifyOperationalHeaderField(input.updates.slug);

    if (!slug) {
      throw withStatus("El slug del campo no es valido.", 400);
    }

    await assertSlugAvailable(slug, before.id);
    updates.slug = slug;
  }

  if (input.updates.inputType !== undefined) {
    if (before.input_type !== input.updates.inputType) {
      const usageCount = await countOperationalHeaderValuesByFieldId(before.id);
      const isTextToSelectConversion = before.input_type === "text" && input.updates.inputType === "select";

      if (usageCount > 0 && !isTextToSelectConversion) {
        throw withStatus("No se puede cambiar el tipo porque el campo ya tiene valores.", 409);
      }

      updates.input_type = input.updates.inputType;
    }
  }

  if (input.updates.required !== undefined) updates.required = input.updates.required;
  if (input.updates.active !== undefined) updates.active = input.updates.active;
  if (input.updates.sortOrder !== undefined) updates.sort_order = input.updates.sortOrder;
  if (input.updates.groupingOrder !== undefined) updates.grouping_order = input.updates.groupingOrder;
  if (input.updates.groupable !== undefined) updates.groupable = input.updates.groupable;
  if (input.updates.filterable !== undefined) updates.filterable = input.updates.filterable;
  if (input.updates.visibleInGantt !== undefined) updates.visible_in_gantt = input.updates.visibleInGantt;
  if (input.updates.exportable !== undefined) updates.exportable = input.updates.exportable;

  if (!Object.keys(updates).length) {
    return mapFieldRowToDto(before);
  }

  const field = await updateOperationalHeaderField(input.id, updates);
  return mapFieldRowToDto(field);
}

export async function deleteUnusedOperationalHeaderFieldDefinition(input: { id: number }) {
  const before = await findOperationalHeaderFieldRow({ fieldId: input.id });

  if (!before) {
    throw withStatus("El campo de cabecera operacional no existe.", 404);
  }

  const [valueCount, optionCount] = await Promise.all([
    countOperationalHeaderValuesByFieldId(before.id),
    countOperationalHeaderOptionsByFieldId(before.id),
  ]);

  if (valueCount > 0 || optionCount > 0) {
    return {
      deleted: false,
      reason: valueCount > 0 ? "values" as const : "options" as const,
      valueCount,
      optionCount,
    };
  }

  await deleteOperationalHeaderField(before.id);

  return {
    deleted: true,
    reason: null,
    valueCount,
    optionCount,
  };
}

export async function createOperationalHeaderOptionDefinition(
  input: OperationalHeaderOptionEditableInput
) {
  const field = await getSelectField(input.fieldId);
  const value = slugifyOperationalHeaderOptionValue(input.value);
  const label = input.label.trim();

  assertMetadataObject(input.metadata);

  if (!value || !label) {
    throw withStatus("Debes indicar valor y nombre validos para la opcion.", 400);
  }

  await assertOptionValueAvailable(field.id, value);

  return createOperationalHeaderFieldOption({
    field_id: field.id,
    value,
    label,
    active: input.active,
    sort_order: input.sortOrder,
    metadata: input.metadata,
  });
}

export async function updateOperationalHeaderOptionDefinition(input: {
  id: number;
  updates: OperationalHeaderOptionUpdateInput;
}) {
  const before = await findOperationalHeaderFieldOptionRow({ optionId: input.id });

  if (!before) {
    throw withStatus("La opcion de cabecera operacional no existe.", 404);
  }

  if (input.updates.fieldId !== undefined && input.updates.fieldId !== before.field_id) {
    throw withStatus("No se puede mover una opcion entre campos.", 400);
  }

  await getSelectField(before.field_id);
  const updates: Parameters<typeof updateOperationalHeaderFieldOption>[1] = {};

  if (input.updates.value !== undefined) {
    const value = slugifyOperationalHeaderOptionValue(input.updates.value);

    if (!value) {
      throw withStatus("El valor de la opcion no es valido.", 400);
    }

    await assertOptionValueAvailable(before.field_id, value, before.id);
    updates.value = value;
  }

  if (input.updates.label !== undefined) {
    const label = input.updates.label.trim();

    if (!label) {
      throw withStatus("El nombre de la opcion no puede quedar vacio.", 400);
    }

    updates.label = label;
  }

  if (input.updates.active !== undefined) updates.active = input.updates.active;
  if (input.updates.sortOrder !== undefined) updates.sort_order = input.updates.sortOrder;

  if (input.updates.metadata !== undefined) {
    assertMetadataObject(input.updates.metadata);
    updates.metadata = input.updates.metadata;
  }

  if (!Object.keys(updates).length) {
    return before;
  }

  return updateOperationalHeaderFieldOption(before.id, updates);
}

export async function deleteUnusedOperationalHeaderOptionDefinition(input: { id: number }) {
  const before = await findOperationalHeaderFieldOptionRow({ optionId: input.id });

  if (!before) {
    throw withStatus("La opcion de cabecera operacional no existe.", 404);
  }

  const usageCount = await countOperationalHeaderValuesByOptionId(before.id);

  if (usageCount > 0) {
    return {
      deleted: false,
      reason: "used" as const,
      usageCount,
    };
  }

  await deleteOperationalHeaderFieldOption(before.id);

  return {
    deleted: true,
    reason: null,
    usageCount,
  };
}

export async function createOperationalHeaderDependencyDefinition(
  input: OperationalHeaderDependencyEditableInput
) {
  if (input.fieldId === input.dependsOnFieldId) {
    throw withStatus("No se puede crear una dependencia entre opciones del mismo campo.", 400);
  }

  const [{ field, option }, { field: parentField, option: parentOption }] = await Promise.all([
    getActiveOptionForField({ fieldId: input.fieldId, optionId: input.optionId }),
    getActiveOptionForField({ fieldId: input.dependsOnFieldId, optionId: input.dependsOnOptionId }),
  ]);

  const [duplicate, reverse] = await Promise.all([
    findOperationalHeaderOptionDependencyRow({
      optionId: option.id,
      dependsOnOptionId: parentOption.id,
    }),
    findOperationalHeaderOptionDependencyRow({
      optionId: parentOption.id,
      dependsOnOptionId: option.id,
    }),
  ]);

  if (duplicate) {
    throw withStatus("Ya existe esta dependencia de cabecera operacional.", 409);
  }

  if (reverse) {
    throw withStatus("No se puede crear un ciclo entre dependencias de opciones.", 400);
  }

  return createOperationalHeaderOptionDependency({
    field_id: field.id,
    option_id: option.id,
    depends_on_field_id: parentField.id,
    depends_on_option_id: parentOption.id,
  });
}

export async function deleteOperationalHeaderDependencyDefinition(input: { id: number }) {
  const before = await findOperationalHeaderOptionDependencyRow({ dependencyId: input.id });

  if (!before) {
    throw withStatus("La dependencia de cabecera operacional no existe.", 404);
  }

  await deleteOperationalHeaderOptionDependency(before.id);

  return {
    deleted: true,
    dependency: before,
  };
}

export async function listOperationalHeaderValuesByActivityGroupIds(
  activityGroupIds: string[]
) {
  return listOperationalHeaderValueRowsByActivityGroupIds(activityGroupIds);
}

export async function listOperationalHeaderValuesByPlanningItemIds(
  planningItemIds: number[]
) {
  return listOperationalHeaderValueRowsByPlanningItemIds(planningItemIds);
}

export async function listOperationalHeaderValuesByExecutionSegmentIds(
  executionSegmentIds: number[]
) {
  return listOperationalHeaderValueRowsByExecutionSegmentIds(executionSegmentIds);
}

function buildOperationalHeaderConfigFromRows(input: {
  fields: OperationalHeaderFieldRow[];
  options: OperationalHeaderFieldOptionRow[];
  dependencies: Awaited<ReturnType<typeof listOperationalHeaderOptionDependencyRows>>;
}): OperationalHeaderResponseDto {
  return {
    fields: input.fields.map((field) => ({
      ...field,
      options: input.options.filter((option) => option.field_id === field.id),
    })),
    dependencies: input.dependencies ?? [],
  };
}

async function loadOperationalHeaderCaptureConfig() {
  const [fields, options, dependencies] = await Promise.all([
    listOperationalHeaderFieldRows({ activeOnly: true }),
    listOperationalHeaderFieldOptionRows({ activeOnly: true }),
    listOperationalHeaderOptionDependencyRows(),
  ]);

  return buildOperationalHeaderConfigFromRows({
    fields: fields ?? [],
    options: options ?? [],
    dependencies: dependencies ?? [],
  });
}

async function prepareOperationalHeaderValuesForCapture(
  values: OperationalHeaderDynamicValueInput[]
): Promise<PreparedOperationalHeaderMutationValues> {
  const config = await loadOperationalHeaderCaptureConfig();
  const fieldValues = new Map(
    values
      .filter((value) => Number.isFinite(value.field_id) && value.field_id > 0)
      .map((value) => [value.field_id, {
        field_id: value.field_id,
        value: String(value.value ?? "").trim(),
        option_id: value.option_id ?? null,
      }])
  );
  const dynamicValues = Object.fromEntries(Array.from(fieldValues).map(([fieldId, value]) => [
    fieldId,
    value.value,
  ]));
  const optionIdsByFieldId = new Map(Array.from(fieldValues).map(([fieldId, value]) => [
    fieldId,
    value.option_id,
  ]));
  const resolvedFields = resolveOperationalHeaderDynamicFormFields({
    config,
    dynamicValues,
    optionIdsByFieldId,
  });
  const preparedValues: OperationalHeaderDynamicValueInput[] = [];

  for (const { field, options, captureState } of resolvedFields) {
    const submittedValue = fieldValues.get(field.id);
    const value = submittedValue?.value.trim() ?? "";
    const selectedOptionId = field.input_type === "select"
      ? resolveSelectedOperationalHeaderOptionId(field, value, submittedValue?.option_id)
      : null;

    if (shouldValidateOperationalHeaderRequiredField({ field, captureState }) && !value && !selectedOptionId) {
      if (captureState.unavailableReason === "no_active_options") {
        throw withStatus(`El campo de cabecera operacional "${field.label}" es obligatorio, pero no tiene opciones activas disponibles.`, 400);
      }

      if (captureState.unavailableReason === "no_valid_options") {
        const parentLabel = captureState.parentFields[0]?.label ?? "el campo padre";
        throw withStatus(`No hay opciones disponibles para "${field.label}" con la seleccion actual de "${parentLabel}".`, 400);
      }

      throw withStatus(`El campo de cabecera operacional "${field.label}" es obligatorio.`, 400);
    }

    if (!value && !selectedOptionId) {
      continue;
    }

    if (field.input_type === "select") {
      const option = field.options.find((candidate) => candidate.id === selectedOptionId) ?? null;
      const optionAllowed = options.some((candidate) => candidate.id === option?.id);

      if (!option || !option.active) {
        throw withStatus(`La opcion seleccionada para "${field.label}" no es valida.`, 400);
      }

      if (!optionAllowed) {
        const parentLabel = captureState.parentFields[0]?.label ?? "el campo padre";
        throw withStatus(`La opcion seleccionada para "${field.label}" no esta permitida para la seleccion actual de "${parentLabel}".`, 400);
      }

      const resolvedValue = option.label || option.value;

      preparedValues.push({
        field_id: field.id,
        value: resolvedValue,
        option_id: option.id,
      });

      continue;
    }

    preparedValues.push({
      field_id: field.id,
      value,
      option_id: null,
    });

  }

  return {
    values: preparedValues,
  };
}

export async function prepareOperationalHeaderMutationValues(
  values: OperationalHeaderDynamicValueInput[]
): Promise<PreparedOperationalHeaderMutationValues> {
  return prepareOperationalHeaderValuesForCapture(values);
}

export async function syncDynamicOperationalHeaderForPlanningItem(input: {
  planningItemId: number;
  activityGroupId: string;
  values: OperationalHeaderDynamicValueInput[];
}) {
  const activityGroupId = input.activityGroupId.trim();

  if (!activityGroupId || !Number.isFinite(input.planningItemId) || input.planningItemId <= 0) {
    return [];
  }

  const { values } = await prepareOperationalHeaderValuesForCapture(input.values);
  const writes: Promise<OperationalHeaderValueRow>[] = [];

  for (const value of values) {
    if (value.option_id) {
      writes.push(upsertOperationalHeaderValueForPlanningItem({
        field_id: value.field_id,
        activity_group_id: activityGroupId,
        planning_item_id: input.planningItemId,
        option_id: value.option_id,
        value_text: null,
      }));
      continue;
    }

    writes.push(upsertOperationalHeaderValueForPlanningItem({
      field_id: value.field_id,
      activity_group_id: activityGroupId,
      planning_item_id: input.planningItemId,
      option_id: null,
      value_text: value.value || null,
    }));
  }

  return Promise.all(writes);
}

export async function syncDynamicOperationalHeaderForExecutionSegment(input: {
  executionSegmentId: number;
  activityGroupId: string;
  values: OperationalHeaderDynamicValueInput[];
}) {
  const activityGroupId = input.activityGroupId.trim();

  if (!activityGroupId || !Number.isFinite(input.executionSegmentId) || input.executionSegmentId <= 0) {
    return [];
  }

  const { values } = await prepareOperationalHeaderValuesForCapture(input.values);
  const writes: Promise<OperationalHeaderValueRow>[] = [];

  for (const value of values) {
    if (value.option_id) {
      writes.push(upsertOperationalHeaderValueForExecutionSegment({
        field_id: value.field_id,
        activity_group_id: activityGroupId,
        execution_segment_id: input.executionSegmentId,
        option_id: value.option_id,
        value_text: null,
      }));
      continue;
    }

    writes.push(upsertOperationalHeaderValueForExecutionSegment({
      field_id: value.field_id,
      activity_group_id: activityGroupId,
      execution_segment_id: input.executionSegmentId,
      option_id: null,
      value_text: value.value || null,
    }));
  }

  return Promise.all(writes);
}
