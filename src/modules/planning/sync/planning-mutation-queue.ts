import type { PlanningItem } from "@/modules/planning/presentation/planning-page-models";
import type { PendingPlanningMutation } from "./planning-sync-models";

type ReplayPendingPlanningMutationsArgs = {
  mutations: PendingPlanningMutation[];
  sendMutation: (mutation: PendingPlanningMutation) => Promise<unknown>;
  getErrorMessage: (error: unknown) => string;
  isRetryableError: (error: unknown) => boolean;
};

export type ReplayPendingPlanningMutationsResult = {
  nextQueue: PendingPlanningMutation[];
  syncedCount: number;
  stoppedForRetryableError: boolean;
  foundConflict: boolean;
  retryableError: unknown;
  retryableErrorMessage: string;
};

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
  payload: Record<string, unknown>
): PendingPlanningMutation {
  const id = crypto.randomUUID();

  return {
    id,
    method,
    payload: withClientMutationId(payload, id),
    createdAt: new Date().toISOString(),
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
  if (mutation.status === "conflict") {
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
    level: String(payload.level ?? ""),
    front: String(payload.front ?? ""),
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
  return mutations.filter((mutation) => mutation.status !== "conflict");
}

export function discardConflictedPlanningMutations(mutations: PendingPlanningMutation[]) {
  return mutations.filter((mutation) => mutation.status !== "conflict");
}

export async function replayPendingPlanningMutations({
  mutations,
  sendMutation,
  getErrorMessage,
  isRetryableError,
}: ReplayPendingPlanningMutationsArgs): Promise<ReplayPendingPlanningMutationsResult> {
  const nextQueue: PendingPlanningMutation[] = [];
  let syncedCount = 0;
  let stoppedForRetryableError = false;
  let foundConflict = false;
  let retryableError: unknown = null;
  let retryableErrorMessage = "";

  for (let index = 0; index < mutations.length; index += 1) {
    const mutation = mutations[index];

    if (mutation.status === "conflict") {
      nextQueue.push(mutation);
      continue;
    }

    try {
      await sendMutation(mutation);
      syncedCount += 1;
    } catch (error: unknown) {
      const message = getErrorMessage(error);

      if (isRetryableError(error)) {
        nextQueue.push(mutation);
        nextQueue.push(...mutations.slice(index + 1));
        stoppedForRetryableError = true;
        retryableError = error;
        retryableErrorMessage = message;
        break;
      }

      nextQueue.push({
        ...mutation,
        status: "conflict",
        lastError: message,
        lastTriedAt: new Date().toISOString(),
      });
      foundConflict = true;
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

  return {
    nextQueue,
    syncedCount,
    stoppedForRetryableError,
    foundConflict,
    retryableError,
    retryableErrorMessage,
  };
}
