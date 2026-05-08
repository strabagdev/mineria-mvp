"use client";

import { BarChart3, Clock3, Gauge, ListChecks, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  buildReportQuery,
  emptyReportSummary,
  formatHours,
  formatReportDate,
  getInitialReportFilters,
  type ReportResponse,
} from "@/lib/reports";

export default function DashboardPage() {
  const { session } = useAuth();
  const filters = useMemo(() => getInitialReportFilters(), []);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const summary = report?.summary ?? emptyReportSummary;

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    let active = true;

    async function loadDashboard() {
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
        throw new Error(String(json.error ?? "No se pudo cargar el dashboard."));
      }

      if (active) {
        setReport(json as ReportResponse);
      }
    }

    void loadDashboard()
      .catch((dashboardError: unknown) => {
        if (active) {
          setError(dashboardError instanceof Error ? dashboardError.message : "No se pudo cargar el dashboard.");
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

  return (
    <div className="reports-stack">
      <section className="surface-card hero padded reports-hero">
        <div className="reports-hero-copy">
          <span className="reports-hero-icon" aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2 className="section-title">Resumen operacional</h2>
            <p className="body-copy">
              Indicadores consolidados del periodo {formatReportDate(filters.date_from)} al{" "}
              {formatReportDate(filters.date_to)}.
            </p>
          </div>
        </div>
      </section>

      {error ? <p className="feedback">{error}</p> : null}

      <section className="metric-grid reports-metrics" aria-busy={loading}>
        <article className="metric-card reports-metric-card">
          <span className="metric-icon" aria-hidden="true"><ListChecks /></span>
          <p className="metric-label">Registros</p>
          <p className="metric-value">{summary.total_records}</p>
          <p className="metric-detail">
            {summary.planned_records} programados / {summary.real_records} reales
          </p>
        </article>
        <article className="metric-card reports-metric-card">
          <span className="metric-icon" aria-hidden="true"><Clock3 /></span>
          <p className="metric-label">Horas programadas</p>
          <p className="metric-value">{formatHours(summary.planned_hours)}</p>
          <p className="metric-detail">Suma de duracion programada</p>
        </article>
        <article className="metric-card reports-metric-card">
          <span className="metric-icon" aria-hidden="true"><TimerReset /></span>
          <p className="metric-label">Horas reales</p>
          <p className="metric-value">{formatHours(summary.real_hours)}</p>
          <p className="metric-detail">Suma de ejecucion e interferencias</p>
        </article>
        <article className="metric-card reports-metric-card">
          <span className="metric-icon" aria-hidden="true"><Gauge /></span>
          <p className="metric-label">Diferencia</p>
          <p className="metric-value">{formatHours(summary.variance_hours)}</p>
          <p className="metric-detail">{summary.interference_records} interferencias filtradas</p>
        </article>
      </section>
    </div>
  );
}
