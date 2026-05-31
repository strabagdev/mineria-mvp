import "server-only";

import type {
  AssignmentFieldDto,
  AssignmentFieldInputType,
  AssignmentFieldOptionDto,
  AssignmentJson,
  AssignmentTypeDto,
  PlanningAssignmentDto,
  PlanningAssignmentValueDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  buildPlanningAssignmentsReplaceParams,
  type NormalizedPlanningAssignment,
} from "@/modules/planning-assignments/application/planning-assignment-values";
import { getSupabaseServerClient } from "@/server/db/supabase";

export type AssignmentTypeRow = Omit<AssignmentTypeDto, "fields">;
export type AssignmentFieldRow = Omit<AssignmentFieldDto, "options">;
export type AssignmentFieldOptionRow = AssignmentFieldOptionDto;
export type PlanningAssignmentRow = Omit<PlanningAssignmentDto, "values">;
export type PlanningAssignmentValueRow = PlanningAssignmentValueDto;

const typeSelect = "id, slug, label, description, active, max_instances, sort_order, config";
const fieldSelect = "id, assignment_type_id, slug, label, input_type, active, required, sort_order, config";
const optionSelect = "id, field_id, value, label, active, sort_order, metadata";
const planningAssignmentSelect = "id, planning_item_id, assignment_type_id, instance_order";
const planningAssignmentValueSelect = "id, assignment_id, field_id, option_id, value_text, value_number, value_date, value_boolean, value_json";

export async function listAssignmentTypeRows(input: { activeOnly?: boolean }) {
  const db = getSupabaseServerClient();
  let query = db.from("assignment_types").select(typeSelect).order("sort_order").order("label");
  if (input.activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AssignmentTypeRow[];
}

export async function getAssignmentTypeById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_types").select(typeSelect).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as AssignmentTypeRow | null;
}

export async function createAssignmentType(input: {
  slug: string;
  label: string;
  description: string | null;
  active: boolean;
  max_instances: number;
  sort_order: number;
  config: Record<string, unknown>;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_types").insert(input).select(typeSelect).single();
  if (error) throw error;
  return data as AssignmentTypeRow;
}

export async function updateAssignmentType(id: number, input: Partial<{
  slug: string;
  label: string;
  description: string | null;
  active: boolean;
  max_instances: number;
  sort_order: number;
  config: Record<string, unknown>;
}>) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_types").update(input).eq("id", id).select(typeSelect).single();
  if (error) throw error;
  return data as AssignmentTypeRow;
}

export async function deleteAssignmentType(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("assignment_types").delete().eq("id", id);
  if (error) throw error;
}

export async function listAssignmentFieldRows(input: { assignmentTypeId?: number; activeOnly?: boolean }) {
  const db = getSupabaseServerClient();
  let query = db.from("assignment_fields").select(fieldSelect).order("sort_order").order("label");
  if (input.assignmentTypeId) query = query.eq("assignment_type_id", input.assignmentTypeId);
  if (input.activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AssignmentFieldRow[];
}

export async function getAssignmentFieldById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_fields").select(fieldSelect).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as AssignmentFieldRow | null;
}

export async function createAssignmentField(input: {
  assignment_type_id: number;
  slug: string;
  label: string;
  input_type: AssignmentFieldInputType;
  active: boolean;
  required: boolean;
  sort_order: number;
  config: Record<string, unknown>;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_fields").insert(input).select(fieldSelect).single();
  if (error) throw error;
  return data as AssignmentFieldRow;
}

export async function updateAssignmentField(id: number, input: Partial<{
  assignment_type_id: number;
  slug: string;
  label: string;
  input_type: AssignmentFieldInputType;
  active: boolean;
  required: boolean;
  sort_order: number;
  config: Record<string, unknown>;
}>) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_fields").update(input).eq("id", id).select(fieldSelect).single();
  if (error) throw error;
  return data as AssignmentFieldRow;
}

export async function deleteAssignmentField(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("assignment_fields").delete().eq("id", id);
  if (error) throw error;
}

export async function countAssignmentFieldsByTypeId(assignmentTypeId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db.from("assignment_fields").select("id", { count: "exact", head: true }).eq("assignment_type_id", assignmentTypeId);
  if (error) throw error;
  return count ?? 0;
}

export async function listAssignmentFieldOptions(input: { fieldId?: number; activeOnly?: boolean }) {
  const db = getSupabaseServerClient();
  let query = db.from("assignment_field_options").select(optionSelect).order("sort_order").order("label");
  if (input.fieldId) query = query.eq("field_id", input.fieldId);
  if (input.activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AssignmentFieldOptionRow[];
}

export async function getAssignmentFieldOptionById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_field_options").select(optionSelect).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as AssignmentFieldOptionRow | null;
}

export async function createAssignmentFieldOption(input: {
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: AssignmentJson;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_field_options").insert(input).select(optionSelect).single();
  if (error) throw error;
  return data as AssignmentFieldOptionRow;
}

export async function updateAssignmentFieldOption(id: number, input: Partial<{
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: AssignmentJson;
}>) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("assignment_field_options").update(input).eq("id", id).select(optionSelect).single();
  if (error) throw error;
  return data as AssignmentFieldOptionRow;
}

export async function deleteAssignmentFieldOption(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("assignment_field_options").delete().eq("id", id);
  if (error) throw error;
}

export async function countAssignmentFieldOptionsByFieldId(fieldId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db.from("assignment_field_options").select("id", { count: "exact", head: true }).eq("field_id", fieldId);
  if (error) throw error;
  return count ?? 0;
}

export async function planningItemExists(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("planning_items").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function listPlanningAssignmentRows(planningItemId: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_assignments")
    .select(planningAssignmentSelect)
    .eq("planning_item_id", planningItemId)
    .order("assignment_type_id")
    .order("instance_order");
  if (error) throw error;
  return (data ?? []) as PlanningAssignmentRow[];
}

export async function listPlanningAssignmentValueRows(assignmentIds: number[]) {
  if (!assignmentIds.length) return [];
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_assignment_values")
    .select(planningAssignmentValueSelect)
    .in("assignment_id", assignmentIds)
    .order("id");
  if (error) throw error;
  return (data ?? []) as PlanningAssignmentValueRow[];
}

export async function replacePlanningAssignmentRows(planningItemId: number, assignments: NormalizedPlanningAssignment[]) {
  const db = getSupabaseServerClient();
  const { error } = await db.rpc("replace_planning_assignments", buildPlanningAssignmentsReplaceParams(planningItemId, assignments));
  if (error) throw error;
}

export async function countPlanningAssignmentsByTypeId(assignmentTypeId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db.from("planning_assignments").select("id", { count: "exact", head: true }).eq("assignment_type_id", assignmentTypeId);
  if (error) throw error;
  return count ?? 0;
}

export async function countPlanningAssignmentValuesByFieldId(fieldId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db.from("planning_assignment_values").select("id", { count: "exact", head: true }).eq("field_id", fieldId);
  if (error) throw error;
  return count ?? 0;
}

export async function countPlanningAssignmentValuesByOptionId(optionId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db.from("planning_assignment_values").select("id", { count: "exact", head: true }).eq("option_id", optionId);
  if (error) throw error;
  return count ?? 0;
}
