import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";
import type { SyncChange, SyncChangeOperation } from "@/modules/sync/sync-contracts";

export type SyncChangeInsert = {
  scope_user_id?: string | null;
  domain: string;
  entity_type: string;
  entity_id: string;
  operation: SyncChangeOperation;
  server_revision?: string | null;
  payload: Record<string, unknown>;
  mutation_id?: string | null;
  actor_user_id?: string | null;
};

export type ProcessedSyncMutationInsert = {
  mutation_id: string;
  scope_user_id?: string | null;
  domain: string;
  operation: string;
  entity_type?: string | null;
  entity_id?: string | null;
  server_revision?: string | null;
  response: unknown;
  actor_user_id?: string | null;
};

type SyncChangeRow = {
  sequence_id: number;
  scope_user_id: string | null;
  domain: "planning";
  entity_type: "planning_item" | "activity_execution_segment" | "planning_assignment";
  entity_id: string;
  operation: SyncChangeOperation;
  server_revision: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
  mutation_id: string | null;
};

export type ProcessedSyncMutationRow = {
  mutation_id: string;
  scope_user_id: string | null;
  domain: string;
  operation: string;
  entity_type: string | null;
  entity_id: string | null;
  server_revision: string | null;
  response: unknown;
  processed_at: string;
};

function mapSyncChange(row: SyncChangeRow): SyncChange {
  return {
    sequenceId: Number(row.sequence_id),
    scopeUserId: row.scope_user_id,
    domain: row.domain,
    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,
    serverRevision: row.server_revision,
    occurredAt: row.occurred_at,
    payload: row.payload ?? {},
    mutationId: row.mutation_id,
  };
}

export async function insertSyncChanges(changes: SyncChangeInsert[]) {
  if (!changes.length) {
    return [];
  }

  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("sync_changes")
    .insert(changes)
    .select("sequence_id, scope_user_id, domain, entity_type, entity_id, operation, server_revision, occurred_at, payload, mutation_id")
    .order("sequence_id", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SyncChangeRow[]).map(mapSyncChange);
}

export async function listSyncChanges(input: {
  cursor: number;
  limit: number;
  scopeUserId?: string | null;
  domain?: string;
}) {
  const db = getSupabaseServerClient();
  let query = db
    .from("sync_changes")
    .select("sequence_id, scope_user_id, domain, entity_type, entity_id, operation, server_revision, occurred_at, payload, mutation_id")
    .gt("sequence_id", input.cursor)
    .order("sequence_id", { ascending: true })
    .limit(input.limit + 1);

  if (input.domain) {
    query = query.eq("domain", input.domain);
  }

  if (input.scopeUserId) {
    query = query.or(`scope_user_id.is.null,scope_user_id.eq.${input.scopeUserId}`);
  } else {
    query = query.is("scope_user_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as SyncChangeRow[]).map(mapSyncChange);
}

export async function findProcessedSyncMutation(input: {
  mutationId: string;
  domain: string;
  scopeUserId?: string | null;
}) {
  const db = getSupabaseServerClient();
  let query = db
    .from("sync_processed_mutations")
    .select("mutation_id, scope_user_id, domain, operation, entity_type, entity_id, server_revision, response, processed_at")
    .eq("mutation_id", input.mutationId)
    .eq("domain", input.domain);

  query = input.scopeUserId
    ? query.eq("scope_user_id", input.scopeUserId)
    : query.is("scope_user_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProcessedSyncMutationRow | null;
}

export async function findSyncChangeByMutationEntity(input: {
  mutationId: string;
  domain: string;
  entityType: string;
  entityId: string;
  operation: SyncChangeOperation;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("sync_changes")
    .select("sequence_id, scope_user_id, domain, entity_type, entity_id, operation, server_revision, occurred_at, payload, mutation_id")
    .eq("mutation_id", input.mutationId)
    .eq("domain", input.domain)
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("operation", input.operation)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSyncChange(data as SyncChangeRow) : null;
}

export async function insertProcessedSyncMutation(input: ProcessedSyncMutationInsert) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("sync_processed_mutations")
    .insert(input)
    .select("mutation_id, scope_user_id, domain, operation, entity_type, entity_id, server_revision, response, processed_at")
    .single();

  if (error) {
    throw error;
  }

  return data as ProcessedSyncMutationRow;
}
