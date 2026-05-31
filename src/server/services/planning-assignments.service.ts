import "server-only";

import { writeAuditLog } from "@/lib/auditLog";
import { normalizePlanningAssignments } from "@/modules/planning-assignments/application/planning-assignment-values";
import type {
  AssignmentFieldDto,
  AssignmentFieldInputType,
  AssignmentJson,
  AssignmentTypeDto,
  PlanningAssignmentDto,
  PlanningAssignmentInputDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  countAssignmentFieldOptionsByFieldId,
  countAssignmentFieldsByTypeId,
  countPlanningAssignmentsByTypeId,
  countPlanningAssignmentValuesByFieldId,
  countPlanningAssignmentValuesByOptionId,
  createAssignmentField,
  createAssignmentFieldOption,
  createAssignmentType,
  deleteAssignmentField,
  deleteAssignmentFieldOption,
  deleteAssignmentType,
  getAssignmentFieldById,
  getAssignmentFieldOptionById,
  getAssignmentTypeById,
  listAssignmentFieldOptions,
  listAssignmentFieldRows,
  listAssignmentTypeRows,
  listPlanningAssignmentRows,
  listPlanningAssignmentValueRows,
  planningItemExists,
  replacePlanningAssignmentRows,
  updateAssignmentField,
  updateAssignmentFieldOption,
  updateAssignmentType,
} from "@/server/repositories/planning-assignments.repository";

type AuditActor = Parameters<typeof writeAuditLog>[0]["actor"];

export function slugifyAssignmentCatalogValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function listAssignmentTypes(input: { activeOnly?: boolean }) {
  const [types, fields, options] = await Promise.all([
    listAssignmentTypeRows(input),
    listAssignmentFieldRows({ activeOnly: input.activeOnly }),
    listAssignmentFieldOptions({ activeOnly: input.activeOnly }),
  ]);
  const optionsByField = new Map<number, typeof options>();
  const fieldsByType = new Map<number, AssignmentFieldDto[]>();

  for (const option of options) {
    optionsByField.set(option.field_id, [...(optionsByField.get(option.field_id) ?? []), option]);
  }

  for (const field of fields) {
    fieldsByType.set(field.assignment_type_id, [
      ...(fieldsByType.get(field.assignment_type_id) ?? []),
      { ...field, options: optionsByField.get(field.id) ?? [] },
    ]);
  }

  return types.map((type): AssignmentTypeDto => ({ ...type, fields: fieldsByType.get(type.id) ?? [] }));
}

export async function createAssignmentCatalogType(input: {
  actor: AuditActor;
  slug: string;
  label: string;
  description: string | null;
  active: boolean;
  maxInstances: number;
  sortOrder: number;
  config: Record<string, unknown>;
}) {
  const type = await createAssignmentType({
    slug: input.slug,
    label: input.label,
    description: input.description,
    active: input.active,
    max_instances: input.maxInstances,
    sort_order: input.sortOrder,
    config: input.config,
  });
  await writeAuditLog({ actor: input.actor, action: "assignment_type.created", entityType: "assignment_type", entityId: type.id, after: type });
  return { ...type, fields: [] };
}

export async function updateAssignmentCatalogType(input: {
  actor: AuditActor;
  id: number;
  updates: Partial<{ slug: string; label: string; description: string | null; active: boolean; max_instances: number; sort_order: number; config: Record<string, unknown> }>;
}) {
  const before = await getAssignmentTypeById(input.id);
  const type = await updateAssignmentType(input.id, input.updates);
  await writeAuditLog({ actor: input.actor, action: "assignment_type.updated", entityType: "assignment_type", entityId: type.id, before, after: type });
  return { ...type, fields: await listAssignmentFields({ assignmentTypeId: type.id, activeOnly: false }) };
}

