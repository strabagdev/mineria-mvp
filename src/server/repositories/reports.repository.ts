import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type ReportFilters = {
  dateFrom: string;
  dateTo: string;
};

export type PlannedReportRow = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
  tracking_type: "programado";
};

export type RealReportRow = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes: string | null;
};

const plannedSelect =
  "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes, tracking_type";
const realSelect =
  "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes";

export async function listReportSourceRows({ dateFrom, dateTo }: ReportFilters) {
  const db = getSupabaseServerClient();

  let planningQuery = db
    .from("planning_items")
    .select(plannedSelect)
    .eq("tracking_type", "programado")
    .order("item_date", { ascending: false })
    .order("start_time", { ascending: true });

  let realQuery = db
    .from("activity_execution_segments")
    .select(realSelect)
    .order("item_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (dateFrom) {
    planningQuery = planningQuery.gte("item_date", dateFrom);
    realQuery = realQuery.gte("item_date", dateFrom);
  }

  if (dateTo) {
    planningQuery = planningQuery.lte("item_date", dateTo);
    realQuery = realQuery.lte("item_date", dateTo);
  }

  const [{ data: planningRows, error: planningError }, { data: realRows, error: realError }] =
    await Promise.all([planningQuery, realQuery]);

  if (planningError) {
    throw planningError;
  }

  if (realError) {
    throw realError;
  }

  return {
    planningRows: (planningRows ?? []) as PlannedReportRow[],
    realRows: (realRows ?? []) as RealReportRow[],
  };
}

