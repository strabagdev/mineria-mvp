import type { PlanningItem } from "@/modules/planning/presentation/planning-page-models";
import { recordOperationalEvent } from "../../../lib/observability/logger";
import {
  MAX_PLANNING_SYNC_ATTEMPTS,
  type PendingPlanningMutation,
  type PlanningMutationFailureReason,
} from "./planning-sync-models";

type ReplayPendingPlanningMutationsArgs = {
  mutations: PendingPlanningMutation[];
  sendMutation: (mutation: PendingPlanningMutation) => Promise<unknown>;
  replayAssignmentPayload?: (mutation: PendingPlanningMutation, response: unknown) => Promise<void>;
  getErrorMessage: (error: unknown) => string;
  classifyError: (error: unknown) => PlanningMutationFailureReason;
  loadServerConflictSnapshot?: (mutation: PendingPlanningMutation) => Promise<unknown>;
  now?: () => Date;
};

export type ReplayPendingPlanningMutationsResult = {
  nextQueue: PendingPlanningMutation[];
  syncedCount: number;
  stoppedForRetryableError: boolean;
  foundConflict: boolean;
  retryableError: unknown;
  retryableErrorMessage: string;
};

const RETRYABLE_FAILURE_REASONS = new Set<PlanningMutationFailureReason>(["network", "auth"]);

export function getNextRetryAt(attempts: number, now = new Date()) {
  const delayMs = Math.min(30 * 60_000, 2 ** Math.max(0, attempts - 1) * 30_000);
  return new Date(now.getTime() + delayMs).toISOString();
}

export function withClientMutationId(
  payload: Record<string, unknown>,
  fallbackId = crypto.randomUUID()
) {
  if (payload.client_mutation_id) {
    return payload;
  }

  return {
    ...payload,
    client_mutation_id: fallbackId,
  };
}

