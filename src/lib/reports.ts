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

export const emptyReportSummary: ReportSummary = {
  total_records: 0,
  planned_records: 0,
  real_records: 0,
  interference_records: 0,
  planned_hours: 0,
  real_hours: 0,
  variance_hours: 0,
};

export function toLocalDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getInitialReportFilters(): ReportFilters {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateTo.getDate() - 6);

  return {
    date_from: toLocalDateIso(dateFrom),
    date_to: toLocalDateIso(dateTo),
    shift: "",
    level: "",
    front: "",
    category: "",
    tracking_type: "",
    item_type: "",
  };
}

export function formatHours(hours: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(hours);
}

export function formatReportDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function toDisplayCategory(category: ReportRow["category"]) {
  return category === "interferencia" ? "Interferencia" : "Actividad";
}

export function toTrackingLabel(trackingType: ReportRow["tracking_type"]) {
  return trackingType === "programado" ? "Programado" : "Real";
}

export function buildReportQuery(filters: ReportFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}
