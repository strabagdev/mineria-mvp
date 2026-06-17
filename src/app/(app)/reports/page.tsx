"use client";

import { BarChart3, Download, Eye, FileSpreadsheet, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PlanningDetailDialog } from "@/components/planning/planning-detail-dialog";
import { useAuth } from "@/providers/auth-provider";
import { NETWORK_ERROR_MESSAGE, isBrowserOffline, subscribeNetworkStatus } from "@/lib/networkStatus";
import {
  canUseOfflineSnapshot,
  markSnapshotRefreshSucceeded,
  readCatalogSnapshot,
  readReportSnapshot,
  saveCatalogSnapshot,
  saveReportSnapshot,
  toNetworkMessage,
  type ReportsCatalog,
} from "@/lib/reportsOfflineSnapshot";
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
import { getAssignmentTypeIcon } from "@/modules/planning-assignments/presentation/planning-assignment-type-icons";
import {
  buildReportXlsxWorkbook,
  getReportXlsxFilename,
} from "@/modules/reporting/presentation/reporting-xlsx-export";

type CatalogResponse = ReportsCatalog;
type ReportBreakdownItem = ReportResponse["breakdowns"][keyof ReportResponse["breakdowns"]][number];
type ReportAssignmentRow = NonNullable<ReportResponse["assignment_rows"]>[number];
type ReportCustomFieldColumn = NonNullable<ReportResponse["custom_field_columns"]>[number];
type ReportAssignmentTypeSummary = {
  assignment_type_id: number;
  assignment_type_label: string;
  assignment_type_icon_key: ReportAssignmentRow["assignment_type_icon_key"];
  count: number;
};
type ReportDetailItem = {
  tracking_type: ReportRow["tracking_type"];
  category: ReportRow["category"];
  item_type: string;
  item_date: string;
  shift: string;
  start: string;
  end: string;
  level: string;
  front: string;
  notes?: string | null;
};
type ReportAssignmentTargetKind = ReportAssignmentRow["target_kind"];

function escapeCsvValue(value: unknown) {
  const rawValue = String(value ?? "");
  return `"${rawValue.replace(/"/g, '""')}"`;
}

function buildUniqueCsvHeaders(headers: string[]) {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count > 0 ? `${header} (${count + 1})` : header;
  });
}

function getCustomFieldCsvHeaders(columns: ReportCustomFieldColumn[]) {
  const coreHeaders = new Set([
    "ID",
    "Fuente",
    "Grupo actividad",
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
  ]);
  const seenCustomLabels = new Map<string, number>();

  return columns.map((column) => {
    const count = seenCustomLabels.get(column.label) ?? 0;
    seenCustomLabels.set(column.label, count + 1);
    return coreHeaders.has(column.label) || count > 0 ? `${column.label} (${column.slug})` : column.label;
  });
}

