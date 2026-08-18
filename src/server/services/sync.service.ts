import "server-only";

import type { PlanningItemDto } from "@/modules/planning/contracts/planning-items";
import type { SyncChange } from "@/modules/sync/sync-contracts";
import {
  findProcessedSyncMutation,
  insertProcessedSyncMutation,
  insertSyncChanges,
  listSyncChanges,
} from "@/server/repositories/sync.repository";

const PLANNING_DOMAIN = "planning";
const DEFAULT_PULL_LIMIT = 200;
const MAX_PULL_LIMIT = 500;

type PlanningMutationMethod = "POST" | "PATCH" | "DELETE";

function toPlanningOperation(method: PlanningMutationMethod) {
  if (method === "POST") {
    return "create";
  }

  if (method === "PATCH") {
    return "update";
  }

  return "delete";
}

function toPlanningEntityType(item: Pick<PlanningItemDto, "tracking_type">) {
  return item.tracking_type === "real" ? "activity_execution_segment" : "planning_item";
}

function isPlanningItemDto(value: unknown): value is PlanningItemDto {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "tracking_type" in value &&
      "item_date" in value
  );
}

function uniquePlanningItemsFromResponse(response: unknown) {
  const items: PlanningItemDto[] = [];
  const seen = new Set<string>();
  const responseObject = response && typeof response === "object" ? response as { item?: unknown; items?: unknown } : {};
  const candidates = [
    ...(Array.isArray(responseObject.items) ? responseObject.items : []),
    responseObject.item,
  ];

  for (const candidate of candidates) {
    if (!isPlanningItemDto(candidate)) {
      continue;
    }

    const key = `${candidate.tracking_type}:${candidate.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push(candidate);
    }
  }

  return items;
}

export async function findProcessedPlanningMutation(mutationId: string) {
  const normalizedId = mutationId.trim();

  if (!normalizedId) {
    return null;
  }

  return findProcessedSyncMutation({
    mutationId: normalizedId,
    domain: PLANNING_DOMAIN,
    scopeUserId: null,
  });
}

export async function registerPlanningMutationSync(input: {
  mutationId?: string | null;
  method: PlanningMutationMethod;
  actorUserId?: string | null;
  response: unknown;
  deleted?: {
    id: number;
    trackingType: "programado" | "real";
    itemDate?: string | null;
    updatedAt?: string | null;
  } | null;
}) {
  const mutationId = input.mutationId?.trim() || null;
  const changes = [];
  const responseItems = uniquePlanningItemsFromResponse(input.response);

  if (input.method === "DELETE") {
    const deleted = input.deleted;
    if (deleted) {
      changes.push({
        scope_user_id: null,
        domain: PLANNING_DOMAIN,
        entity_type: deleted.trackingType === "real" ? "activity_execution_segment" : "planning_item",
        entity_id: String(deleted.id),
        operation: "delete" as const,
        server_revision: deleted.updatedAt ?? null,
        payload: {
          id: deleted.id,
          tracking_type: deleted.trackingType,
          item_date: deleted.itemDate ?? null,
        },
        mutation_id: mutationId,
        actor_user_id: input.actorUserId ?? null,
      });
    }
  } else {
    for (const item of responseItems) {
      changes.push({
        scope_user_id: null,
        domain: PLANNING_DOMAIN,
        entity_type: toPlanningEntityType(item),
        entity_id: String(item.id),
        operation: "upsert" as const,
        server_revision: item.updated_at ?? null,
        payload: { item },
        mutation_id: mutationId,
        actor_user_id: input.actorUserId ?? null,
      });
    }
  }

  const insertedChanges = await insertSyncChanges(changes);
  const primaryItem = responseItems[0];
  const primaryDeleted = input.deleted;

  if (mutationId) {
    await insertProcessedSyncMutation({
      mutation_id: mutationId,
      scope_user_id: null,
      domain: PLANNING_DOMAIN,
      operation: toPlanningOperation(input.method),
      entity_type: primaryItem
        ? toPlanningEntityType(primaryItem)
        : primaryDeleted
          ? primaryDeleted.trackingType === "real" ? "activity_execution_segment" : "planning_item"
          : null,
      entity_id: primaryItem
        ? String(primaryItem.id)
        : primaryDeleted
          ? String(primaryDeleted.id)
          : null,
      server_revision: primaryItem?.updated_at ?? primaryDeleted?.updatedAt ?? null,
      response: input.response,
      actor_user_id: input.actorUserId ?? null,
    });
  }

  return insertedChanges;
}

export async function pullPlanningSyncChanges(input: {
  cursor: number;
  limit?: number;
  scopeUserId?: string | null;
}) {
  const safeCursor = Number.isFinite(input.cursor) && input.cursor > 0 ? Math.floor(input.cursor) : 0;
  const safeLimit = Math.min(
    MAX_PULL_LIMIT,
    Math.max(1, Number.isFinite(input.limit) ? Math.floor(input.limit ?? DEFAULT_PULL_LIMIT) : DEFAULT_PULL_LIMIT)
  );
  const rows = await listSyncChanges({
    cursor: safeCursor,
    limit: safeLimit,
    scopeUserId: input.scopeUserId ?? null,
    domain: PLANNING_DOMAIN,
  });
  const hasMore = rows.length > safeLimit;
  const changes: SyncChange[] = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = changes.at(-1)?.sequenceId ?? safeCursor;

  return {
    changes,
    nextCursor,
    hasMore,
  };
}
