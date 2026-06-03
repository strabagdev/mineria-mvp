import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type AuditLogRowInput = {
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  metadata: Record<string, unknown> | null;
};

export type AuditLogRow = {
  id: number;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogListFilters = {
  from?: string;
  to?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  limit: number;
  cursorId?: number;
};

const auditLogSelect =
  "id, actor_user_id, actor_email, action, entity_type, entity_id, before_data, after_data, metadata, created_at";

export async function insertAuditLog(input: AuditLogRowInput) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("audit_logs").insert(input);

  return { error };
}

export async function listAuditLogs(filters: AuditLogListFilters) {
  const db = getSupabaseServerClient();
  let query = db
    .from("audit_logs")
    .select(auditLogSelect)
    .order("id", { ascending: false })
    .limit(filters.limit);

  if (filters.cursorId) {
    query = query.lt("id", filters.cursorId);
  }

  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }

  if (filters.to) {
    query = query.lte("created_at", filters.to);
  }

  if (filters.action) {
    query = query.eq("action", filters.action);
  }

  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }

  if (filters.entityId) {
    query = query.eq("entity_id", filters.entityId);
  }

  if (filters.userId) {
    query = query.eq("actor_user_id", filters.userId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as AuditLogRow[];
}
