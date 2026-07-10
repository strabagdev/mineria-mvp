"use client";

import { BarChart3, Clock3, Gauge, ListChecks, ScrollText, Settings, TimerReset, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readAdminUsersSnapshot, readReportSnapshot, type AdminUsersSnapshot } from "@/lib/reportsOfflineSnapshot";
import { toRoleLabel } from "@/modules/auth/presentation/role-labels";
import {
  emptyReportSummary,
  formatHours,
  formatReportDate,
  getInitialReportFilters,
  toDisplayCategory,
  toTrackingLabel,
  type ReportResponse,
} from "@/lib/reports";

type OfflineRouteContentProps = {
  view: "home" | "dashboard" | "reports" | "users" | "catalog" | "audit";
};

function OfflineNotice({ updatedAt }: { updatedAt: string | null }) {
  if (!updatedAt) {
    return <p className="feedback">Sin conexion. No hay datos locales guardados para esta vista.</p>;
  }

  return (
    <p className="feedback">
      Datos offline. Ultima sincronizacion: {new Date(updatedAt).toLocaleString("es-CL")}
    </p>
  );
}

function OfflineDashboard() {
  const filters = useMemo(() => getInitialReportFilters(), []);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const summary = report?.summary ?? emptyReportSummary;

  useEffect(() => {
    let active = true;

    void readReportSnapshot(filters).then((snapshot) => {
      if (!active) {
        return;
      }

      setReport(snapshot?.value ?? null);
      setUpdatedAt(snapshot?.updatedAt ?? null);
    });

    return () => {
      active = false;
    };
  }, [filters]);

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
              Indicadores locales del periodo {formatReportDate(filters.date_from)} al{" "}
              {formatReportDate(filters.date_to)}.
            </p>
          </div>
        </div>
      </section>

      <OfflineNotice updatedAt={updatedAt} />

      <section className="metric-grid reports-metrics">
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

function OfflineReports() {
  const filters = useMemo(() => getInitialReportFilters(), []);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const rows = report?.rows ?? [];
  const operationalHeaderColumns = report?.operational_header_columns ?? [];

  useEffect(() => {
    let active = true;

    void readReportSnapshot(filters).then((snapshot) => {
      if (!active) {
        return;
      }

      setReport(snapshot?.value ?? null);
      setUpdatedAt(snapshot?.updatedAt ?? null);
    });

    return () => {
      active = false;
    };
  }, [filters]);

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
            <p className="body-copy">Vista local de programacion, ejecucion real e interferencias registradas.</p>
          </div>
        </div>
      </section>

      <OfflineNotice updatedAt={updatedAt} />

      <section className="surface-card padded reports-table-card">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Detalle</p>
            <h3 className="card-title">{rows.length} registros</h3>
          </div>
        </div>

        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Vista</th>
                <th>Turno</th>
                {operationalHeaderColumns.map((column) => (
                  <th key={column.id}>{column.label}</th>
                ))}
                <th>Categoria</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Horario</th>
                <th>Horas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.source_table}-${row.id}`}>
                  <td>{formatReportDate(row.item_date)}</td>
                  <td>{toTrackingLabel(row.tracking_type)}</td>
                  <td>{row.shift}</td>
                  {operationalHeaderColumns.map((column) => (
                    <td key={column.id}>{row.operational_header_values?.[column.slug]?.value ?? ""}</td>
                  ))}
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

        {!rows.length ? (
          <div className="empty-state reports-empty-state">
            <p className="body-copy">No hay registros locales para mostrar.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function OfflineUsers() {
  const [users, setUsers] = useState<AdminUsersSnapshot>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void readAdminUsersSnapshot().then((snapshot) => {
      if (!active) {
        return;
      }

      setUsers(snapshot?.value ?? []);
      setUpdatedAt(snapshot?.updatedAt ?? null);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dashboard-stack">
      <section className="surface-card hero padded">
        <p className="eyebrow">Administracion</p>
        <h2 className="section-title">Usuarios y permisos</h2>
        <p className="body-copy">Listado local de usuarios guardado para consulta sin conexion.</p>
      </section>

      <section className="surface-card padded">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Solicitudes</p>
            <h3 className="section-title">Usuarios del sistema</h3>
          </div>
          <span className="reports-hero-icon" aria-hidden="true">
            <Users />
          </span>
        </div>

        <OfflineNotice updatedAt={updatedAt} />

        <div className="admin-user-list">
          {users.map((account) => (
            <div key={account.user_id} className="admin-user-card">
              <div className="admin-user-heading">
                <div>
                  <strong>{account.full_name || account.email}</strong>
                  <p className="muted-inline">{account.email}</p>
                </div>
                <div className="admin-user-badges">
                  <span className="session-pill">{toRoleLabel(account.role)}</span>
                  <span className="session-pill">{account.active ? "Activo" : "Inactivo"}</span>
                  <span className="session-pill">{account.approval_status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!users.length ? (
          <div className="empty-state reports-empty-state">
            <p className="body-copy">No hay usuarios locales para mostrar.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function OfflineCatalog() {
  return (
    <div className="dashboard-stack">
      <section className="surface-card hero padded">
        <div className="reports-hero-copy">
          <span className="reports-hero-icon" aria-hidden="true">
            <Settings />
          </span>
          <div>
            <p className="eyebrow">Disponible solo online</p>
            <h2 className="section-title">Catalogo operacional</h2>
            <p className="body-copy">
              La administracion del catalogo requiere conexion al servidor. Las configuraciones no se editan en modo offline.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function OfflineAudit() {
  return (
    <div className="dashboard-stack">
      <section className="surface-card hero padded">
        <div className="reports-hero-copy">
          <span className="reports-hero-icon" aria-hidden="true">
            <ScrollText />
          </span>
          <div>
            <p className="eyebrow">Disponible solo online</p>
            <h2 className="section-title">Auditoría</h2>
            <p className="body-copy">
              La consulta de auditoría requiere conexión al servidor. No se muestran eventos locales en modo offline.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function OfflineRouteContent({ view }: OfflineRouteContentProps) {
  if (view === "home") {
    return (
      <div className="dashboard-stack">
        <section className="surface-card hero padded">
          <p className="eyebrow">Operaciones offline</p>
          <h2 className="section-title">Planificacion local</h2>
          <p className="body-copy">
            La vista de operaciones mantiene sus datos locales cuando ya estas en Operaciones. Para conservar la URL alineada,
            vuelve a esta seccion con conexion disponible.
          </p>
        </section>
      </div>
    );
  }

  if (view === "dashboard") {
    return <OfflineDashboard />;
  }

  if (view === "reports") {
    return <OfflineReports />;
  }

  if (view === "users") {
    return <OfflineUsers />;
  }

  if (view === "catalog") {
    return <OfflineCatalog />;
  }

  if (view === "audit") {
    return <OfflineAudit />;
  }
}
