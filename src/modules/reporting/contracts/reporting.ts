export type ReportCustomFieldColumn = {
  id: number;
  slug: string;
  label: string;
  input_type: "text" | "number" | "boolean" | "date" | "select" | "multi_select";
  active: boolean;
};

export type ReportCustomFieldValue = {
  field_id: number;
  slug: string;
  label: string;
  value: string;
  raw_value: string | number | boolean | string[] | null;
};

export type ReportAssignmentRow = {
  planning_item_id: number;
  assignment_id: number;
  assignment_type_id: number;
  assignment_type_slug: string;
  assignment_type_label: string;
  assignment_type_icon_key: string | null;
  instance_order: number;
  values: Array<{
    field_id: number;
    field_slug: string;
    field_label: string;
    input_type: "text" | "number" | "date" | "boolean" | "select" | "multi_select";
    value: string;
    raw_value: string | number | boolean | string[] | null;
  }>;
};

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
  custom_fields?: Record<string, ReportCustomFieldValue>;
};

export type ReportBreakdown = {
  label: string;
  count: number;
  hours: number;
};

export type ReportSummary = {
  total_records: number;
  total_programados: number;
  total_reales: number;
  total_interferencias: number;
  horas_programadas: number;
  horas_reales: number;
  horas_interferencias: number;
  diferencia_horas_real_vs_programado: number;
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
  custom_field_columns?: ReportCustomFieldColumn[];
  assignment_rows?: ReportAssignmentRow[];
  breakdowns: {
    by_level: ReportBreakdown[];
    by_shift: ReportBreakdown[];
    by_front: ReportBreakdown[];
    by_category: ReportBreakdown[];
    by_tracking_type: ReportBreakdown[];
    by_item_type: ReportBreakdown[];
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