export async function deleteUnusedAssignmentType(input: { actor: AuditActor; id: number }) {
  const before = await getAssignmentTypeById(input.id);
  if (!before) throw new Error("El tipo de asignacion no existe.");
  const [fieldCount, assignmentCount] = await Promise.all([
    countAssignmentFieldsByTypeId(input.id),
    countPlanningAssignmentsByTypeId(input.id),
  ]);
  const dependencyCount = fieldCount + assignmentCount;
  if (dependencyCount > 0) return { deleted: false, dependencyCount };
  await deleteAssignmentType(input.id);
  await writeAuditLog({ actor: input.actor, action: "assignment_type.deleted", entityType: "assignment_type", entityId: input.id, before });
  return { deleted: true, dependencyCount };
}

export async function listAssignmentFields(input: { assignmentTypeId?: number; activeOnly?: boolean }) {
  const [fields, options] = await Promise.all([
    listAssignmentFieldRows(input),
    listAssignmentFieldOptions({ activeOnly: input.activeOnly }),
  ]);
  const optionsByField = new Map<number, typeof options>();
  for (const option of options) optionsByField.set(option.field_id, [...(optionsByField.get(option.field_id) ?? []), option]);
  return fields.map((field): AssignmentFieldDto => ({ ...field, options: optionsByField.get(field.id) ?? [] }));
}

async function assertAssignmentTypeExists(assignmentTypeId: number) {
  if (!await getAssignmentTypeById(assignmentTypeId)) throw new Error("El tipo de asignacion no existe.");
}

export async function createAssignmentCatalogField(input: {
  actor: AuditActor;
  assignmentTypeId: number;
  slug: string;
  label: string;
  inputType: AssignmentFieldInputType;
  active: boolean;
  required: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
}) {
  await assertAssignmentTypeExists(input.assignmentTypeId);
  const field = await createAssignmentField({
    assignment_type_id: input.assignmentTypeId,
    slug: input.slug,
    label: input.label,
    input_type: input.inputType,
    active: input.active,
    required: input.required,
    sort_order: input.sortOrder,
    config: input.config,
  });
  await writeAuditLog({ actor: input.actor, action: "assignment_field.created", entityType: "assignment_field", entityId: field.id, after: field });
  return { ...field, options: [] };
}

export async function updateAssignmentCatalogField(input: {
  actor: AuditActor;
  id: number;
  updates: Partial<{ assignment_type_id: number; slug: string; label: string; input_type: AssignmentFieldInputType; active: boolean; required: boolean; sort_order: number; config: Record<string, unknown> }>;
}) {
  const before = await getAssignmentFieldById(input.id);
  if (!before) throw new Error("El campo de asignacion no existe.");
  if (input.updates.assignment_type_id !== undefined) await assertAssignmentTypeExists(input.updates.assignment_type_id);
  const nextInputType = input.updates.input_type ?? before.input_type;
  if (nextInputType !== "select" && nextInputType !== "multi_select" && await countAssignmentFieldOptionsByFieldId(input.id) > 0) {
    throw new Error("No puedes cambiar este campo a tipo escalar mientras tenga opciones. Eliminalas primero.");
  }
  const field = await updateAssignmentField(input.id, input.updates);
  await writeAuditLog({ actor: input.actor, action: "assignment_field.updated", entityType: "assignment_field", entityId: field.id, before, after: field });
  return { ...field, options: await listAssignmentFieldOptions({ fieldId: field.id, activeOnly: false }) };
}

export async function deleteUnusedAssignmentField(input: { actor: AuditActor; id: number }) {
  const before = await getAssignmentFieldById(input.id);
  if (!before) throw new Error("El campo de asignacion no existe.");
  const [optionCount, valueCount] = await Promise.all([
    countAssignmentFieldOptionsByFieldId(input.id),
    countPlanningAssignmentValuesByFieldId(input.id),
  ]);
  const dependencyCount = optionCount + valueCount;
  if (dependencyCount > 0) return { deleted: false, dependencyCount };
  await deleteAssignmentField(input.id);
  await writeAuditLog({ actor: input.actor, action: "assignment_field.deleted", entityType: "assignment_field", entityId: input.id, before });
  return { deleted: true, dependencyCount };
}

