import "server-only";

import { writeAuditLog } from "@/lib/auditLog";
import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
  PlanningCustomFieldInputType,
  PlanningCustomFieldJson,
  PlanningCustomFieldValueInputDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  countPlanningCustomFieldValuesByFieldId,
  countPlanningCustomFieldValuesByOptionId,
  createPlanningCustomField,
  createPlanningCustomFieldOption,
  deletePlanningCustomField,
  deletePlanningCustomFieldOption,
  listPlanningCustomFieldOptions,
  listPlanningCustomFieldRows,
  listPlanningCustomFieldValues,
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
    input_type: PlanningCustomFieldInputType;
    active: boolean;
    required: boolean;
    applies_to: PlanningCustomFieldAppliesTo;
    sort_order: number;
    config: Record<string, unknown>;
  }>;
}) {
  const field = await updatePlanningCustomField(input.id, input.updates);
  await writeAuditLog({ actor: input.actor, action: "planning_custom_field.updated", entityType: "planning_custom_field", entityId: field.id, after: field });
  return field;
}

export async function deleteUnusedCustomField(input: {
  actor: AuditActor;
  id: number;
}) {
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
    metadata: { usageCount },
  });

  return {
    deleted: true,
    reason: null,
    usageCount,
  };
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

  const values = await replacePlanningCustomFieldValues(input.target, normalizedValues);
  await writeAuditLog({ actor: input.actor, action: "planning_custom_field_values.saved", entityType: "planning_custom_field_values", entityId: null, after: values });
  return values;
}
