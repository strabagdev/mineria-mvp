"use client";

import type { OfflineStorageScope } from "@/lib/localOfflineStore";
import { readPlanningCache, savePlanningCache } from "@/lib/localOfflineStore";
import type { PlanningItem } from "../presentation/planning-page-models";
import { applyPendingPlanningMutations, toOptimisticPlanningItem } from "../sync/planning-mutation-queue";
import type { PendingPlanningMutation } from "../sync/planning-sync-models";

export type PlanningLocalSnapshot = {
  items: PlanningItem[];
  updatedAt: string;
};

export class PlanningLocalRepository {
  async readByDate(date: string, scope: OfflineStorageScope): Promise<PlanningLocalSnapshot | null> {
    const cachedPlanning = await readPlanningCache<PlanningItem[]>(date, scope).catch(() => null);

    if (!cachedPlanning) {
      return null;
    }

    return {
      items: cachedPlanning.items,
      updatedAt: cachedPlanning.updatedAt,
    };
  }

  async replaceSnapshot(date: string, items: PlanningItem[], scope: OfflineStorageScope) {
    await savePlanningCache(date, items, scope);
    return {
      items,
      updatedAt: new Date().toISOString(),
    } satisfies PlanningLocalSnapshot;
  }

  async reconcileServerSnapshot(
    date: string,
    serverItems: PlanningItem[],
    pendingMutations: PendingPlanningMutation[],
    scope: OfflineStorageScope
  ) {
    const effectiveItems = applyPendingPlanningMutations(serverItems, pendingMutations, date);
    await this.replaceSnapshot(date, effectiveItems, scope);
    return effectiveItems;
  }

  async applyLocalMutation(
    date: string,
    currentItems: PlanningItem[],
    mutation: PendingPlanningMutation,
    scope: OfflineStorageScope
  ) {
    const effectiveItems = applyPendingPlanningMutations(currentItems, [mutation], date);
    await this.replaceSnapshot(date, effectiveItems, scope);
    return effectiveItems;
  }

  upsertLocalItem(items: PlanningItem[], item: PlanningItem) {
    const nextItems = [...items];
    const existingIndex = nextItems.findIndex((entry) => entry.id === item.id);

    if (existingIndex === -1) {
      nextItems.push(item);
      return nextItems;
    }

    nextItems[existingIndex] = item;
    return nextItems;
  }

  deleteLocalItem(items: PlanningItem[], id: number) {
    return items.filter((item) => item.id !== id);
  }

  getOptimisticItem(mutation: PendingPlanningMutation) {
    return toOptimisticPlanningItem(mutation);
  }
}

export const planningLocalRepository = new PlanningLocalRepository();
