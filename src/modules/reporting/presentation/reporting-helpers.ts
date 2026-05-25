import type { ReportFilters, ReportRow, ReportSummary } from "../contracts/reporting";

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
