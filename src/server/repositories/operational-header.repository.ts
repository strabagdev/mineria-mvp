import "server-only";

import type {
  OperationalHeaderFieldDto,
  OperationalHeaderFieldOptionDto,
  OperationalHeaderJson,
  OperationalHeaderOptionDependencyDto,
  OperationalHeaderValueDto,
} from "@/modules/operational-header/contracts/operational-header";
import { getSupabaseServerClient } from "@/server/db/supabase";

export type OperationalHeaderFieldRow = Omit<OperationalHeaderFieldDto, "options">;
export type OperationalHeaderFieldOptionRow = OperationalHeaderFieldOptionDto;
export type OperationalHeaderOptionDependencyRow = OperationalHeaderOptionDependencyDto;
export type OperationalHeaderValueRow = OperationalHeaderValueDto;

const fieldSelect =
  "id, slug, label, input_type, required, active, sort_order, grouping_order, groupable, filterable, visible_in_gantt, exportable";
const optionSelect = "id, field_id, value, label, active, sort_order, metadata";
const dependencySelect = "id, field_id, option_id, depends_on_field_id, depends_on_option_id";
const valueSelect =
  "id, field_id, activity_group_id, planning_item_id, execution_segment_id, option_id, value_text";

export async function listOperationalHeaderFieldRows(input: { activeOnly?: boolean } = {}) {
  const db = getSupabaseServerClient();
  let query = db
    .from("operational_header_fields")
    .select(fieldSelect)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (input.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as OperationalHeaderFieldRow[];
}

export async function findOperationalHeaderFieldRow(input: { fieldId?: number; slug?: string }) {
  const db = getSupabaseServerClient();
  let query = db.from("operational_header_fields").select(fieldSelect);

  if (input.fieldId) {
    query = query.eq("id", input.fieldId);
  } else if (input.slug) {
    query = query.eq("slug", input.slug);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return data as OperationalHeaderFieldRow | null;
}

export async function createOperationalHeaderField(input: {
  slug: string;
  label: string;
  input_type: OperationalHeaderFieldRow["input_type"];
  required: boolean;
  active: boolean;
  sort_order: number;
  grouping_order: number | null;
  groupable: boolean;
  filterable: boolean;
  visible_in_gantt: boolean;
  exportable: boolean;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_fields")
    .insert(input)
    .select(fieldSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderFieldRow;
}

export async function updateOperationalHeaderField(
  id: number,
  input: Partial<{
    slug: string;
    label: string;
    input_type: OperationalHeaderFieldRow["input_type"];
    required: boolean;
    active: boolean;
    sort_order: number;
    grouping_order: number | null;
    groupable: boolean;
    filterable: boolean;
    visible_in_gantt: boolean;
    exportable: boolean;
  }>
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_fields")
    .update(input)
    .eq("id", id)
    .select(fieldSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderFieldRow;
}

export async function deleteOperationalHeaderField(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("operational_header_fields").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function countOperationalHeaderValuesByFieldId(fieldId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from("operational_header_values")
    .select("id", { count: "exact", head: true })
    .eq("field_id", fieldId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function countOperationalHeaderOptionsByFieldId(fieldId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from("operational_header_field_options")
    .select("id", { count: "exact", head: true })
    .eq("field_id", fieldId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function listOperationalHeaderFieldOptionRows(input: {
  fieldId?: number;
  activeOnly?: boolean;
} = {}) {
  const db = getSupabaseServerClient();
  let query = db
    .from("operational_header_field_options")
    .select(optionSelect)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (input.fieldId) {
    query = query.eq("field_id", input.fieldId);
  }

  if (input.activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as OperationalHeaderFieldOptionRow[];
}

export async function findOperationalHeaderFieldOptionRow(input: { optionId?: number; fieldId?: number; value?: string }) {
  const db = getSupabaseServerClient();
  let query = db.from("operational_header_field_options").select(optionSelect);

  if (input.optionId) {
    query = query.eq("id", input.optionId);
  } else if (input.fieldId && input.value) {
    query = query.eq("field_id", input.fieldId).eq("value", input.value);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderFieldOptionRow | null;
}

export async function createOperationalHeaderFieldOption(input: {
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: OperationalHeaderJson;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_field_options")
    .insert(input)
    .select(optionSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderFieldOptionRow;
}

export async function updateOperationalHeaderFieldOption(
  id: number,
  input: Partial<{
    value: string;
    label: string;
    active: boolean;
    sort_order: number;
    metadata: OperationalHeaderJson;
  }>
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_field_options")
    .update(input)
    .eq("id", id)
    .select(optionSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderFieldOptionRow;
}

export async function deleteOperationalHeaderFieldOption(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("operational_header_field_options").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function countOperationalHeaderValuesByOptionId(optionId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from("operational_header_values")
    .select("id", { count: "exact", head: true })
    .eq("option_id", optionId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function listOperationalHeaderOptionDependencyRows() {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_option_dependencies")
    .select(dependencySelect)
    .order("field_id", { ascending: true })
    .order("option_id", { ascending: true })
    .order("depends_on_field_id", { ascending: true })
    .order("depends_on_option_id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OperationalHeaderOptionDependencyRow[];
}

export async function findOperationalHeaderOptionDependencyRow(input: {
  dependencyId?: number;
  optionId?: number;
  dependsOnOptionId?: number;
}) {
  const db = getSupabaseServerClient();
  let query = db.from("operational_header_option_dependencies").select(dependencySelect);

  if (input.dependencyId) {
    query = query.eq("id", input.dependencyId);
  } else if (input.optionId && input.dependsOnOptionId) {
    query = query
      .eq("option_id", input.optionId)
      .eq("depends_on_option_id", input.dependsOnOptionId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderOptionDependencyRow | null;
}

export async function createOperationalHeaderOptionDependency(input: {
  field_id: number;
  option_id: number;
  depends_on_field_id: number;
  depends_on_option_id: number;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_option_dependencies")
    .insert(input)
    .select(dependencySelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderOptionDependencyRow;
}

export async function deleteOperationalHeaderOptionDependency(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("operational_header_option_dependencies").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function listOperationalHeaderValueRowsByActivityGroupIds(
  activityGroupIds: string[]
) {
  const ids = [...new Set(activityGroupIds.map((id) => id.trim()).filter(Boolean))];

  if (!ids.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_values")
    .select(valueSelect)
    .in("activity_group_id", ids)
    .order("field_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OperationalHeaderValueRow[];
}

export async function listOperationalHeaderValueRowsByPlanningItemIds(
  planningItemIds: number[]
) {
  const ids = [...new Set(planningItemIds.filter((id) => Number.isFinite(id) && id > 0))];

  if (!ids.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_values")
    .select(valueSelect)
    .in("planning_item_id", ids)
    .order("field_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OperationalHeaderValueRow[];
}

export async function listOperationalHeaderValueRowsByExecutionSegmentIds(
  executionSegmentIds: number[]
) {
  const ids = [...new Set(executionSegmentIds.filter((id) => Number.isFinite(id) && id > 0))];

  if (!ids.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("operational_header_values")
    .select(valueSelect)
    .in("execution_segment_id", ids)
    .order("field_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as OperationalHeaderValueRow[];
}

export async function upsertOperationalHeaderValueForPlanningItem(input: {
  field_id: number;
  activity_group_id: string;
  planning_item_id: number;
  option_id: number | null;
  value_text: string | null;
}) {
  const db = getSupabaseServerClient();
  const payload = {
    field_id: input.field_id,
    activity_group_id: input.activity_group_id,
    planning_item_id: input.planning_item_id,
    execution_segment_id: null,
    option_id: input.option_id,
    value_text: input.value_text,
  };
  const { data: updated, error: updateError } = await db
    .from("operational_header_values")
    .update({
      activity_group_id: payload.activity_group_id,
      option_id: payload.option_id,
      value_text: payload.value_text,
      updated_at: new Date().toISOString(),
    })
    .eq("field_id", payload.field_id)
    .eq("planning_item_id", payload.planning_item_id)
    .select(valueSelect)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (updated) {
    return updated as OperationalHeaderValueRow;
  }

  const { data, error } = await db
    .from("operational_header_values")
    .insert(payload)
    .select(valueSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderValueRow;
}

export async function upsertOperationalHeaderValueForExecutionSegment(input: {
  field_id: number;
  activity_group_id: string;
  execution_segment_id: number;
  option_id: number | null;
  value_text: string | null;
}) {
  const db = getSupabaseServerClient();
  const payload = {
    field_id: input.field_id,
    activity_group_id: input.activity_group_id,
    planning_item_id: null,
    execution_segment_id: input.execution_segment_id,
    option_id: input.option_id,
    value_text: input.value_text,
  };
  const { data: updated, error: updateError } = await db
    .from("operational_header_values")
    .update({
      activity_group_id: payload.activity_group_id,
      option_id: payload.option_id,
      value_text: payload.value_text,
      updated_at: new Date().toISOString(),
    })
    .eq("field_id", payload.field_id)
    .eq("execution_segment_id", payload.execution_segment_id)
    .select(valueSelect)
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (updated) {
    return updated as OperationalHeaderValueRow;
  }

  const { data, error } = await db
    .from("operational_header_values")
    .insert(payload)
    .select(valueSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as OperationalHeaderValueRow;
}
