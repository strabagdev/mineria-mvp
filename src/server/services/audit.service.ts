import "server-only";

import type {
  AuditEventDto,
  AuditEventsQueryDto,
  AuditEventsResponseDto,
} from "@/modules/audit/contracts/audit";
import {
  listAuditLogs,
  type AuditLogRow,
} from "@/server/repositories/audit.repository";

const DEFAULT_AUDIT_EVENTS_LIMIT = 50;
const MAX_AUDIT_EVENTS_LIMIT = 100;

function cleanString(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeDate(value?: string) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return undefined;
  }

  const date = new Date(cleaned);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Filtro de fecha invalido.");
  }

  return date.toISOString();
}

function normalizeLimit(value?: number) {
  const limit = Number(value ?? DEFAULT_AUDIT_EVENTS_LIMIT);

  if (!Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_AUDIT_EVENTS_LIMIT;
  }

  return Math.min(Math.trunc(limit), MAX_AUDIT_EVENTS_LIMIT);
}

function normalizeCursor(value?: string) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return undefined;
  }

  const cursorId = Number(cleaned);

  if (!Number.isFinite(cursorId) || cursorId <= 0) {
    throw new Error("Cursor de auditoria invalido.");
  }

  return Math.trunc(cursorId);
}

function mapAuditLogRow(row: AuditLogRow): AuditEventDto {
  return {
    id: row.id,
    created_at: row.created_at,
    user: {
      id: row.actor_user_id,
      email: row.actor_email,
    },
    action: row.action,
    entity: {
      type: row.entity_type,
      id: row.entity_id,
    },
    before: row.before_data,
    after: row.after_data,
    metadata: row.metadata,
  };
}

export async function listAuditEvents(
  query: AuditEventsQueryDto
): Promise<AuditEventsResponseDto> {
  const limit = normalizeLimit(query.limit);
  const rows = await listAuditLogs({
    from: normalizeDate(query.from),
    to: normalizeDate(query.to),
    action: cleanString(query.action),
    entityType: cleanString(query.entity_type),
    entityId: cleanString(query.entity_id),
    userId: cleanString(query.user_id),
    cursorId: normalizeCursor(query.cursor),
    limit: limit + 1,
  });
  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const events = pageRows.map(mapAuditLogRow);

  return {
    events,
    next_cursor: hasNextPage ? String(pageRows.at(-1)?.id) : null,
  };
}
