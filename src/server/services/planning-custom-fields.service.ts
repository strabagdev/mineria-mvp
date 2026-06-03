import "server-only";

import { writeAuditLog } from "@/lib/auditLog";
import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
  PlanningCustomFieldIconKey,
  PlanningCustomFieldInputType,
  PlanningCustomFieldJson,
  PlanningCustomFieldUsageDto,
  PlanningCustomFieldUsageRecordDto,
  PlanningCustomFieldValueInputDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  countPlanningCustomFieldValuesByFieldId,
  countPlanningCustomFieldValuesByOptionId,
  createPlanningCustomField,
  createPlanningCustomFieldOption,
  deletePlanningCustomField,
  deletePlanningCustomFieldOption,
  findPlanningCustomFieldRow,
  getPlanningCustomFieldOptionById,
  listPlannedItemUsageContextsByActivityGroupIds,
  listPlanningCustomFieldOptions,
  listPlanningCustomFieldRows,
  listPlanningCustomFieldUsageRows,
  listPlanningCustomFieldValues,
  listPlanningCustomFieldValuesByPlanningItemIds,
  replacePlanningCustomFieldValues,
  updatePlanningCustomField,
  updatePlanningCustomFieldOption,
  type PlanningCustomFieldValueTarget,
} from "@/server/repositories/planning-custom-fields.repository";

type AuditActor = Parameters<typeof writeAuditLog>[0]["actor"];

