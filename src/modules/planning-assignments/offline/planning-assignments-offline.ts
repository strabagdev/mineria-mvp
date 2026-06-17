"use client";

import {
  buildPlanningAssignmentsCacheKey,
  OFFLINE_KEYS,
  readKeyValueCache,
  saveKeyValueCache,
} from "@/lib/localOfflineStore";
import type {
  AssignmentTarget,
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

export function buildAssignmentCacheKey(target: AssignmentTarget) {
  return `${OFFLINE_KEYS.assignmentTargetsPrefix}:${target.target_kind}:${target.target_id}`;
}

export function saveAssignmentsCacheForTarget(target: AssignmentTarget, assignments: PlanningAssignmentDto[]) {
  return saveKeyValueCache(buildAssignmentCacheKey(target), assignments);
}

export async function readAssignmentsCacheForTarget(target: AssignmentTarget) {
  if (target.target_id <= 0) return null;
  const cached = await readKeyValueCache<PlanningAssignmentDto[]>(buildAssignmentCacheKey(target));
  if (cached?.value && Array.isArray(cached.value)) {
    return cached.value;
  }

  if (target.target_kind !== "planning_item") {
    return null;
  }

  const legacyCached = await readKeyValueCache<PlanningAssignmentDto[]>(buildPlanningAssignmentsCacheKey(target.target_id));
  return legacyCached?.value && Array.isArray(legacyCached.value) ? legacyCached.value : null;
}

export function savePlanningAssignmentsCache(planningItemId: number, assignments: PlanningAssignmentDto[]) {
  return saveAssignmentsCacheForTarget({ target_kind: "planning_item", target_id: planningItemId }, assignments);
}

export async function readPlanningAssignmentsCache(planningItemId: number) {
  return readAssignmentsCacheForTarget({ target_kind: "planning_item", target_id: planningItemId });
}
