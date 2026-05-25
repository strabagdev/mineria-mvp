export type ReportRow = {
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

export type ReportBreakdown = {
  label: string;
  count: number;
  hours: number;
};

export type ReportSummary = {
  total_records: number;
  planned_records: number;
  real_records: number;
  interference_records: number;
  planned_hours: number;
  real_hours: number;
  variance_hours: number;
};

export type ReportResponse = {
  rows: ReportRow[];
  summary: ReportSummary;
  breakdowns: {
    by_level: ReportBreakdown[];
    by_shift: ReportBreakdown[];
    by_category: ReportBreakdown[];
    by_tracking_type: ReportBreakdown[];
  };
};

export type ReportFilters = {
  date_from: string;
  date_to: string;
  shift: string;
  level: string;
  front: string;
  category: string;
  tracking_type: string;
  item_type: string;
};
