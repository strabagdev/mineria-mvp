"use client";

import { BarChart3, Download, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  buildReportQuery,
  formatHours,
  formatReportDate,
  getInitialReportFilters,
  toDisplayCategory,
  toTrackingLabel,
  type ReportFilters,
  type ReportResponse,
  type ReportRow,
} from "@/lib/reports";

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

export default function ReportsPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>(() => getInitialReportFilters());
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

      const response = await fetch(`/api/reports?${buildReportQuery(filters)}`, {
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
    setFilters(getInitialReportFilters());
  }

  return (
    <div className="reports-stack">
      <section className="surface-card hero padded reports-hero">
        <div className="reports-hero-copy">
          <span className="reports-hero-icon" aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <p className="eyebrow">Reportabilidad</p>
            <h2 className="section-title">Resumen operacional</h2>
            <p className="body-copy">
              Vista filtrable de programacion, ejecucion real e interferencias registradas en la plataforma.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-card padded reports-filter-panel">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Filtros</p>
            <h3 className="card-title">Campos disponibles</h3>
          </div>
          <button type="button" className="button" onClick={resetFilters}>
            <Filter aria-hidden className="button-icon" />
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
            <Download aria-hidden className="button-icon" />
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
                    <td>{formatReportDate(row.item_date)}</td>
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