export function makePendingPlanningMutation(
  method: PendingPlanningMutation["method"],
  payload: Record<string, unknown>,
  input: {
    userId: string;
    scope: PendingPlanningMutation["scope"];
    assignmentPayload?: PendingPlanningMutation["assignmentPayload"];
    syncedPlanningItemId?: PendingPlanningMutation["syncedPlanningItemId"];
  }
): PendingPlanningMutation {
  const id = crypto.randomUUID();

  return {
    id,
    userId: input.userId,
    scope: input.scope,
    method,
    payload: withClientMutationId(payload, id),
    assignmentPayload: input.assignmentPayload,
    syncedPlanningItemId: input.syncedPlanningItemId,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
}

function getPendingItemId(mutation: PendingPlanningMutation) {
  const explicitId = Number(mutation.payload.id);
  if (Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }

  let hash = 0;
  for (const char of mutation.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return -Math.max(1, hash);
}

export function toOptimisticPlanningItem(mutation: PendingPlanningMutation): PlanningItem | null {
  if (mutation.status === "conflict" || mutation.status === "failed") {
    return null;
  }

  if (mutation.method === "DELETE") {
    return null;
  }

  const payload = mutation.payload;
  const itemDate = String(payload.item_date ?? "").trim();
  const startTime = String(payload.start_time ?? "").trim();
  const endTime = String(payload.end_time ?? "").trim();
  const activityGroupId = String(payload.activity_group_id ?? "").trim();
  const category = String(payload.category ?? "").trim();
  const trackingType = String(payload.tracking_type ?? "").trim();

  if (
    !itemDate ||
    !startTime ||
    !endTime ||
    !activityGroupId ||
    !["actividad", "interferencia"].includes(category) ||
    !["programado", "real"].includes(trackingType)
  ) {
    return null;
  }

  return {
    id: getPendingItemId(mutation),
    activity_group_id: activityGroupId,
    item_date: itemDate,
    start: startTime.slice(0, 5),
    end: endTime.slice(0, 5),
    shift: String(payload.shift ?? ""),
    category: category as PlanningItem["category"],
    tracking_type: trackingType as PlanningItem["tracking_type"],
    item_type: String(payload.item_type ?? ""),
    description: String(payload.description ?? ""),
    notes: payload.notes ? String(payload.notes) : null,
    sync_status: "pending",
  };
}

export function applyPendingPlanningMutations(
  items: PlanningItem[],
  mutations: PendingPlanningMutation[],
  date: string
) {
  const visibleItems = [...items];

  for (const mutation of mutations) {
    const mutationId = Number(mutation.payload.id);

    if (mutation.method === "DELETE") {
      if (Number.isFinite(mutationId)) {
        const index = visibleItems.findIndex((item) => item.id === mutationId);
        if (index !== -1) {
          visibleItems.splice(index, 1);
        }
      }
      continue;
    }

    const optimisticItem = toOptimisticPlanningItem(mutation);
    if (!optimisticItem || optimisticItem.item_date !== date) {
      continue;
    }

    const existingIndex = visibleItems.findIndex((item) => item.id === optimisticItem.id);
    if (existingIndex === -1) {
      visibleItems.push(optimisticItem);
    } else {
      visibleItems[existingIndex] = optimisticItem;
    }
  }

  return visibleItems;
}

export function getRetryablePlanningMutations(mutations: PendingPlanningMutation[]) {
  const now = Date.now();
  return mutations.filter((mutation) => {
    if (mutation.status === "conflict" || mutation.status === "failed" || mutation.status === "syncing") {
      return false;
    }

    if (!mutation.nextRetryAt) {
      return true;
    }

    return new Date(mutation.nextRetryAt).getTime() <= now;
  });
}

export function discardConflictedPlanningMutations(mutations: PendingPlanningMutation[]) {
  return mutations.filter((mutation) => mutation.status !== "conflict" && mutation.status !== "failed");
}

export async function replayPendingPlanningMutations({
  mutations,
  sendMutation,
  replayAssignmentPayload,
  getErrorMessage,
  classifyError,
  loadServerConflictSnapshot,
  now = () => new Date(),
}: ReplayPendingPlanningMutationsArgs): Promise<ReplayPendingPlanningMutationsResult> {
  const replayStartedAt = now();
  recordOperationalEvent({
    name: "sync.replay_started",
    source: "planningMutationQueue",
    metadata: {
      pendingCount: mutations.filter((mutation) => mutation.status === "pending").length,
      conflictCount: mutations.filter((mutation) => mutation.status === "conflict").length,
    },
  });

  const nextQueue: PendingPlanningMutation[] = [];
  let syncedCount = 0;
  let stoppedForRetryableError = false;
  let foundConflict = false;
  let retryableError: unknown = null;
  let retryableErrorMessage = "";

  for (let index = 0; index < mutations.length; index += 1) {
    const mutation = mutations[index];
    let replayMutation = mutation;

    if (mutation.status === "conflict" || mutation.status === "failed") {
      nextQueue.push(mutation);
      continue;
    }

    if (mutation.status === "syncing") {
      replayMutation = { ...mutation, status: "pending" };
    }

    if (replayMutation.nextRetryAt && new Date(replayMutation.nextRetryAt).getTime() > replayStartedAt.getTime()) {
      nextQueue.push(replayMutation);
      nextQueue.push(...mutations.slice(index + 1));
      break;
    }

    try {
      replayMutation = {
        ...replayMutation,
        status: "syncing",
        attempts: replayMutation.attempts + 1,
        lastAttemptAt: replayStartedAt.toISOString(),
      };
      const response = mutation.syncedPlanningItemId
        ? { item: { id: mutation.syncedPlanningItemId } }
        : await sendMutation(replayMutation);
      const responseItemId = Number((response as { item?: { id?: unknown } })?.item?.id);
      const payloadItemId = Number(mutation.payload.id);
      const syncedPlanningItemId =
        Number.isFinite(responseItemId) && responseItemId > 0
          ? responseItemId
          : Number.isFinite(payloadItemId) && payloadItemId > 0
            ? payloadItemId
            : mutation.syncedPlanningItemId;
      replayMutation = syncedPlanningItemId
        ? { ...replayMutation, syncedPlanningItemId }
        : replayMutation;
      if (mutation.assignmentPayload !== undefined) {
        await replayAssignmentPayload?.(replayMutation, response);
      }
      syncedCount += 1;
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const failureReason = classifyError(error);

      if (RETRYABLE_FAILURE_REASONS.has(failureReason) && replayMutation.attempts < MAX_PLANNING_SYNC_ATTEMPTS) {
        recordOperationalEvent({
          level: "warn",
          name: "sync.replay_failed",
          source: "planningMutationQueue",
          metadata: {
            retryable: true,
            method: mutation.method,
            index,
          },
        });
        nextQueue.push({
          ...replayMutation,
          status: "pending",
          failureReason,
          lastError: message,
          nextRetryAt: getNextRetryAt(replayMutation.attempts, replayStartedAt),
        });
        nextQueue.push(...mutations.slice(index + 1));
        stoppedForRetryableError = true;
        retryableError = error;
        retryableErrorMessage = message;
        break;
      }

      const isConflict = failureReason === "concurrency_conflict";
      const conflictSnapshot = isConflict
        ? {
            localPayload: replayMutation.payload,
            serverItem: await loadServerConflictSnapshot?.(replayMutation).catch(() => null),
          }
        : undefined;

      nextQueue.push({
        ...replayMutation,
        status: isConflict ? "conflict" : "failed",
        lastError: message,
        failureReason,
        conflictSnapshot,
        nextRetryAt: undefined,
      });
      recordOperationalEvent({
        level: "warn",
        name: isConflict ? "sync.conflict_detected" : "sync.replay_failed",
        source: "planningMutationQueue",
        metadata: {
          method: mutation.method,
          index,
          failureReason,
        },
      });
      foundConflict = foundConflict || isConflict;
    }
  }

  if (!stoppedForRetryableError) {
    const processedIds = new Set(nextQueue.map((mutation) => mutation.id));
    for (const mutation of mutations) {
      if (mutation.status === "conflict" && !processedIds.has(mutation.id)) {
        nextQueue.push(mutation);
      }
    }
  }

  recordOperationalEvent({
    level: foundConflict || stoppedForRetryableError ? "warn" : "info",
    name: "sync.replay_finished",
    source: "planningMutationQueue",
    metadata: {
      syncedCount,
      nextQueueCount: nextQueue.length,
      stoppedForRetryableError,
      foundConflict,
    },
  });

  return {
    nextQueue,
    syncedCount,
    stoppedForRetryableError,
    foundConflict,
    retryableError,
    retryableErrorMessage,
  };
}
