import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type PlanningSegmentReadRow = {
  id: number;
  planning_item_id?: number | null;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
  segment_order?: number;
  client_mutation_id?: string | null;
};

export const planningSegmentReadSelect =
  "id, planning_item_id, activity_group_id, item_date, start_time, end_time, shift, category, item_type, description, notes, segment_order, client_mutation_id";

export type PlanningSegmentOverlapRow = {
  id: number;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
};

export type PlanningSegmentInsertRow = {
  planning_item_id: number | undefined;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: string;
  item_type: string;
  description: string;
  notes: string | null;
  client_mutation_id: string | null;
  created_by: string;
  segment_order: number;
};

export type PlanningSegmentUpdateRow = {
  planning_item_id: number | undefined;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  category: string;
  item_type: string;
  description: string;
  notes: string | null;
  client_mutation_id?: string | null;
};

export type ReconcileRealExecutionSegmentsInput = {
  segmentId: number;
  planningItemId: number | null | undefined;
  activityGroupId: string;
  segments: Array<{
    item_date: string;
    start_time: string;
    end_time: string;
    shift: string;
    category: string;
    item_type: string;
    description: string;
    notes: string | null;
  }>;
  operationalHeaderValues?: Array<{
    field_id: number;
    value: string;
    option_id?: number | null;
  }>;
  actorUserId?: string | null;
  actorEmail?: string | null;
  createdBy: string;
};

export async function listExecutionSegmentsByDate(date: string) {
  const db = getSupabaseServerClient();
  let query = db
    .from("activity_execution_segments")
    .select(planningSegmentReadSelect)
    .order("item_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (date) {
    query = query.eq("item_date", date);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanningSegmentReadRow[];
}

export async function findSegmentsByClientMutationId(clientMutationId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .select(planningSegmentReadSelect)
    .eq("client_mutation_id", clientMutationId)
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanningSegmentReadRow[];
}

export async function listSegmentsForOverlap(activityGroupId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .select("id, item_date, start_time, end_time, shift")
    .eq("activity_group_id", activityGroupId);

  if (error) {
    throw error;
  }

  return (data ?? []) as PlanningSegmentOverlapRow[];
}

export async function getNextSegmentOrder(activityGroupId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .select("segment_order")
    .eq("activity_group_id", activityGroupId)
    .order("segment_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Number(data?.segment_order ?? 0) + 1;
}

export async function insertExecutionSegments(rows: PlanningSegmentInsertRow[]) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .insert(rows)
    .select(planningSegmentReadSelect)
    .order("start_time", { ascending: true });

  return {
    data: (data ?? []) as PlanningSegmentReadRow[],
    error,
  };
}

export async function hasExecutionSegmentForPlanningItem(planningItemId: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .select("id")
    .eq("planning_item_id", planningItemId)
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

export async function findExecutionSegmentById(id: number) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .select(planningSegmentReadSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanningSegmentReadRow | null;
}

export async function updateExecutionSegmentById(
  id: number,
  input: PlanningSegmentUpdateRow
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("activity_execution_segments")
    .update(input)
    .eq("id", id)
    .select(planningSegmentReadSelect)
    .single();

  return {
    data: data as PlanningSegmentReadRow | null,
    error,
  };
}

export async function deleteExecutionSegmentById(id: number) {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from("activity_execution_segments")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function reconcileRealExecutionSegments(
  input: ReconcileRealExecutionSegmentsInput
) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.rpc("reconcile_real_execution_segments", {
    p_segment_id: input.segmentId,
    p_planning_item_id: input.planningItemId ?? null,
    p_activity_group_id: input.activityGroupId,
    p_segments: input.segments,
    p_operational_header_values: input.operationalHeaderValues ?? [],
    p_actor_user_id: input.actorUserId ?? null,
    p_actor_email: input.actorEmail ?? null,
    p_created_by: input.createdBy,
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data : []) as PlanningSegmentReadRow[];
}
