import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";
import type {
  PlanningCustomFieldAppliesTo,
  PlanningCustomFieldDto,
  PlanningCustomFieldIconKey,
  PlanningCustomFieldInputType,
  PlanningCustomFieldJson,
  PlanningCustomFieldOptionDto,
  PlanningCustomFieldValueDto,
  PlanningCustomFieldValueInputDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";

export type PlanningCustomFieldRow = Omit<PlanningCustomFieldDto, "options">;
export type PlanningCustomFieldOptionRow = PlanningCustomFieldOptionDto;
export type PlanningCustomFieldValueRow = PlanningCustomFieldValueDto;
export type PlanningCustomFieldUsageContextRow = PlanningCustomFieldValueRow & {
  planning_items: {
    id: number;
    item_date: string;
    shift: string;
    description: string;
    level: string;
    front: string;
  } | null;
  activity_execution_segments: {
    id: number;
    planning_item_id: number | null;
    activity_group_id: string;
    item_date: string;
    shift: string;
    description: string;
    level: string;
    front: string;
  } | null;
  planning_custom_field_options: {
    value: string;
    label: string;
  } | null;
};

const fieldSelect = "id, slug, label, icon_key, input_type, active, required, applies_to, sort_order, config";
const optionSelect = "id, field_id, value, label, active, sort_order, metadata";
const valueSelect =
  "id, field_id, planning_item_id, execution_segment_id, activity_group_id, option_id, value_text, value_number, value_date, value_boolean, value_json";
const usageContextSelect = `${valueSelect},
  planning_items(id, item_date, shift, description, level, front),
  activity_execution_segments(id, planning_item_id, activity_group_id, item_date, shift, description, level, front),
  planning_custom_field_options(value, label)`;

export async function listPlanningCustomFieldRows(input: { activeOnly?: boolean }) {
  const db = getSupabaseServerClient();
  let query = db
    .from("planning_custom_fields")
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

  return (data ?? []) as PlanningCustomFieldRow[];
}

export async function listPlanningCustomFieldOptions(input: { fieldId?: number; activeOnly?: boolean }) {
  const db = getSupabaseServerClient();
  let query = db
    .from("planning_custom_field_options")
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

  return (data ?? []) as PlanningCustomFieldOptionRow[];
}

export async function createPlanningCustomField(input: {
  slug: string;
  label: string;
  icon_key: PlanningCustomFieldIconKey | null;
  input_type: PlanningCustomFieldInputType;
  active: boolean;
  required: boolean;
  applies_to: PlanningCustomFieldAppliesTo;
  sort_order: number;
  config: Record<string, unknown>;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("planning_custom_fields").insert(input).select(fieldSelect).single();
  if (error) {
    throw error;
  }
  return data as PlanningCustomFieldRow;
}

export async function updatePlanningCustomField(id: number, input: Partial<{
  slug: string;
  label: string;
  icon_key: PlanningCustomFieldIconKey | null;
  input_type: PlanningCustomFieldInputType;
  active: boolean;
  required: boolean;
  applies_to: PlanningCustomFieldAppliesTo;
  sort_order: number;
  config: Record<string, unknown>;
}>) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("planning_custom_fields").update(input).eq("id", id).select(fieldSelect).single();
  if (error) {
    throw error;
  }
  return data as PlanningCustomFieldRow;
}

export async function countPlanningCustomFieldValuesByFieldId(fieldId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from("planning_custom_field_values")
    .select("id", { count: "exact", head: true })
    .eq("field_id", fieldId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function findPlanningCustomFieldRow(input: { fieldId?: number; slug?: string }) {
  const db = getSupabaseServerClient();
  let query = db.from("planning_custom_fields").select(fieldSelect);

  if (input.fieldId) {
    query = query.eq("id", input.fieldId);
  } else if (input.slug) {
    query = query.eq("slug", input.slug);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return data as PlanningCustomFieldRow | null;
}

export async function listPlanningCustomFieldUsageRows(fieldId: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_custom_field_values")
    .select(usageContextSelect)
    .eq("field_id", fieldId)
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as PlanningCustomFieldUsageContextRow[];
}

export async function listPlannedItemUsageContextsByActivityGroupIds(
  activityGroupIds: string[]
) {
  const ids = [...new Set(activityGroupIds.filter(Boolean))];

  if (!ids.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .select("id, activity_group_id, item_date, shift, description, level, front")
    .eq("tracking_type", "programado")
    .in("activity_group_id", ids);

  if (error) {
    throw error;
  }

  return (data ?? []) as {
    id: number;
    activity_group_id: string;
    item_date: string;
    shift: string;
    description: string;
    level: string;
    front: string;
  }[];
}

export async function deletePlanningCustomField(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("planning_custom_fields").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export async function createPlanningCustomFieldOption(input: {
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: PlanningCustomFieldJson;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("planning_custom_field_options").insert(input).select(optionSelect).single();
  if (error) {
    throw error;
  }
  return data as PlanningCustomFieldOptionRow;
}

export async function updatePlanningCustomFieldOption(id: number, input: Partial<{
  field_id: number;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
  metadata: PlanningCustomFieldJson;
}>) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from("planning_custom_field_options").update(input).eq("id", id).select(optionSelect).single();
  if (error) {
    throw error;
  }
  return data as PlanningCustomFieldOptionRow;
}

export async function getPlanningCustomFieldOptionById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_custom_field_options")
    .select(optionSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningCustomFieldOptionRow | null;
}

export async function countPlanningCustomFieldValuesByOptionId(optionId: number) {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from("planning_custom_field_values")
    .select("id", { count: "exact", head: true })
    .eq("option_id", optionId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function deletePlanningCustomFieldOption(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("planning_custom_field_options").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export type PlanningCustomFieldValueTarget = {
  planningItemId?: number | null;
  executionSegmentId?: number | null;
  activityGroupId?: string | null;
};

function applyTargetFilter<T>(query: T, target: PlanningCustomFieldValueTarget) {
  let nextQuery = query as {
    eq: (column: string, value: string | number) => typeof nextQuery;
    is: (column: string, value: null) => typeof nextQuery;
  };

  if (target.planningItemId) {
    nextQuery = nextQuery.eq("planning_item_id", target.planningItemId);
  } else {
    nextQuery = nextQuery.is("planning_item_id", null);
  }

  if (target.executionSegmentId) {
    nextQuery = nextQuery.eq("execution_segment_id", target.executionSegmentId);
  } else {
    nextQuery = nextQuery.is("execution_segment_id", null);
  }

  if (target.activityGroupId) {
    nextQuery = nextQuery.eq("activity_group_id", target.activityGroupId);
  } else {
    nextQuery = nextQuery.is("activity_group_id", null);
  }

  return nextQuery as T;
}

export async function listPlanningCustomFieldValues(target: PlanningCustomFieldValueTarget) {
  const db = getSupabaseServerClient();
  const query = applyTargetFilter(
    db.from("planning_custom_field_values").select(valueSelect).order("id", { ascending: true }),
    target
  );
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []) as PlanningCustomFieldValueRow[];
}

export async function listPlanningCustomFieldValuesByPlanningItemIds(planningItemIds: number[]) {
  const ids = [...new Set(planningItemIds.filter((id) => Number.isFinite(id) && id > 0))];

  if (!ids.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_custom_field_values")
    .select(valueSelect)
    .in("planning_item_id", ids)
    .order("planning_item_id", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanningCustomFieldValueRow[];
}

export async function replacePlanningCustomFieldValues(
  target: PlanningCustomFieldValueTarget,
  values: PlanningCustomFieldValueInputDto[]
) {
  const db = getSupabaseServerClient();
  const fieldIds = [...new Set(values.map((value) => value.field_id).filter((fieldId) => Number.isFinite(fieldId)))];

  if (!fieldIds.length) {
    return listPlanningCustomFieldValues(target);
  }

  const deleteQuery = applyTargetFilter(
    db.from("planning_custom_field_values").delete().in("field_id", fieldIds),
    target
  );
  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw deleteError;
  }

  const rows = values.flatMap((value) => {
    const base = {
      field_id: value.field_id,
      planning_item_id: target.planningItemId ?? null,
      execution_segment_id: target.executionSegmentId ?? null,
      activity_group_id: target.activityGroupId ?? null,
      value_text: value.value_text ?? null,
      value_number: value.value_number ?? null,
      value_date: value.value_date ?? null,
      value_boolean: value.value_boolean ?? null,
      value_json: value.value_json ?? {},
    };

    if (value.option_ids?.length) {
      return value.option_ids.map((optionId) => ({ ...base, option_id: optionId }));
    }

    if (
      !value.option_id &&
      (value.value_text === null || value.value_text === undefined || value.value_text === "") &&
      (value.value_number === null || value.value_number === undefined) &&
      (value.value_date === null || value.value_date === undefined || value.value_date === "") &&
      (value.value_boolean === null || value.value_boolean === undefined)
    ) {
      return [];
    }

    return [{ ...base, option_id: value.option_id ?? null }];
  });

  if (!rows.length) {
    return listPlanningCustomFieldValues(target);
  }

  const { data, error } = await db.from("planning_custom_field_values").insert(rows).select(valueSelect);
  if (error) {
    throw error;
  }
  return (data ?? []) as PlanningCustomFieldValueRow[];
}
