"use client";

import {
  buildPlanningAssignmentsCacheKey,
  OFFLINE_KEYS,
  type OfflineStorageScope,
  readKeyValueCache,
  saveKeyValueCache,
} from "@/lib/localOfflineStore";
import type {
  AssignmentTarget,
  AssignmentTypeDto,
  PlanningAssignmentDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";

export function saveAssignmentTypesCache(types: AssignmentTypeDto[], scope: OfflineStorageScope) {
  return saveKeyValueCache(OFFLINE_KEYS.planningAssignmentTypes, types, scope);
}

export async function readAssignmentTypesCache(scope: OfflineStorageScope) {
  const cached = await readKeyValueCache<AssignmentTypeDto[]>(OFFLINE_KEYS.planningAssignmentTypes, scope);
  return cached?.value && Array.isArray(cached.value) ? cached.value : null;
}

export function buildAssignmentCacheKey(target: AssignmentTarget) {
  return `${OFFLINE_KEYS.assignmentTargetsPrefix}:${target.target_kind}:${target.target_id}`;
}

export function saveAssignmentsCacheForTarget(
  target: AssignmentTarget,
  assignments: PlanningAssignmentDto[],
  scope: OfflineStorageScope
) {
  return saveKeyValueCache(buildAssignmentCacheKey(target), assignments, scope);
}

export async function readAssignmentsCacheForTarget(target: AssignmentTarget, scope: OfflineStorageScope) {
  if (target.target_id <= 0) return null;
  const cached = await readKeyValueCache<PlanningAssignmentDto[]>(buildAssignmentCacheKey(target), scope);
  if (cached?.value && Array.isArray(cached.value)) {
    return cached.value;
  }

  if (target.target_kind !== "planning_item") {
    return null;
  }

  const legacyCached = await readKeyValueCache<PlanningAssignmentDto[]>(
    buildPlanningAssignmentsCacheKey(target.target_id),
    scope
  );
  return legacyCached?.value && Array.isArray(legacyCached.value) ? legacyCached.value : null;
}

export function savePlanningAssignmentsCache(
  planningItemId: number,
  assignments: PlanningAssignmentDto[],
  scope: OfflineStorageScope
) {
  return saveAssignmentsCacheForTarget({ target_kind: "planning_item", target_id: planningItemId }, assignments, scope);
}

export async function readPlanningAssignmentsCache(planningItemId: number, scope: OfflineStorageScope) {
  return readAssignmentsCacheForTarget({ target_kind: "planning_item", target_id: planningItemId }, scope);
}