function downloadFilteredRows(rows: ReportRow[], filters: ReportFilters, customFieldColumns: ReportCustomFieldColumn[]) {
  const coreHeaders = [
    "ID",
    "Fuente",
    "Grupo actividad",
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
  const headers = buildUniqueCsvHeaders([
    ...coreHeaders,
    ...getCustomFieldCsvHeaders(customFieldColumns),
  ]);
  const csvRows = [
    headers.map(escapeCsvValue).join(";"),
    ...rows.map((row) =>
      [
        row.id,
        row.source_table,
        row.activity_group_id,
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
        ...customFieldColumns.map((column) => row.custom_fields?.[column.slug]?.value ?? ""),
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

async function downloadReportWorkbook(report: ReportResponse, filters: ReportFilters) {
  const xlsx = await import("xlsx");
  const workbook = buildReportXlsxWorkbook(xlsx, report);

  xlsx.writeFile(workbook, getReportXlsxFilename(filters));
}

function BreakdownList({ title, rows }: { title: string; rows: ReportBreakdownItem[] }) {
  const visibleRows = rows.slice(0, 8);

  return (
    <div className="reports-breakdown-group">
      <h3>{title}</h3>

      {visibleRows.length ? (
        <div className="reports-breakdown-list">
          {visibleRows.map((row) => (
            <div key={row.label || "sin-valor"} className="reports-breakdown-chip">
              <strong>{row.label || "Sin valor"}</strong>
              <span>{row.count}</span>
              <span>{formatHours(row.hours)} h</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="reports-breakdown-empty">Sin datos</p>
      )}
    </div>
  );
}

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function getReportDetailDurationMinutes(startTime: string, endTime: string) {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);

  if (end <= start) {
    end += 24 * 60;
  }

  return Math.max(0, end - start);
}

function formatReportDetailDuration(startTime: string, endTime: string) {
  return `${formatHours(getReportDetailDurationMinutes(startTime, endTime) / 60)} h`;
}

function mapReportRowToPlanningDetailItem(row: ReportRow): ReportDetailItem {
  return {
    tracking_type: row.tracking_type,
    category: row.category,
    item_type: row.item_type,
    item_date: row.item_date,
    shift: row.shift,
    start: row.start_time,
    end: row.end_time,
    level: row.level,
    front: row.front,
    notes: row.notes,
  };
}

function getReportAssignmentTypeSummaries(assignmentRows: ReportAssignmentRow[]) {
  const summariesByType = new Map<number, ReportAssignmentTypeSummary>();

  for (const assignment of assignmentRows) {
    const current = summariesByType.get(assignment.assignment_type_id);
    summariesByType.set(assignment.assignment_type_id, {
      assignment_type_id: assignment.assignment_type_id,
      assignment_type_label: assignment.assignment_type_label,
      assignment_type_icon_key: assignment.assignment_type_icon_key,
      count: (current?.count ?? 0) + 1,
    });
  }

  return Array.from(summariesByType.values()).sort((left, right) =>
    left.assignment_type_label.localeCompare(right.assignment_type_label)
  );
}

function getReportRowAssignmentTarget(row: Pick<ReportRow, "id" | "source_table">) {
  return row.source_table === "planning_items"
    ? { target_kind: "planning_item" as const, target_id: row.id }
    : { target_kind: "execution_segment" as const, target_id: row.id };
}

function getReportAssignmentTargetKey(targetKind: ReportAssignmentTargetKind, targetId: number) {
  return `${targetKind}:${targetId}`;
}

function getReportAssignmentSectionTitle(row: Pick<ReportRow, "tracking_type" | "category">) {
  if (row.tracking_type === "programado") {
    return "Asignaciones planificadas";
  }

  return row.category === "interferencia" ? "Recursos involucrados" : "Asignaciones reales";
}

function ReportCustomFieldsSummary({ row }: { row: ReportRow }) {
  const values = Object.values(row.custom_fields ?? {})
    .filter((value) => value.value)
    .sort((left, right) => left.label.localeCompare(right.label));

  if (!values.length) {
    return null;
  }

  return (
    <section className="custom-fields-detail-section">
      <p className="eyebrow">Datos adicionales</p>
      <div className="custom-fields-detail-grid">
        {values.map((field) => (
          <article key={field.field_id} className="custom-field-detail-card">
            <div className="detail-highlight-label">
              <p className="detail-label">{field.label}</p>
            </div>
            <p className="detail-highlight-value">{field.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReportAssignmentsSummary({ assignments, title }: { assignments: ReportAssignmentRow[]; title: string }) {
  if (!assignments.length) {
    return (
      <section className="detail-content-section assignments-detail-section">
        <p className="eyebrow">{title}</p>
        <p className="assignment-detail-status">Sin asignaciones vinculadas.</p>
      </section>
    );
  }

  return (
    <section className="detail-content-section assignments-detail-section">
      <p className="eyebrow">{title}</p>
      <div className="assignments-detail-grid">
        {assignments.map((assignment) => {
          const TypeIcon = getAssignmentTypeIcon(
            assignment.assignment_type_icon_key as Parameters<typeof getAssignmentTypeIcon>[0]
          );
          const valueSummary = assignment.values
            .map((value) => value.value)
            .filter(Boolean)
            .join(" · ");

          return (
            <article className="assignment-detail-card" key={assignment.assignment_id}>
              <span className="assignment-detail-icon">
                <TypeIcon aria-hidden="true" />
              </span>
              <div className="assignment-detail-copy">
                <p className="assignment-detail-label">
                  {assignment.assignment_type_label} · Instancia {assignment.instance_order}
                </p>
                <p className="assignment-detail-value">{valueSummary || "Sin valores"}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReportAssignmentSummaryCell({
  summaries,
}: {
  summaries: ReportAssignmentTypeSummary[];
}) {
  if (!summaries.length) {
    return <span className="reports-assignment-muted">-</span>;
  }

  return (
    <div className="reports-assignment-summary-icons" aria-label="Asignaciones vinculadas">
      {summaries.map((summary) => {
        const TypeIcon = getAssignmentTypeIcon(
          summary.assignment_type_icon_key as Parameters<typeof getAssignmentTypeIcon>[0]
        );
        const tooltip = `${summary.assignment_type_label}: ${summary.count} ${
          summary.count === 1 ? "asignada" : "asignadas"
        }`;

        return (
          <span
            key={summary.assignment_type_id}
            className="reports-assignment-summary-icon gantt-tooltip-custom-field assignment"
            data-tooltip={tooltip}
            title={tooltip}
            aria-label={tooltip}
          >
            <TypeIcon aria-hidden="true" />
            <span aria-hidden="true">×{summary.count}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const { session } = useAuth();
  const [filters, setFilters] = useState<ReportFilters>(() => getInitialReportFilters());
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse>({ categories: [], levels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offlineUpdatedAt, setOfflineUpdatedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedReportRow, setSelectedReportRow] = useState<ReportRow | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    function refreshWhenOnline() {
      if (!isBrowserOffline()) {
        setRefreshNonce((current) => current + 1);
      }
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(refreshWhenOnline);

    return () => {
      unsubscribeNetworkStatus();
    };
  }, []);

  const itemTypes = useMemo(() => {
    const values = new Set<string>();

    for (const category of catalog.categories) {
      for (const type of category.types) {
        values.add(type.label);
      }
    }

    return Array.from(values).sort((left, right) => left.localeCompare(right));
  }, [catalog.categories]);

  const reportRows = report?.rows;
  const visibleRows = useMemo(() => reportRows ?? [], [reportRows]);
  const customFieldColumns = report?.custom_field_columns ?? [];
  const reportAssignmentRows = report?.assignment_rows;
  const assignmentRows = useMemo(() => reportAssignmentRows ?? [], [reportAssignmentRows]);
  const breakdowns = report?.breakdowns;
  const assignmentSummariesByTarget = useMemo(() => {
    const rowsByTarget = new Map<string, ReportAssignmentRow[]>();

    for (const assignment of assignmentRows) {
      const targetKey = getReportAssignmentTargetKey(assignment.target_kind, assignment.target_id);
      rowsByTarget.set(targetKey, [
        ...(rowsByTarget.get(targetKey) ?? []),
        assignment,
      ]);
    }

    return new Map(
      Array.from(rowsByTarget.entries()).map(([targetKey, rows]) => [
        targetKey,
        getReportAssignmentTypeSummaries(rows),
      ])
    );
  }, [assignmentRows]);
  const assignmentRowsByTarget = useMemo(() => {
    const rowsByTarget = new Map<string, ReportAssignmentRow[]>();

    for (const assignment of assignmentRows) {
      const targetKey = getReportAssignmentTargetKey(assignment.target_kind, assignment.target_id);
      rowsByTarget.set(targetKey, [
        ...(rowsByTarget.get(targetKey) ?? []),
        assignment,
      ]);
    }

    return rowsByTarget;
  }, [assignmentRows]);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      const cachedCatalog = await readCatalogSnapshot();
      if (cachedCatalog?.value) {
        setCatalog(cachedCatalog.value);
        setOfflineUpdatedAt(cachedCatalog.updatedAt);
      }

      if (canUseOfflineSnapshot()) {
        if (cachedCatalog?.value) {
          return;
        }
        throw new Error(NETWORK_ERROR_MESSAGE);
      }

      if (!session?.access_token) {
        return;
      }

      const response = await fetch("/api/planning-catalog", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo cargar el catalogo."));
      }

      if (active) {
        const nextCatalog = {
          categories: Array.isArray(json.categories) ? json.categories : [],
          levels: Array.isArray(json.levels) ? json.levels : [],
        };
        setCatalog(nextCatalog);
        setOfflineUpdatedAt(null);
        markSnapshotRefreshSucceeded();
        void saveCatalogSnapshot(nextCatalog);
      }
    }

    void loadCatalog().catch((catalogError: unknown) => {
      if (active) {
        if (toNetworkMessage(catalogError) || canUseOfflineSnapshot()) {
          void readCatalogSnapshot()
            .then((cachedCatalog) => {
              if (!active) {
                return;
              }
              if (cachedCatalog?.value) {
                setCatalog(cachedCatalog.value);
                setOfflineUpdatedAt(cachedCatalog.updatedAt);
                return;
              }
              setError(NETWORK_ERROR_MESSAGE);
            })
            .catch(() => {
              if (active) {
                setError(NETWORK_ERROR_MESSAGE);
              }
            });
          return;
        }
        const networkMessage = toNetworkMessage(catalogError);
        if (networkMessage) {
          setError(networkMessage);
          return;
        }
        setError("No se pudo cargar el catalogo.");
      }
    });

    return () => {
      active = false;
    };
  }, [refreshNonce, session?.access_token]);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);
      setError("");
      const cachedReport = await readReportSnapshot(filters);
      if (cachedReport?.value) {
        setReport(cachedReport.value);
        setOfflineUpdatedAt(cachedReport.updatedAt);
      }

      if (canUseOfflineSnapshot()) {
        if (cachedReport?.value) {
          setError("Mostrando ultimo reporte disponible en modo offline.");
          return;
        }
        throw new Error(NETWORK_ERROR_MESSAGE);
      }

      if (!session?.access_token) {
        setError(NETWORK_ERROR_MESSAGE);
        return;
      }

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
        const nextReport = json as ReportResponse;
        setReport(nextReport);
        setOfflineUpdatedAt(null);
        markSnapshotRefreshSucceeded();
        void saveReportSnapshot(filters, nextReport);
      }
    }

    void loadReport()
      .catch((reportError: unknown) => {
        if (active) {
          if (toNetworkMessage(reportError) || canUseOfflineSnapshot()) {
            void readReportSnapshot(filters)
              .then((cachedReport) => {
                if (!active) {
                  return;
                }
                if (cachedReport?.value) {
                  setReport(cachedReport.value);
                  setOfflineUpdatedAt(cachedReport.updatedAt);
                  setError("Mostrando ultimo reporte disponible en modo offline.");
                  return;
                }
                setError(NETWORK_ERROR_MESSAGE);
              })
              .catch(() => {
                if (active) {
                  setError(NETWORK_ERROR_MESSAGE);
                }
              });
            return;
          }
          const networkMessage = toNetworkMessage(reportError);
          if (networkMessage) {
            setError(networkMessage);
            return;
          }
          setError("No se pudo cargar el reporte.");
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
  }, [filters, refreshNonce, session?.access_token]);

  function updateFilter(key: keyof ReportFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters(getInitialReportFilters());
  }

  async function handleDownloadExcel() {
    if (!report || exportingExcel) {
      return;
    }

    setExportingExcel(true);
    setError("");
    try {
      await downloadReportWorkbook(report, filters);
    } catch {
      setError("No se pudo exportar el archivo Excel.");
    } finally {
      setExportingExcel(false);
    }
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
      {offlineUpdatedAt ? (
        <p className="feedback">
          Datos offline. Ultima sincronizacion: {new Date(offlineUpdatedAt).toLocaleString("es-CL")}
        </p>
      ) : null}

      <section className="reports-breakdown-grid">
        <BreakdownList title="Por turno" rows={breakdowns?.by_shift ?? []} />
        <BreakdownList title="Por nivel" rows={breakdowns?.by_level ?? []} />
        <BreakdownList title="Por frente" rows={breakdowns?.by_front ?? []} />
        <BreakdownList title="Por categoría" rows={breakdowns?.by_category ?? []} />
        <BreakdownList title="Por tipo" rows={breakdowns?.by_item_type ?? []} />
      </section>

      <section className="reports-content-grid">
        <article className="surface-card padded reports-table-card">
          <div className="reports-section-header">
            <div>
              <p className="eyebrow">Detalle</p>
              <h3 className="card-title">{loading ? "Cargando registros" : `${visibleRows.length} registros`}</h3>
            </div>
            <div className="reports-export-actions">
              <button
                type="button"
                className="button"
                disabled={loading || !visibleRows.length}
                onClick={() => downloadFilteredRows(visibleRows, filters, customFieldColumns)}
              >
                <Download aria-hidden className="button-icon" />
                Exportar CSV
              </button>
              <button
                type="button"
                className="button primary"
                disabled={loading || !report || exportingExcel}
                onClick={() => void handleDownloadExcel()}
              >
                <FileSpreadsheet aria-hidden className="button-icon" />
                {exportingExcel ? "Exportando..." : "Exportar Excel"}
              </button>
            </div>
          </div>

          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Horas</th>
                  <th>Vista</th>
                  <th>Turno</th>
                  <th>Nivel</th>
                  <th>Frente</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Notas</th>
                  {customFieldColumns.map((column) => (
                    <th key={column.id}>{column.label}</th>
                  ))}
                  <th>Asignaciones</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const assignmentTarget = getReportRowAssignmentTarget(row);
                  const assignmentTargetKey = getReportAssignmentTargetKey(
                    assignmentTarget.target_kind,
                    assignmentTarget.target_id
                  );

                  return (
                    <tr key={`${row.source_table}-${row.id}`}>
                      <td>{formatReportDate(row.item_date)}</td>
                      <td>
                        {row.start_time} - {row.end_time}
                      </td>
                      <td>{formatHours(row.duration_minutes / 60)}</td>
                      <td>{toTrackingLabel(row.tracking_type)}</td>
                      <td>{row.shift}</td>
                      <td>{row.level}</td>
                      <td>{row.front}</td>
                      <td>{toDisplayCategory(row.category)}</td>
                      <td>{row.item_type}</td>
                      <td>{row.description}</td>
                      <td>{row.notes ?? ""}</td>
                      {customFieldColumns.map((column) => (
                        <td key={column.id}>{row.custom_fields?.[column.slug]?.value ?? ""}</td>
                      ))}
                      <td>
                        <ReportAssignmentSummaryCell
                          summaries={assignmentSummariesByTarget.get(assignmentTargetKey) ?? []}
                        />
                      </td>
                      <td className="reports-action-cell">
                        <button
                          type="button"
                          className="button icon-button small reports-detail-button"
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${row.description}`}
                          onClick={() => setSelectedReportRow(row)}
                        >
                          <Eye aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
      {selectedReportRow ? (
        <PlanningDetailDialog
          item={mapReportRowToPlanningDetailItem(selectedReportRow)}
          title={selectedReportRow.description}
          continuation={null}
          readOnly={true}
          formatDateLabel={formatReportDate}
          formatDuration={formatReportDetailDuration}
          toDisplayCategory={toDisplayCategory}
          toTrackingTypeLabel={toTrackingLabel}
          customFieldsSlot={<ReportCustomFieldsSummary row={selectedReportRow} />}
          assignmentsSlot={(() => {
            const assignmentTarget = getReportRowAssignmentTarget(selectedReportRow);
            const assignmentTargetKey = getReportAssignmentTargetKey(
              assignmentTarget.target_kind,
              assignmentTarget.target_id
            );

            return (
              <ReportAssignmentsSummary
                assignments={assignmentRowsByTarget.get(assignmentTargetKey) ?? []}
                title={getReportAssignmentSectionTitle(selectedReportRow)}
              />
            );
          })()}
          historySlot={null}
          onClose={() => setSelectedReportRow(null)}
          onEdit={() => undefined}
        />
      ) : null}
    </div>
  );
}
