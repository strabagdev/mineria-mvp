"use client";

import {
  buildPlanningAssignmentsCacheKey,
  OFFLINE_KEYS,
  readKeyValueCache,
  saveKeyValueCache,
} from "@/lib/localOfflineStore";
import type {
  AssignmentTypeDto,
  PlanningAssignmentDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";

export function saveAssignmentTypesCache(types: AssignmentTypeDto[]) {
  return saveKeyValueCache(OFFLINE_KEYS.planningAssignmentTypes, types);
}

export async function readAssignmentTypesCache() {
  const cached = await readKeyValueCache<AssignmentTypeDto[]>(OFFLINE_KEYS.planningAssignmentTypes);
  return cached?.value && Array.isArray(cached.value) ? cached.value : null;
}

export function savePlanningAssignmentsCache(planningItemId: number, assignments: PlanningAssignmentDto[]) {
  return saveKeyValueCache(buildPlanningAssignmentsCacheKey(planningItemId), assignments);
}

export async function readPlanningAssignmentsCache(planningItemId: number) {
  if (planningItemId <= 0) return null;
  const cached = await readKeyValueCache<PlanningAssignmentDto[]>(buildPlanningAssignmentsCacheKey(planningItemId));
  return cached?.value && Array.isArray(cached.value) ? cached.value : null;
}
