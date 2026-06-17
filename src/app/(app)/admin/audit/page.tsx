"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Eye, RotateCcw, Search, X } from "lucide-react";
import type { AuditEventDto, AuditEventsQueryDto } from "@/modules/audit/contracts/audit";
import { fetchAuditEvents } from "@/modules/audit/application/audit-events.client";
import {
  formatAuditDate,
  formatJsonPreview,
  getAuditEventSummary,
} from "@/modules/audit/presentation/audit-events-display";
import { useAuth } from "@/providers/auth-provider";

type AuditFilterForm = {
  from: string;
  to: string;
  shift: string;
  level: string;
  front: string;
  itemType: string;
  trackingType: string;
};

const emptyFilters: AuditFilterForm = {
  from: "",
  to: "",
  shift: "",
  level: "",
  front: "",
  itemType: "",
  trackingType: "",
};

const pageLimit = 50;

function cleanFilter(value: string) {
  return value.trim() || undefined;
}

function buildAuditQuery(filters: AuditFilterForm, cursor?: string | null): AuditEventsQueryDto {
  return {
    from: cleanFilter(filters.from),
    to: cleanFilter(filters.to),
    limit: pageLimit,
    cursor: cursor ?? undefined,
  };
}

type AuditInterferenceRow = {
  key: string;
  event: AuditEventDto;
  itemDate: string;
  shift: string;
  level: string;
  front: string;
  trackingType: "programado" | "real";
  itemType: string;
  description: string;
  startTime: string;
  endTime: string;
  duration: string;
  notes: string;
  createdBy: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toText(value: unknown) {
  return String(value ?? "").trim();
}

function toTime(value: unknown) {
  return toText(value).slice(0, 5);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatDuration(startTime: string, endTime: string) {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);

  if (start === null || end === null) {
    return "";
  }

  if (end <= start) {
    end += 24 * 60;
  }

  const totalMinutes = end - start;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function getAuditSnapshots(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return isRecord(value) ? [value] : [];
}

function getInterferenceRowsFromEvent(event: AuditEventDto): AuditInterferenceRow[] {
  const snapshots = getAuditSnapshots(event.after).length
    ? getAuditSnapshots(event.after)
    : getAuditSnapshots(event.before);
  const inferredTrackingType = event.entity.type === "activity_execution_segment" ? "real" : "programado";

  return snapshots
    .filter((snapshot) => toText(snapshot.category) === "interferencia")
    .map((snapshot, index) => {
      const startTime = toTime(snapshot.start_time);
      const endTime = toTime(snapshot.end_time);
      const trackingType = toText(snapshot.tracking_type) === "real" ? "real" : inferredTrackingType;

      return {
        key: `${event.id}-${toText(snapshot.id) || index}`,
        event,
        itemDate: toText(snapshot.item_date),
        shift: toText(snapshot.shift),
        level: toText(snapshot.level),
        front: toText(snapshot.front),
        trackingType,
        itemType: toText(snapshot.item_type),
        description: toText(snapshot.description),
        startTime,
        endTime,
        duration: formatDuration(startTime, endTime),
        notes: toText(snapshot.notes),
        createdBy: event.user.email ?? event.user.id ?? "Sin usuario",
        createdAt: event.created_at,
      };
    });
}

function matchesInterferenceFilters(row: AuditInterferenceRow, filters: AuditFilterForm) {
  return (
    (!filters.shift || row.shift === filters.shift) &&
    (!filters.level || row.level.toLowerCase().includes(filters.level.toLowerCase())) &&
    (!filters.front || row.front.toLowerCase().includes(filters.front.toLowerCase())) &&
    (!filters.itemType || row.itemType.toLowerCase().includes(filters.itemType.toLowerCase())) &&
    (!filters.trackingType || row.trackingType === filters.trackingType)
  );
}

function trackingTypeLabel(value: AuditInterferenceRow["trackingType"]) {
  return value === "programado" ? "Programado" : "Real";
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <section className="audit-json-block">
      <h4>{label}</h4>
      <pre>{formatJsonPreview(value)}</pre>
    </section>
  );
}

export default function AdminAuditPage() {
  const router = useRouter();
  const { loading, session, profile } = useAuth();
  const [filters, setFilters] = React.useState<AuditFilterForm>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = React.useState<AuditFilterForm>(emptyFilters);
  const [events, setEvents] = React.useState<AuditEventDto[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<AuditEventDto | null>(null);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const canAdmin = profile?.role === "admin";
  const interferenceRows = React.useMemo(
    () => events.flatMap(getInterferenceRowsFromEvent),
    [events]
  );
  const visibleInterferenceRows = React.useMemo(
    () => interferenceRows.filter((row) => matchesInterferenceFilters(row, appliedFilters)),
    [appliedFilters, interferenceRows]
  );

  const loadEvents = React.useCallback(async (input: { append?: boolean; cursor?: string | null; filters: AuditFilterForm }) => {
    if (!session?.access_token) {
      setMessage("Necesitas iniciar sesion.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const response = await fetchAuditEvents({
        accessToken: session.access_token,
        query: buildAuditQuery(input.filters, input.cursor),
      });

      setEvents((current) => input.append ? [...current, ...response.events] : response.events);
      setNextCursor(response.next_cursor);
      setSelectedEvent((current) => {
        if (input.append) {
          return current;
        }

        return null;
      });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar auditoria.");
    } finally {
      setBusy(false);
    }
  }, [session?.access_token]);

  React.useEffect(() => {
    if (loading) {
      return;
    }

    if (!session && !profile) {
      router.replace("/login");
      return;
    }

    if (!canAdmin) {
      router.replace("/");
      return;
    }

    void loadEvents({ filters: appliedFilters });
  }, [appliedFilters, canAdmin, loadEvents, loading, profile, router, session]);

  function applyFilters(event: React.FormEvent) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  }

  return (
    <div className="dashboard-stack audit-page">
      <section className="surface-card padded audit-filters-card">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Auditoría</p>
            <h2 className="section-title">Interferencias</h2>
          </div>
          <span className="session-pill">Solo admin</span>
        </div>

        <form className="audit-filters" onSubmit={applyFilters}>
          <label className="field">
            Fecha desde
            <input
              className="field-input"
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label className="field">
            Fecha hasta
            <input
              className="field-input"
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
          <label className="field">
            Turno
            <select
              className="field-input"
              value={filters.shift}
              onChange={(event) => setFilters((current) => ({ ...current, shift: event.target.value }))}
            >
              <option value="">Todos</option>
              <option value="Dia">Dia</option>
              <option value="Noche">Noche</option>
            </select>
          </label>
          <label className="field">
            Nivel
            <input
              className="field-input"
              value={filters.level}
              onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value }))}
              placeholder="NTI"
            />
          </label>
          <label className="field">
            Frente
            <input
              className="field-input"
              value={filters.front}
              onChange={(event) => setFilters((current) => ({ ...current, front: event.target.value }))}
              placeholder="GT1"
            />
          </label>
          <label className="field">
            Tipo
            <input
              className="field-input"
              value={filters.itemType}
              onChange={(event) => setFilters((current) => ({ ...current, itemType: event.target.value }))}
              placeholder="operacional"
            />
          </label>
          <label className="field">
            Vista
            <select
              className="field-input"
              value={filters.trackingType}
              onChange={(event) => setFilters((current) => ({ ...current, trackingType: event.target.value }))}
            >
              <option value="">Todas</option>
              <option value="programado">Programado</option>
              <option value="real">Real</option>
            </select>
          </label>

          <div className="toolbar-actions audit-filter-actions">
            <button type="submit" className="button primary" disabled={busy}>
              <Search aria-hidden />
              Aplicar
            </button>
            <button type="button" className="button" disabled={busy} onClick={clearFilters}>
              <RotateCcw aria-hidden />
              Limpiar
            </button>
          </div>
        </form>
      </section>

      {message ? <p className="feedback">{message}</p> : null}

      <section className="audit-layout">
        <article className="surface-card padded reports-table-card audit-table-card">
          <div className="reports-section-header">
            <div>
              <p className="eyebrow">Tabla principal</p>
              <h3 className="card-title">{visibleInterferenceRows.length} interferencias</h3>
            </div>
          </div>

          <div className="reports-table-wrap audit-table-wrap">
            <table className="reports-table audit-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Nivel</th>
                  <th>Frente</th>
                  <th>Vista</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Inicio</th>
                  <th>Término</th>
                  <th>Duración</th>
                  <th>Notas</th>
                  <th>Usuario</th>
                  <th>Creación</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibleInterferenceRows.map((row) => {
                  return (
                    <tr key={row.key}>
                      <td>{row.itemDate || "Sin fecha"}</td>
                      <td>{row.shift || "-"}</td>
                      <td>{row.level || "-"}</td>
                      <td>{row.front || "-"}</td>
                      <td><span className={`session-pill audit-tracking-${row.trackingType}`}>{trackingTypeLabel(row.trackingType)}</span></td>
                      <td>{row.itemType || "-"}</td>
                      <td>{row.description || "-"}</td>
                      <td>{row.startTime || "-"}</td>
                      <td>{row.endTime || "-"}</td>
                      <td>{row.duration || "-"}</td>
                      <td>{row.notes || "-"}</td>
                      <td>{row.createdBy}</td>
                      <td>{formatAuditDate(row.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="button icon-button small"
                          aria-label={`Ver detalle de auditoria ${row.event.id}`}
                          title="Ver detalle"
                          onClick={() => setSelectedEvent(row.event)}
                        >
                          <Eye aria-hidden />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!events.length && !busy ? (
            <div className="empty-state reports-empty-state">
              <p className="body-copy">No hay eventos de auditoria para el rango seleccionado.</p>
            </div>
          ) : null}
          {events.length && !visibleInterferenceRows.length && !busy ? (
            <div className="empty-state reports-empty-state">
              <p className="body-copy">No hay interferencias para los filtros seleccionados.</p>
            </div>
          ) : null}

          <div className="audit-pagination">
            <button
              type="button"
              className="button"
              disabled={busy || !nextCursor}
              onClick={() => void loadEvents({ append: true, cursor: nextCursor, filters: appliedFilters })}
            >
              {nextCursor ? "Cargar más" : "No hay más registros"}
            </button>
          </div>
        </article>
      </section>

      {selectedEvent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}>
          <section
            className="modal-card detail-modal-card audit-detail-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Detalle de auditoría</p>
                <h2 id="audit-detail-title" className="card-title" style={{ marginTop: 12 }}>
                  Evento #{selectedEvent.id}
                </h2>
              </div>
              <button
                type="button"
                className="button icon-button"
                aria-label="Cerrar detalle"
                onClick={() => setSelectedEvent(null)}
              >
                <X aria-hidden />
              </button>
            </div>

            <div className="audit-detail-stack">
              <div className="audit-detail-meta">
                <span className="session-pill">{formatAuditDate(selectedEvent.created_at)}</span>
                <span className="session-pill">{selectedEvent.entity.type}</span>
                <span className="session-pill">{selectedEvent.user.email ?? "Sin usuario"}</span>
              </div>
              <p className="body-copy">{getAuditEventSummary(selectedEvent)}</p>
              <JsonBlock label="Acción técnica" value={selectedEvent.action} />
              <JsonBlock label="Antes" value={selectedEvent.before} />
              <JsonBlock label="Después" value={selectedEvent.after} />
              <JsonBlock label="Detalles del evento" value={selectedEvent.metadata} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
