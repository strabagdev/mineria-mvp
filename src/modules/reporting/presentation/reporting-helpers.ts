import type { OperationalHeaderResponseDto } from "../../operational-header/contracts/operational-header";
import type {
  ReportBreakdown,
  ReportFilters,
  ReportOperationalHeaderColumn,
  ReportRow,
  ReportSummary,
} from "../contracts/reporting";

export const emptyReportSummary: ReportSummary = {
  total_records: 0,
  total_programados: 0,
  total_reales: 0,
  total_interferencias: 0,
  horas_programadas: 0,
  horas_reales: 0,
  horas_interferencias: 0,
  diferencia_horas_real_vs_programado: 0,
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

type ReportFilterSearchParams = {
  get(name: string): string | null;
  forEach(callbackfn: (value: string, key: string) => void): void;
};

export function getInitialReportFilters(searchParams?: ReportFilterSearchParams): ReportFilters {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateTo.getDate() - 6);
  const filters: ReportFilters = {
    date_from: toLocalDateIso(dateFrom),
    date_to: toLocalDateIso(dateTo),
    shift: "",
    category: "",
    tracking_type: "",
    item_type: "",
    operational_header_filters: {},
  };

  if (!searchParams) {
    return filters;
  }

  const scalarKeys = [
    "date_from",
    "date_to",
    "shift",
    "category",
    "tracking_type",
    "item_type",
  ] as const;

  for (const key of scalarKeys) {
    filters[key] = searchParams.get(key) ?? filters[key];
  }

  searchParams.forEach((value, key) => {
    if (key.startsWith("header_")) {
      const slug = key.slice("header_".length).trim();
      if (slug) {
        filters.operational_header_filters[slug] = value;
      }
    }
  });

  return filters;
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
  const { operational_header_filters: operationalHeaderFilters, ...scalarFilters } = filters;

  for (const [key, value] of Object.entries(scalarFilters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  for (const [slug, value] of Object.entries(operationalHeaderFilters)) {
    const normalizedSlug = slug.trim();
    const normalizedValue = value.trim();
    if (normalizedSlug && normalizedValue) {
      params.set(`header_${normalizedSlug}`, normalizedValue);
    }
  }

  return params.toString();
}

export type ReportOperationalHeaderBreakdownGroup = {
  slug: string;
  title: string;
  rows: ReportBreakdown[];
};

export function getOperationalHeaderBreakdownGroups(
  config: OperationalHeaderResponseDto | null,
  columns: ReportOperationalHeaderColumn[],
  breakdowns: Record<string, ReportBreakdown[]> | undefined
): ReportOperationalHeaderBreakdownGroup[] {
  const fieldsBySlug = new Map((config?.fields ?? []).map((field) => [field.slug, field]));
  const fields = columns
    .map((column) => {
      const field = fieldsBySlug.get(column.slug);
      return {
        slug: column.slug,
        label: field?.label ?? column.label,
        sort_order: field?.sort_order ?? column.sort_order,
        groupable: field ? field.active && field.groupable : true,
      };
    })
    .filter((field) => field.groupable)
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label));

  return fields
    .map((field) => ({
      slug: field.slug,
      title: `Por ${field.label}`,
      rows: breakdowns?.[field.slug] ?? [],
    }))
    .filter((group) => group.rows.length > 0);
}
