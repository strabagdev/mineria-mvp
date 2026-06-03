"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Eye, History, RotateCcw, Search, ShieldCheck } from "lucide-react";
import type { AuditEventDto, AuditEventsQueryDto } from "@/modules/audit/contracts/audit";
import { fetchAuditEvents } from "@/modules/audit/application/audit-events.client";
import {
  formatAuditDate,
  formatAuditEntity,
  formatJsonPreview,
  getAuditActionLabel,
  getAuditEventSummary,
  getAuditMetadataSummary,
} from "@/modules/audit/presentation/audit-events-display";
import { useAuth } from "@/providers/auth-provider";

type AuditFilterForm = {
  from: string;
  to: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
};

const emptyFilters: AuditFilterForm = {
  from: "",
  to: "",
  action: "",
  entityType: "",
  entityId: "",
  userId: "",
};

const pageLimit = 50;

function cleanFilter(value: string) {
  return value.trim() || undefined;
}

function buildAuditQuery(filters: AuditFilterForm, cursor?: string | null): AuditEventsQueryDto {
  return {
    from: cleanFilter(filters.from),
    to: cleanFilter(filters.to),
    action: cleanFilter(filters.action),
    entity_type: cleanFilter(filters.entityType),
    entity_id: cleanFilter(filters.entityId),
    user_id: cleanFilter(filters.userId),
    limit: pageLimit,
    cursor: cursor ?? undefined,
  };
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

        return response.events[0] ?? null;
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
      <section className="surface-card hero padded audit-hero">
        <div className="reports-hero-copy">
          <span className="reports-hero-icon" aria-hidden="true">
            <ShieldCheck />
          </span>
          <div>
            <p className="eyebrow">Administracion</p>
            <h2 className="section-title">Auditoría</h2>
            <p className="body-copy">Historial de cambios y acciones del sistema</p>
          </div>
        </div>
      </section>

      <section className="surface-card padded audit-filters-card">
        <div className="reports-section-header">
          <div>
            <p className="eyebrow">Filtros</p>
            <h3 className="card-title">Busqueda global</h3>
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
            Accion
            <input
              className="field-input"
              value={filters.action}
              onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
              placeholder="planning_item.updated"
            />
          </label>
          <label className="field">
            Tipo de entidad
            <input
              className="field-input"
              value={filters.entityType}
              onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
              placeholder="planning_item"
            />
          </label>
          <label className="field">
            ID de entidad
            <input
              className="field-input"
              value={filters.entityId}
              onChange={(event) => setFilters((current) => ({ ...current, entityId: event.target.value }))}
              placeholder="36"
            />
          </label>
          <label className="field">
            Usuario
            <input
              className="field-input"
              value={filters.userId}
              onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
              placeholder="user_id"
            />
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
              <p className="eyebrow">Eventos</p>
              <h3 className="card-title">{events.length} registros cargados</h3>
            </div>
            <span className="reports-hero-icon" aria-hidden="true">
              <History />
            </span>
          </div>

          <div className="reports-table-wrap audit-table-wrap">
            <table className="reports-table audit-table">
              <thead>
                <tr>
                  <th>Fecha/hora</th>
                  <th>Usuario</th>
                  <th>Accion</th>
                  <th>Entidad</th>
                  <th>Resumen</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const isSelected = selectedEvent?.id === event.id;
                  const metadataSummary = getAuditMetadataSummary(event);

                  return (
                    <tr key={event.id} className={isSelected ? "selected" : undefined}>
                      <td>{formatAuditDate(event.created_at)}</td>
                      <td>{event.user.email ?? event.user.id ?? "Sin usuario"}</td>
                      <td>{getAuditActionLabel(event)}</td>
                      <td>{formatAuditEntity(event.entity)}</td>
                      <td>{metadataSummary ?? "Sin detalles adicionales"}</td>
                      <td>
                        <button
                          type="button"
                          className="button icon-button small"
                          aria-label={`Ver detalle de auditoria ${event.id}`}
                          title="Ver detalle"
                          onClick={() => setSelectedEvent(event)}
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
              <p className="body-copy">No hay eventos de auditoria para los filtros seleccionados.</p>
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

        <aside className="surface-card padded audit-detail-card" aria-label="Detalle de evento de auditoria">
          <div className="reports-section-header">
            <div>
              <p className="eyebrow">Detalle</p>
              <h3 className="card-title">{selectedEvent ? `Evento #${selectedEvent.id}` : "Sin seleccion"}</h3>
            </div>
          </div>

          {selectedEvent ? (
            <div className="audit-detail-stack">
              <div className="audit-detail-meta">
                <span className="session-pill">{formatAuditDate(selectedEvent.created_at)}</span>
                <span className="session-pill">{formatAuditEntity(selectedEvent.entity)}</span>
                <span className="session-pill">{selectedEvent.user.email ?? "Sin usuario"}</span>
              </div>
              <p className="body-copy">{getAuditEventSummary(selectedEvent)}</p>
              <JsonBlock label="Acción técnica" value={selectedEvent.action} />
              <JsonBlock label="Antes" value={selectedEvent.before} />
              <JsonBlock label="Después" value={selectedEvent.after} />
              <JsonBlock label="Detalles del evento" value={selectedEvent.metadata} />
            </div>
          ) : (
            <div className="empty-state reports-empty-state">
              <p className="body-copy">Selecciona un evento para ver antes, después y detalles del evento.</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
