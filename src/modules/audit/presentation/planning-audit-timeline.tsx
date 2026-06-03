"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { fetchAuditEvents } from "@/modules/audit/application/audit-events.client";
import type { AuditEventDto } from "@/modules/audit/contracts/audit";
import {
  formatAuditDate,
  formatJsonPreview,
  getAuditActionLabel,
  getAuditMetadataSummary,
} from "@/modules/audit/presentation/audit-events-display";
import { isBrowserOffline } from "@/lib/networkStatus";

type PlanningAuditTimelineProps = {
  planningItemId: number;
  accessToken?: string | null;
  enabled: boolean;
};

function JsonPreview({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="planning-audit-json">
      <span>{label}</span>
      <pre>{formatJsonPreview(value)}</pre>
    </div>
  );
}

export function PlanningAuditTimeline({ planningItemId, accessToken, enabled }: PlanningAuditTimelineProps) {
  const [events, setEvents] = useState<AuditEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!enabled || !accessToken || planningItemId <= 0) {
      setEvents([]);
      setError("");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    if (isBrowserOffline()) {
      setEvents([]);
      setError("Historial disponible solo online.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");

    void fetchAuditEvents({
      accessToken,
      query: {
        entity_type: "planning_item",
        entity_id: String(planningItemId),
        limit: 12,
      },
    })
      .then((response) => {
        if (!active) {
          return;
        }

        setEvents(response.events);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [accessToken, enabled, planningItemId]);

  if (!enabled) {
    return null;
  }

  return (
    <section className="detail-content-section planning-audit-section">
      <div className="detail-section-title">
        <History aria-hidden="true" />
        <p className="eyebrow">Historial</p>
      </div>

      {loading ? <p className="feedback">Cargando historial...</p> : null}
      {error ? <p className="feedback">{error}</p> : null}

      {!loading && !error && !events.length ? (
        <div className="empty-state reports-empty-state">
          <p className="body-copy">No hay eventos de auditoría para este programado.</p>
        </div>
      ) : null}

      {events.length ? (
        <ol className="planning-audit-timeline">
          {events.map((event) => {
            const metadataSummary = getAuditMetadataSummary(event);

            return (
              <li key={event.id} className="planning-audit-item">
                <div className="planning-audit-dot" aria-hidden="true" />
                <div className="planning-audit-content">
                  <p className="planning-audit-meta">
                    {formatAuditDate(event.created_at)} · {event.user.email ?? event.user.id ?? "Sin usuario"}
                  </p>
                  <p className="planning-audit-summary">{getAuditActionLabel(event)}</p>
                  {metadataSummary ? <p className="planning-audit-subsummary">{metadataSummary}</p> : null}
                  <details className="planning-audit-details">
                    <summary>
                      Ver detalle
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <JsonPreview label="Acción técnica" value={event.action} />
                    <JsonPreview label="Antes" value={event.before} />
                    <JsonPreview label="Después" value={event.after} />
                    <JsonPreview label="Detalles del evento" value={event.metadata} />
                  </details>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