export function slugifyPlanningCustomField(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function listPlanningCustomFields(input: { activeOnly?: boolean }) {
  const [fields, options] = await Promise.all([
    listPlanningCustomFieldRows({ activeOnly: input.activeOnly }),
    listPlanningCustomFieldOptions({ activeOnly: false }),
  ]);
  const optionsByField = new Map<number, typeof options>();

  for (const option of options) {
    optionsByField.set(option.field_id, [...(optionsByField.get(option.field_id) ?? []), option]);
  }

  return fields.map((field): PlanningCustomFieldDto => ({
    ...field,
    options: optionsByField.get(field.id) ?? [],
  }));
}

export async function createCustomField(input: {
  actor: AuditActor;
  slug: string;
  label: string;
  iconKey: PlanningCustomFieldIconKey | null;
  inputType: PlanningCustomFieldInputType;
  active: boolean;
  required: boolean;
  appliesTo: PlanningCustomFieldAppliesTo;
  sortOrder: number;
  config: Record<string, unknown>;
}) {
  const field = await createPlanningCustomField({
    slug: input.slug,
    label: input.label,
    icon_key: input.iconKey,
    input_type: input.inputType,
    active: input.active,
    required: input.required,
    applies_to: input.appliesTo,
    sort_order: input.sortOrder,
    config: input.config,
  });
  await writeAuditLog({ actor: input.actor, action: "planning_custom_field.created", entityType: "planning_custom_field", entityId: field.id, after: field });
  return field;
}

export async function updateCustomField(input: {
  actor: AuditActor;
  id: number;
  updates: Partial<{
    slug: string;
    label: string;
    icon_key: PlanningCustomFieldIconKey | null;
    input_type: PlanningCustomFieldInputType;
    active: boolean;
    required: boolean;
    applies_to: PlanningCustomFieldAppliesTo;
    sort_order: number;
    config: Record<string, unknown>;
  }>;
}) {
  const before = await findPlanningCustomFieldRow({ fieldId: input.id });
  if (!before) {
    throw new Error("El campo configurable no existe.");
  }

  const field = await updatePlanningCustomField(input.id, input.updates);
  await writeAuditLog({ actor: input.actor, action: "planning_custom_field.updated", entityType: "planning_custom_field", entityId: field.id, before, after: field });
  return field;
}

export async function deleteUnusedCustomField(input: {
  actor: AuditActor;
  id: number;
}) {
  const before = await findPlanningCustomFieldRow({ fieldId: input.id });
  if (!before) {
    throw new Error("El campo configurable no existe.");
  }

  const usageCount = await countPlanningCustomFieldValuesByFieldId(input.id);

  if (usageCount > 0) {
    return {
      deleted: false,
      reason: "used" as const,
      usageCount,
    };
  }

  await deletePlanningCustomField(input.id);
  await writeAuditLog({
    actor: input.actor,
    action: "planning_custom_field.deleted",
    entityType: "planning_custom_field",
    entityId: input.id,
    before,
    metadata: { usageCount },
  });

  return {
    deleted: true,
    reason: null,
    usageCount,
  };
}

function formatCustomFieldUsageValue(
  row: Awaited<ReturnType<typeof listPlanningCustomFieldUsageRows>>[number]
) {
  if (row.planning_custom_field_options) {
    return row.planning_custom_field_options.label;
  }

  if (row.value_text) {
    return row.value_text;
  }

  if (row.value_number !== null) {
    return String(row.value_number);
  }

  if (row.value_date) {
    return row.value_date;
  }

  if (row.value_boolean !== null) {
    return row.value_boolean ? "Si" : "No";
  }

  return Object.keys(row.value_json).length ? JSON.stringify(row.value_json) : "";
}

export async function getCustomFieldUsage(input: { fieldId?: number; slug?: string }) {
  const field = await findPlanningCustomFieldRow(input);

  if (!field) {
    return null;
  }

  const rows = await listPlanningCustomFieldUsageRows(field.id);
  const groupContexts = await listPlannedItemUsageContextsByActivityGroupIds(
    rows.flatMap((row) => row.activity_group_id ? [row.activity_group_id] : [])
  );
  const groupContextById = new Map(
    groupContexts.map((context) => [context.activity_group_id, context])
  );
  const records = rows.map((row): PlanningCustomFieldUsageRecordDto => {
    const planningContext = row.planning_items;
    const segmentContext = row.activity_execution_segments;
    const groupContext = row.activity_group_id
      ? groupContextById.get(row.activity_group_id)
      : undefined;
    const context = planningContext ?? segmentContext ?? groupContext ?? null;

    return {
      value_id: row.id,
      planning_item_id:
        row.planning_item_id ??
        segmentContext?.planning_item_id ??
        groupContext?.id ??
        null,
      execution_segment_id: row.execution_segment_id,
      activity_group_id:
        row.activity_group_id ??
        segmentContext?.activity_group_id ??
        null,
      target_type: row.planning_item_id
        ? "planning_item"
        : row.execution_segment_id
          ? "execution_segment"
          : "activity_group",
      item_date: context?.item_date ?? null,
      shift: context?.shift ?? null,
      activity: context?.description ?? null,
      level: context?.level ?? null,
      front: context?.front ?? null,
      stored_value: formatCustomFieldUsageValue(row),
    };
  }).sort((left, right) => {
    const byDate = (right.item_date ?? "").localeCompare(left.item_date ?? "");
    return byDate || right.value_id - left.value_id;
  });
  const distinctPlanningItemIds = new Set(
    records.flatMap((record) => record.planning_item_id ? [record.planning_item_id] : [])
  );

  return {
    field: {
      id: field.id,
      slug: field.slug,
      label: field.label,
      input_type: field.input_type,
      active: field.active,
    },
    total_usage_count: records.length,
    distinct_planning_item_count: distinctPlanningItemIds.size,
    has_historical_values: records.length > 0,
    records,
  } satisfies PlanningCustomFieldUsageDto;
}

export async function listCustomFieldOptions(fieldId?: number) {
  return listPlanningCustomFieldOptions({ fieldId, activeOnly: false });
}

export async function createCustomFieldOption(input: {
  actor: AuditActor;
  fieldId: number;
  value: string;
  label: string;
  active: boolean;
  sortOrder: number;
  metadata: PlanningCustomFieldJson;
}) {
  const option = await createPlanningCustomFieldOption({
    field_id: input.fieldId,
    value: input.value,
    label: input.label,
    active: input.active,
    sort_order: input.sortOrder,
    metadata: input.metadata,
  });
  await writeAuditLog({ actor: input.actor, action: "planning_custom_field_option.created", entityType: "planning_custom_field_option", entityId: option.id, after: option });
  return option;
}

export async function updateCustomFieldOption(input: {
  actor: AuditActor;
  id: number;
  updates: Partial<{ field_id: number; value: string; label: string; active: boolean; sort_order: number; metadata: PlanningCustomFieldJson }>;
}) {
  const option = await updatePlanningCustomFieldOption(input.id, input.updates);
  await writeAuditLog({ actor: input.actor, action: "planning_custom_field_option.updated", entityType: "planning_custom_field_option", entityId: option.id, after: option });
  return option;
}

export async function deleteUnusedCustomFieldOption(input: {
  actor: AuditActor;
  id: number;
}) {
  const before = await getPlanningCustomFieldOptionById(input.id);
  if (!before) {
    throw new Error("La opcion del campo configurable no existe.");
  }

  const usageCount = await countPlanningCustomFieldValuesByOptionId(input.id);

  if (usageCount > 0) {
    return {
      deleted: false,
      reason: "used" as const,
      usageCount,
    };
  }

  await deletePlanningCustomFieldOption(input.id);
  await writeAuditLog({
    actor: input.actor,
    action: "planning_custom_field_option.deleted",
    entityType: "planning_custom_field_option",
    entityId: input.id,
    before,
    metadata: { usageCount },
  });

  return {
    deleted: true,
    reason: null,
    usageCount,
  };
}

export function getCustomFieldValues(target: PlanningCustomFieldValueTarget) {
  return listPlanningCustomFieldValues(target);
}

export function getCustomFieldValuesForPlanningItems(planningItemIds: number[]) {
  return listPlanningCustomFieldValuesByPlanningItemIds(planningItemIds);
}

function getCustomFieldTargetType(target: PlanningCustomFieldValueTarget) {
  if (target.planningItemId) {
    return "planning_item";
  }

  if (target.executionSegmentId) {
    return "execution_segment";
  }

  return "activity_group";
}

function getCustomFieldAuditEntity(target: PlanningCustomFieldValueTarget) {
  if (target.planningItemId) {
    return { entityType: "planning_item", entityId: target.planningItemId };
  }

  if (target.executionSegmentId) {
    return { entityType: "activity_execution_segment", entityId: target.executionSegmentId };
  }

  if (target.activityGroupId) {
    return { entityType: "activity_group", entityId: target.activityGroupId };
  }

  return { entityType: "planning_custom_field_values", entityId: null };
}

export async function saveCustomFieldValues(input: {
  actor: AuditActor;
  target: PlanningCustomFieldValueTarget;
  values: PlanningCustomFieldValueInputDto[];
}) {
  const fields = await listPlanningCustomFields({ activeOnly: true });
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const normalizedValues = input.values.map((value) => {
    const field = fieldsById.get(value.field_id);

    if (!field) {
      throw new Error("Uno de los campos configurables no esta activo o no existe.");
    }

    const optionsById = new Map(field.options.map((option) => [option.id, option]));

    if (field.input_type === "select") {
      const optionId = value.option_id ?? null;
      if (optionId !== null && !optionsById.has(optionId)) {
        throw new Error(`La opcion seleccionada para ${field.label} no es valida.`);
      }
      if (field.required && optionId === null) {
        throw new Error(`El campo ${field.label} es obligatorio.`);
      }
      return {
        field_id: field.id,
        option_id: optionId,
        value_json: value.value_json ?? {},
      };
    }

    if (field.input_type === "multi_select") {
      const optionIds = [...new Set(value.option_ids ?? [])].filter((optionId) => Number.isFinite(optionId));
      const invalidOption = optionIds.find((optionId) => !optionsById.has(optionId));
      if (invalidOption) {
        throw new Error(`Una opcion seleccionada para ${field.label} no es valida.`);
      }
      if (field.required && optionIds.length === 0) {
        throw new Error(`El campo ${field.label} es obligatorio.`);
      }
      return {
        field_id: field.id,
        option_ids: optionIds,
        value_json: value.value_json ?? {},
      };
    }

    if (field.input_type === "number") {
      if (value.value_number !== null && value.value_number !== undefined && !Number.isFinite(value.value_number)) {
        throw new Error(`El valor numerico de ${field.label} no es valido.`);
      }
      if (field.required && (value.value_number === null || value.value_number === undefined)) {
        throw new Error(`El campo ${field.label} es obligatorio.`);
      }
      return {
        field_id: field.id,
        value_number: value.value_number ?? null,
        value_json: value.value_json ?? {},
      };
    }

    if (field.input_type === "date") {
      const valueDate = value.value_date?.trim() || null;
      if (valueDate && !/^\d{4}-\d{2}-\d{2}$/.test(valueDate)) {
        throw new Error(`La fecha de ${field.label} no es valida.`);
      }
      if (field.required && !valueDate) {
        throw new Error(`El campo ${field.label} es obligatorio.`);
      }
      return {
        field_id: field.id,
        value_date: valueDate,
        value_json: value.value_json ?? {},
      };
    }

    if (field.input_type === "boolean") {
      if (field.required && (value.value_boolean === null || value.value_boolean === undefined)) {
        throw new Error(`El campo ${field.label} es obligatorio.`);
      }
      return {
        field_id: field.id,
        value_boolean: value.value_boolean ?? null,
        value_json: value.value_json ?? {},
      };
    }

    if (field.required && !value.value_text?.trim()) {
      throw new Error(`El campo ${field.label} es obligatorio.`);
    }

    return {
      field_id: field.id,
      value_text: value.value_text?.trim() || null,
      value_json: value.value_json ?? {},
    };
  });

  const before = await listPlanningCustomFieldValues(input.target);
  const values = await replacePlanningCustomFieldValues(input.target, normalizedValues);
  const auditEntity = getCustomFieldAuditEntity(input.target);
  await writeAuditLog({
    actor: input.actor,
    action: "planning_custom_field_values.saved",
    entityType: auditEntity.entityType,
    entityId: auditEntity.entityId,
    before,
    after: values,
    metadata: {
      planningItemId: input.target.planningItemId ?? null,
      targetType: getCustomFieldTargetType(input.target),
      valueCount: values.length,
    },
  });
  return values;
}
