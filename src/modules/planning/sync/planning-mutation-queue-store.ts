"use client";

import {
  readPendingPlanningMutations,
  savePendingPlanningMutations,
} from "@/lib/localOfflineStore";
import {
  LEGACY_PLANNING_MUTATION_QUEUE_KEY,
  type PendingPlanningMutation,
} from "./planning-sync-models";

export async function loadPendingPlanningMutations() {
  const cachedMutations = await readPendingPlanningMutations<PendingPlanningMutation[]>().catch(() => null);

  if (cachedMutations?.value && Array.isArray(cachedMutations.value)) {
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

    await savePendingPlanningMutations(legacyMutations);
    window.localStorage.removeItem(LEGACY_PLANNING_MUTATION_QUEUE_KEY);
    return legacyMutations;
  } catch {
    return [];
  }
}

export async function persistPendingPlanningMutations(mutations: PendingPlanningMutation[]) {
  await savePendingPlanningMutations(mutations);
}
