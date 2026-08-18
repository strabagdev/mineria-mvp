"use client";

import {
  type OfflineStorageScope,
  readPendingPlanningMutations,
  savePendingPlanningMutations,
} from "@/lib/localOfflineStore";
import { recordOperationalEvent } from "../../../lib/observability/logger";
import type { PendingPlanningMutation } from "./planning-sync-models";

export async function loadPendingPlanningMutations(scope?: OfflineStorageScope) {
  if (!scope?.userId) {
    return [];
  }

  const cachedMutations = await readPendingPlanningMutations<PendingPlanningMutation[]>(scope).catch(() => null);

  if (cachedMutations?.value && Array.isArray(cachedMutations.value)) {
    recordOperationalEvent({
      name: "sync.queue_loaded",
      source: "planningMutationQueueStore",
      metadata: { count: cachedMutations.value.length, storage: "indexeddb" },
    });
    return cachedMutations.value;
  }

  return [];
}

export async function persistPendingPlanningMutations(
  mutations: PendingPlanningMutation[],
  scope?: OfflineStorageScope
) {
  await savePendingPlanningMutations(mutations, scope);
  recordOperationalEvent({
    name: "sync.queue_persisted",
    source: "planningMutationQueueStore",
    metadata: {
      count: mutations.length,
      conflictCount: mutations.filter((mutation) => mutation.status === "conflict").length,
    },
  });
}
