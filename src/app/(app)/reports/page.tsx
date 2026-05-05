"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";

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

type ReportBreakdown = {
  label: string;
  count: number;
  hours: number;
};

type ReportResponse = {
  rows: ReportRow[];
  summary: {
    total_records: number;
    planned_records: number;
    real_records: number;
    interference_records: number;
    planned_hours: number;
    real_hours: number;
    variance_hours: number;
  };
  breakdowns: {
    by_level: ReportBreakdown[];
    by_shift: ReportBreakdown[];
    by_category: ReportBreakdown[];
    by_tracking_type: ReportBreakdown[];
  };
};

type CatalogLevel = {
  id: number;
  label: string;
};

type CatalogCategory = {
  slug: "actividad" | "interferencia";
  label: string;
  types: Array<{
    id: number;
    label: string;
  }>;
};

type CatalogResponse = {
  categories: CatalogCategory[];
  levels: CatalogLevel[];
};

type ReportFilters = {
  date_from: string;
  date_to: string;
  shift: string;
  level: string;
  front: string;
  category: string;
  tracking_type: string;
  item_type: string;
};

function toLocalDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialFilters(): ReportFilters {
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

function formatHours(hours: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(hours);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function toDisplayCategory(category: ReportRow["category"]) {
  return category === "interferencia" ? "Interferencia" : "Actividad";
}

function toTrackingLabel(trackingType: ReportRow["tracking_type"]) {
  return trackingType === "programado" ? "Programado" : "Real";
}

function escapeCsvValue(value: unknown) {
  const rawValue = String(value ?? "");
  return `"${rawValue.replace(/"/g, '""')}"`;
}

function downloadFilteredRows(rows: ReportRow[], filters: ReportFilters) {
  const headers = [
    "Fecha",
    "Vista",
    "Turno",
    "Nivel",
    "Frente",
    "Categoria",
    "Tipo",
    "Detalle",
    "Hora inicio",
    "Hora termino",
    "Horas",
    "Notas",
  ];
  const csvRows = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) =>
      [
        row.item_date,
        toTrackingLabel(row.tracking_type),
        row.shift,
        row.level,
        row.front,
        toDisplayCategory(row.category),
        row.item_type,
        row.description,
        row.start_time,
        row.end_time,
        formatHours(row.duration_minutes / 60),
        row.notes ?? "",
      ]
        .map(escapeCsvValue)
        .join(";")
    ),
  ];
  const blob = new Blob([`\uFEFF${csvRows.join("\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateFrom = filters.date_from || "inicio";
  const dateTo = filters.date_to || "fin";

  link.href = url;
  link.download = `reporte-operacional-${dateFrom}-${dateTo}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildQuery(filters: ReportFilters) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export default function ReportsPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>(() => getInitialFilters());
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse>({ categories: [], levels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const itemTypes = useMemo(() => {
    const values = new Set<string>();

    for (const category of catalog.categories) {
      for (const type of category.types) {
        values.add(type.label);
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [catalog.categories]);

  const visibleRows = report?.rows ?? [];

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    let active = true;

    async function loadCatalog() {
      const response = await fetch("/api/planning-catalog", {
        cache: "no-store",
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo cargar el catalogo."));
      }

      if (active) {
        setCatalog({
          categories: Array.isArray(json.categories) ? json.categories : [],
          levels: Array.isArray(json.levels) ? json.levels : [],
        });
      }
    }

    void loadCatalog().catch((catalogError: unknown) => {
      if (active) {
        setError(catalogError instanceof Error ? catalogError.message : "No se pudo cargar el catalogo.");
      }
    });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    let active = true;

    async function loadReport() {
      setLoading(true);
      setError("");

      const response = await fetch(`/api/reports?${buildQuery(filters)}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo cargar el reporte."));
      }

      if (active) {
        setReport(json as ReportResponse);
      }
    }

    void loadReport()
      .catch((reportError: unknown) => {
        if (active) {
          setError(reportError instanceof Error ? reportError.message : "No se pudo cargar el reporte.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [filters, session?.access_token]);

  function updateFilter(key: keyof ReportFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(getInitialFilters());
  }

  const summary = report?.summary ?? {
    total_records: 0,
    planned_records: 0,
    real_records: 0,
    interference_records: 0,
    planned_hours: 0,
    real_hours: 0,
    variance_hours: 0,
  };

  return (
    <div className="reports-stack">
      <section className="surface-card hero padded reports-hero">
        <div>
          <p className="eyebrow">Reportabilidad</p>
          <h2 className="section-title">Resumen operacional</h2>
          <p className="body-copy">
            Vista filtrable de programacion, ejecucion real e interferencias registradas en la plataforma.
          </p>
        </div>
      </section>

      <section className="surface-card padded reports-filter-panel">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Filtros</p>
            <h3 className="card-title">Campos disponibles</h3>
          </div>
          <button type="button" className="button" onClick={resetFilters}>
            Limpiar
          </button>
        </div>

        <div className="reports-filter-grid">
          <label className="field">
            Desde
            <input
              className="field-input"
              type="date"
              value={filters.date_from}
              onChange={(event) => updateFilter("date_from", event.target.value)}
            />
          </label>

          <label className="field">
            Hasta
            <input
              className="field-input"
              type="date"
              value={filters.date_to}
              onChange={(event) => updateFilter("date_to", event.target.value)}
            />
          </label>

          <label className="field">
            Turno
            <select
              className="field-input"
              value={filters.shift}
              onChange={(event) => updateFilter("shift", event.target.value)}
            >
              <option value="">Todos</option>
              <option value="Dia">Dia</option>
              <option value="Noche">Noche</option>
            </select>
          </label>

          <label className="field">
            Nivel
            <select
              className="field-input"
              value={filters.level}
              onChange={(event) => updateFilter("level", event.target.value)}
            >
              <option value="">Todos</option>
              {catalog.levels.map((level) => (
                <option key={level.id} value={level.label}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Frente
            <input
              className="field-input"
              value={filters.front}
              onChange={(event) => updateFilter("front", event.target.value)}
              placeholder="Buscar frente"
            />
          </label>

          <label className="field">
            Categoria
            <select
              className="field-input"
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="">Todas</option>
              <option value="actividad">Actividad</option>
              <option value="interferencia">Interferencia</option>
            </select>
          </label>

          <label className="field">
            Vista
            <select
              className="field-input"
              value={filters.tracking_type}
              onChange={(event) => updateFilter("tracking_type", event.target.value)}
            >
              <option value="">Todas</option>
              <option value="programado">Programado</option>
              <option value="real">Real</option>
            </select>
          </label>

          <label className="field">
            Tipo
            <select
              className="field-input"
              value={filters.item_type}
              onChange={(event) => updateFilter("item_type", event.target.value)}
            >
              <option value="">Todos</option>
              {itemTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <p className="feedback">{error}</p> : null}

      <section className="metric-grid reports-metrics">
        <article className="metric-card">
          <p className="metric-label">Registros</p>
          <p className="metric-value">{summary.total_records}</p>
          <p className="metric-detail">
            {summary.planned_records} programados / {summary.real_records} reales
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Horas programadas</p>
          <p className="metric-value">{formatHours(summary.planned_hours)}</p>
          <p className="metric-detail">Suma de duracion programada</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Horas reales</p>
          <p className="metric-value">{formatHours(summary.real_hours)}</p>
          <p className="metric-detail">Suma de ejecucion e interferencias</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Diferencia</p>
          <p className="metric-value">{formatHours(summary.variance_hours)}</p>
          <p className="metric-detail">{summary.interference_records} interferencias filtradas</p>
        </article>
      </section>

      <section className="reports-content-grid">
        <article className="surface-card padded reports-breakdowns">
          <div className="reports-section-header">
            <div>
              <p className="eyebrow">Distribucion</p>
              <h3 className="card-title">Horas por nivel</h3>
            </div>
          </div>
          <div className="reports-breakdown-list">
            {(report?.breakdowns.by_level ?? []).map((entry) => (
              <div key={entry.label} className="reports-breakdown-row">
                <strong>{entry.label || "Sin nivel"}</strong>
                <span>{entry.count} registros</span>
                <span>{formatHours(entry.hours)} h</span>
              </div>
            ))}
            {!loading && !(report?.breakdowns.by_level ?? []).length ? (
              <p className="body-copy">Sin datos para los filtros seleccionados.</p>
            ) : null}
          </div>
        </article>

        <article className="surface-card padded reports-table-card">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Detalle</p>
            <h3 className="card-title">{loading ? "Cargando registros" : `${visibleRows.length} registros`}</h3>
          </div>
          <button
            type="button"
            className="button primary"
            disabled={loading || !visibleRows.length}
            onClick={() => downloadFilteredRows(visibleRows, filters)}
          >
            Exportar Excel
          </button>
        </div>

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vista</th>
                  <th>Turno</th>
                  <th>Nivel</th>
                  <th>Frente</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Horario</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.source_table}-${row.id}`}>
                    <td>{formatDate(row.item_date)}</td>
                    <td>{toTrackingLabel(row.tracking_type)}</td>
                    <td>{row.shift}</td>
                    <td>{row.level}</td>
                    <td>{row.front}</td>
                    <td>{toDisplayCategory(row.category)}</td>
                    <td>{row.item_type}</td>
                    <td>{row.description}</td>
                    <td>
                      {row.start_time} - {row.end_time}
                    </td>
                    <td>{formatHours(row.duration_minutes / 60)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && !visibleRows.length ? (
            <div className="empty-state reports-empty-state">
              <p className="body-copy">No hay registros para los filtros seleccionados.</p>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