export function listAssignmentOptions(fieldId?: number) {
  return listAssignmentFieldOptions({ fieldId, activeOnly: false });
}

async function assertOptionField(fieldId: number) {
  const field = await getAssignmentFieldById(fieldId);
  if (!field) throw new Error("El campo de asignacion no existe.");
  if (field.input_type !== "select" && field.input_type !== "multi_select") {
    throw new Error("Solo los campos select y multi_select pueden tener opciones.");
  }
}

export async function createAssignmentCatalogOption(input: { actor: AuditActor; fieldId: number; value: string; label: string; active: boolean; sortOrder: number; metadata: AssignmentJson }) {
  await assertOptionField(input.fieldId);
  const option = await createAssignmentFieldOption({ field_id: input.fieldId, value: input.value, label: input.label, active: input.active, sort_order: input.sortOrder, metadata: input.metadata });
  await writeAuditLog({ actor: input.actor, action: "assignment_field_option.created", entityType: "assignment_field_option", entityId: option.id, after: option });
  return option;
}

export async function updateAssignmentCatalogOption(input: { actor: AuditActor; id: number; updates: Partial<{ field_id: number; value: string; label: string; active: boolean; sort_order: number; metadata: AssignmentJson }> }) {
  const before = await getAssignmentFieldOptionById(input.id);
  if (!before) throw new Error("La opcion de asignacion no existe.");
  if (input.updates.field_id !== undefined) await assertOptionField(input.updates.field_id);
  const option = await updateAssignmentFieldOption(input.id, input.updates);
  await writeAuditLog({ actor: input.actor, action: "assignment_field_option.updated", entityType: "assignment_field_option", entityId: option.id, before, after: option });
  return option;
}

export async function deleteAssignmentCatalogOption(input: { actor: AuditActor; id: number }) {
  const before = await getAssignmentFieldOptionById(input.id);
  if (!before) throw new Error("La opcion de asignacion no existe.");
  const usageCount = await countPlanningAssignmentValuesByOptionId(input.id);
  if (usageCount > 0) return { deleted: false, usageCount };
  await deleteAssignmentFieldOption(input.id);
  await writeAuditLog({ actor: input.actor, action: "assignment_field_option.deleted", entityType: "assignment_field_option", entityId: input.id, before });
  return { deleted: true, usageCount };
}

export async function getPlanningAssignments(planningItemId: number) {
  const assignments = await listPlanningAssignmentRows(planningItemId);
  const values = await listPlanningAssignmentValueRows(assignments.map((assignment) => assignment.id));
  const valuesByAssignment = new Map<number, typeof values>();

  for (const value of values) {
    valuesByAssignment.set(value.assignment_id, [...(valuesByAssignment.get(value.assignment_id) ?? []), value]);
  }

  return assignments.map((assignment): PlanningAssignmentDto => ({
    ...assignment,
    values: valuesByAssignment.get(assignment.id) ?? [],
  }));
}

export async function savePlanningAssignments(input: {
  actor: AuditActor;
  planningItemId: number;
  assignments: PlanningAssignmentInputDto[];
}) {
  if (!await planningItemExists(input.planningItemId)) {
    throw new Error("El programado no existe.");
  }

  const types = await listAssignmentTypes({ activeOnly: true });
  const normalizedAssignments = normalizePlanningAssignments(types, input.assignments);
  await replacePlanningAssignmentRows(input.planningItemId, normalizedAssignments);
  const assignments = await getPlanningAssignments(input.planningItemId);
  await writeAuditLog({
    actor: input.actor,
    action: "planning_assignments.replaced",
    entityType: "planning_item",
    entityId: input.planningItemId,
    after: assignments,
    metadata: { assignmentCount: assignments.length },
  });
  return assignments;
}
