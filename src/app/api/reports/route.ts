import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ReportRow = {
  id: number;
  source_table: "planning_items" | "activity_execution_segments";
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  description: string;
  notes: string | null;
  duration_minutes: number;
};

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function getDurationMinutes(startTime: string, endTime: string) {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);

  if (end <= start) {
    end += 24 * 60;
  }

  return Math.max(0, end - start);
}

function matchesOptionalFilter(value: string, filter: string) {
  return !filter || value === filter;
}

function matchesFront(value: string, filter: string) {
  return !filter || value.toLowerCase().includes(filter.toLowerCase());
}

function groupTotals(rows: ReportRow[], key: keyof Pick<ReportRow, "level" | "shift" | "category" | "tracking_type">) {
  const totals = new Map<string, { label: string; count: number; hours: number }>();

  for (const row of rows) {
    const label = String(row[key] ?? "");
    const current = totals.get(label) ?? { label, count: 0, hours: 0 };
    current.count += 1;
    current.hours += row.duration_minutes / 60;
    totals.set(label, current);
  }

  return Array.from(totals.values()).sort((left, right) => {
    if (right.hours !== left.hours) {
      return right.hours - left.hours;
    }

    return left.label.localeCompare(right.label);
  });
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("date_from")?.trim() ?? "";
    const dateTo = searchParams.get("date_to")?.trim() ?? "";
    const shift = searchParams.get("shift")?.trim() ?? "";
    const level = searchParams.get("level")?.trim() ?? "";
    const front = searchParams.get("front")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const trackingType = searchParams.get("tracking_type")?.trim() ?? "";
    const itemType = searchParams.get("item_type")?.trim() ?? "";

    const db = getSupabaseServerClient();

    let planningQuery = db
      .from("planning_items")
      .select("id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes, tracking_type")
      .eq("tracking_type", "programado")
      .order("item_date", { ascending: false })
      .order("start_time", { ascending: true });

    let realQuery = db
      .from("activity_execution_segments")
      .select("id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes")
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

    const rows: ReportRow[] = [
      ...((planningRows ?? []).map((row) => ({
        id: row.id,
        source_table: "planning_items" as const,
        activity_group_id: row.activity_group_id,
        item_date: row.item_date,
        start_time: row.start_time.slice(0, 5),
        end_time: row.end_time.slice(0, 5),
        shift: row.shift,
        level: row.level,
        front: row.front,
        category: row.category,
        tracking_type: "programado" as const,
        item_type: row.item_type,
        description: row.description,
        notes: row.notes ?? null,
        duration_minutes: getDurationMinutes(row.start_time, row.end_time),
      })) as ReportRow[]),
      ...((realRows ?? []).map((row) => ({
        id: row.id,
        source_table: "activity_execution_segments" as const,
        activity_group_id: row.activity_group_id,
        item_date: row.item_date,
        start_time: row.start_time.slice(0, 5),
        end_time: row.end_time.slice(0, 5),
        shift: row.shift,
        level: row.level,
        front: row.front,
        category: row.category,
        tracking_type: "real" as const,
        item_type: row.item_type,
        description: row.description,
        notes: row.notes ?? null,
        duration_minutes: getDurationMinutes(row.start_time, row.end_time),
      })) as ReportRow[]),
    ]
      .filter((row) => matchesOptionalFilter(row.shift, shift))
      .filter((row) => matchesOptionalFilter(row.level, level))
      .filter((row) => matchesOptionalFilter(row.category, category))
      .filter((row) => matchesOptionalFilter(row.tracking_type, trackingType))
      .filter((row) => matchesOptionalFilter(row.item_type, itemType))
      .filter((row) => matchesFront(row.front, front))
      .sort((left, right) =>
        `${right.item_date}-${right.start_time}-${right.id}`.localeCompare(
          `${left.item_date}-${left.start_time}-${left.id}`
        )
      );

    const plannedRows = rows.filter((row) => row.tracking_type === "programado");
    const realRowsFiltered = rows.filter((row) => row.tracking_type === "real");
    const plannedMinutes = plannedRows.reduce((sum, row) => sum + row.duration_minutes, 0);
    const realMinutes = realRowsFiltered.reduce((sum, row) => sum + row.duration_minutes, 0);

    return NextResponse.json({
      rows,
      summary: {
        total_records: rows.length,
        planned_records: plannedRows.length,
        real_records: realRowsFiltered.length,
        interference_records: rows.filter((row) => row.category === "interferencia").length,
        planned_hours: plannedMinutes / 60,
        real_hours: realMinutes / 60,
        variance_hours: (realMinutes - plannedMinutes) / 60,
      },
      breakdowns: {
        by_level: groupTotals(rows, "level"),
        by_shift: groupTotals(rows, "shift"),
        by_category: groupTotals(rows, "category"),
        by_tracking_type: groupTotals(rows, "tracking_type"),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
