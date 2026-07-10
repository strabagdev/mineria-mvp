import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type PlanningItemReadRow = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
  tracking_type?: "programado" | "real";
};

export const planningItemReadSelect =
  "id, activity_group_id, item_date, start_time, end_time, shift, category, item_type, description, notes, tracking_type";

export async function listPlannedItemsByDate(date: string) {
  const db = getSupabaseServerClient();
  let query = db
    .from("planning_items")
    .select(planningItemReadSelect)
    .eq("tracking_type", "programado")
    .order("item_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (date) {
    query = query.eq("item_date", date);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanningItemReadRow[];
}

export async function listPlannedItemsByActivityGroupIds(activityGroupIds: string[]) {
  if (!activityGroupIds.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .select(planningItemReadSelect)
    .eq("tracking_type", "programado")
    .in("activity_group_id", activityGroupIds)
    .order("item_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanningItemReadRow[];
}

export async function findPlannedItemByClientMutationId(clientMutationId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .select(planningItemReadSelect)
    .eq("client_mutation_id", clientMutationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningItemReadRow | null;
}

export async function insertPlannedItem(input: {
  created_by: string;
  activity_group_id: string;
  client_mutation_id: string | null;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: string;
  tracking_type: string;
  item_type: string;
  description: string;
  notes: string | null;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .insert(input)
    .select(planningItemReadSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningItemReadRow;
}

export type PlanningItemUpdateInput = {
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: string;
  tracking_type: string;
  item_type: string;
  description: string;
  notes: string | null;
};

export async function findPlannedItemById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .select(planningItemReadSelect)
    .eq("id", id)
    .eq("tracking_type", "programado")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningItemReadRow | null;
}

export async function findPlannedItemSummaryByActivityGroupId(activityGroupId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .select("id, activity_group_id")
    .eq("activity_group_id", activityGroupId)
    .eq("tracking_type", "programado")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { id: number; activity_group_id: string } | null;
}

export async function updatePlannedItemById(
  id: number,
  input: PlanningItemUpdateInput
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("planning_items")
    .update(input)
    .eq("id", id)
    .eq("tracking_type", "programado")
    .select(planningItemReadSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as PlanningItemReadRow;
}

export async function deletePlannedItemById(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from("planning_items")
    .delete()
    .eq("id", id)
    .eq("tracking_type", "programado");

  if (error) {
    throw error;
  }
}
