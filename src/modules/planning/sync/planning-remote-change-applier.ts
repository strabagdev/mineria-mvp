"use client";

import type { OfflineStorageScope } from "@/lib/localOfflineStore";
import { readSyncCursor, saveSyncCursor } from "@/lib/localOfflineStore";
import type { PlanningItemDto } from "@/modules/planning/contracts/planning-items";
import type { PlanningItem } from "@/modules/planning/presentation/planning-page-models";
import type { SyncChange } from "@/modules/sync/sync-contracts";
import { planningLocalRepository } from "../local/planning-local-repository";
import type { PendingPlanningMutation } from "./planning-sync-models";

const PLANNING_SYNC_DOMAIN = "planning";

function toPlanningItem(item: PlanningItemDto): PlanningItem {
  return {
    id: item.id,
    activity_group_id: item.activity_group_id,
    item_date: item.item_date,
    start: item.start_time.slice(0, 5),
    end: item.end_time.slice(0, 5),
    updated_at: item.updated_at,
    shift: item.shift,
    category: item.category,
    tracking_type: item.tracking_type,
    item_type: item.item_type,
    description: item.description,
    notes: item.notes ?? null,
    operational_header_values: item.operational_header_values,
  };
}

function getChangeItem(change: SyncChange) {
  const item = change.payload.item;
  return item && typeof item === "object" ? item as PlanningItemDto : null;
}

function getChangeDate(change: SyncChange) {
  if (change.operation === "upsert") {
    return getChangeItem(change)?.item_date ?? null;
  }

  const itemDate = change.payload.item_date;
  return typeof itemDate === "string" && itemDate.trim() ? itemDate.trim() : null;
}

function mutationTouchesEntity(mutation: PendingPlanningMutation, change: SyncChange) {
  const entityId = Number(change.entityId);
  const payloadId = Number(mutation.payload.id);
  const syncedId = Number(mutation.syncedPlanningItemId);

  return (
    (Number.isFinite(payloadId) && payloadId === entityId) ||
    (Number.isFinite(syncedId) && syncedId === entityId)
  );
}

function markConflictedMutations(
  mutations: PendingPlanningMutation[],
  change: SyncChange
) {
  let foundConflict = false;
  const nextMutations = mutations.map((mutation) => {
    if (
      mutation.status === "conflict" ||
      mutation.status === "failed" ||
      !mutationTouchesEntity(mutation, change)
    ) {
      return mutation;
    }

    foundConflict = true;
    return {
      ...mutation,
      status: "conflict" as const,
      failureReason: "concurrency_conflict" as const,
      lastError: "El registro cambio remotamente antes de sincronizar el cambio local.",
      conflictSnapshot: {
        localPayload: mutation.payload,
        serverItem: change.operation === "upsert" ? getChangeItem(change) : change.payload,
      },
      nextRetryAt: undefined,
    };
  });

  return { foundConflict, nextMutations };
}

export class PlanningRemoteChangeApplier {
  async readCursor(scope: OfflineStorageScope) {
    return readSyncCursor(PLANNING_SYNC_DOMAIN, scope);
  }

  async applyChanges(input: {
    changes: SyncChange[];
    scope: OfflineStorageScope;
    pendingMutations: PendingPlanningMutation[];
    currentDate?: string;
  }) {
    let nextMutations = input.pendingMutations;
    const touchedDates = new Set<string>();
    let foundConflict = false;
    let nextCursor = await this.readCursor(input.scope);

    for (const change of input.changes) {
      if (change.domain !== PLANNING_SYNC_DOMAIN) {
        continue;
      }

      nextCursor = Math.max(nextCursor, change.sequenceId);
      const changeDate = getChangeDate(change);
      if (!changeDate) {
        continue;
      }

      const conflictResult = markConflictedMutations(nextMutations, change);
      nextMutations = conflictResult.nextMutations;
      foundConflict = foundConflict || conflictResult.foundConflict;

      if (conflictResult.foundConflict) {
        continue;
      }

      const snapshot = await planningLocalRepository.readByDate(changeDate, input.scope);
      const currentItems = snapshot?.items ?? [];
      const changeItem = getChangeItem(change);
      if (change.operation === "upsert" && !changeItem) {
        continue;
      }

      const nextItems = change.operation === "delete"
        ? planningLocalRepository.deleteLocalItem(currentItems, Number(change.entityId))
        : planningLocalRepository.upsertLocalItem(currentItems, toPlanningItem(changeItem as PlanningItemDto));

      await planningLocalRepository.replaceSnapshot(changeDate, nextItems, input.scope);
      touchedDates.add(changeDate);
    }

    await saveSyncCursor(PLANNING_SYNC_DOMAIN, nextCursor, input.scope);

    return {
      nextCursor,
      nextMutations,
      touchedDates: Array.from(touchedDates),
      currentDateTouched: input.currentDate ? touchedDates.has(input.currentDate) : false,
      foundConflict,
    };
  }
}

export const planningRemoteChangeApplier = new PlanningRemoteChangeApplier();
