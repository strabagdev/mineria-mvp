"use client";

import {
  type OfflineStorageScope,
  readPendingPlanningMutations,
  savePendingPlanningMutations,
} from "@/lib/localOfflineStore";
import { recordOperationalEvent } from "../../../lib/observability/logger";
import {
  LEGACY_PLANNING_MUTATION_QUEUE_KEY,
  type PendingPlanningMutation,
} from "./planning-sync-models";

export async function loadPendingPlanningMutations(scope?: OfflineStorageScope) {
  const cachedMutations = await readPendingPlanningMutations<PendingPlanningMutation[]>(scope).catch(() => null);

  if (cachedMutations?.value && Array.isArray(cachedMutations.value)) {
    recordOperationalEvent({
      name: "sync.queue_loaded",
      source: "planningMutationQueueStore",
      metadata: { count: cachedMutations.value.length, storage: "indexeddb" },
    });
    return cachedMutations.value;
  }

  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_PLANNING_MUTATION_QUEUE_KEY) ?? "[]");
    const legacyMutations = Array.isArray(parsed) ? (parsed as PendingPlanningMutation[]) : [];

    if (!legacyMutations.length) {
      return [];
    }

    await savePendingPlanningMutations(legacyMutations, scope);
    window.localStorage.removeItem(LEGACY_PLANNING_MUTATION_QUEUE_KEY);
    recordOperationalEvent({
      name: "sync.legacy_queue_migrated",
      source: "planningMutationQueueStore",
      metadata: { count: legacyMutations.length },
    });
    return legacyMutations;
  } catch {
    return [];
  }
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
