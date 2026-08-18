import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type PlannedSyncOperation = "create" | "update" | "delete";

export class PlannedSyncRpcError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "PlannedSyncRpcError";
    this.code = code;
  }
}

export async function processPlannedItemSyncMutation(input: {
  mutationId: string;
  operation: PlannedSyncOperation;
  actorUserId: string;
  entityId?: number | null;
  expectedUpdatedAt?: string | null;
  payload: Record<string, unknown>;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db.rpc("process_planned_item_sync_mutation", {
    p_mutation_id: input.mutationId,
    p_operation: input.operation,
    p_actor_user_id: input.actorUserId,
    p_entity_id: input.entityId ?? null,
    p_expected_updated_at: input.expectedUpdatedAt ?? null,
    p_payload: input.payload,
  });

  if (error) {
    throw new PlannedSyncRpcError(error.message, error.code);
  }

  return data as unknown;
}
