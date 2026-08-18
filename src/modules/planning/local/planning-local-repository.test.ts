import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanningLocalRepository } from "./planning-local-repository";
import type { PlanningItem } from "../presentation/planning-page-models";
import type { PendingPlanningMutation } from "../sync/planning-sync-models";

const localStore = vi.hoisted(() => ({
  readPlanningCache: vi.fn(),
  savePlanningCache: vi.fn(),
}));

vi.mock("@/lib/localOfflineStore", () => ({
  readPlanningCache: localStore.readPlanningCache,
  savePlanningCache: localStore.savePlanningCache,
}));

const scope = { userId: "user-1" };

function makeItem(input: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id: input.id ?? 1,
    activity_group_id: input.activity_group_id ?? "drill-1",
    item_date: input.item_date ?? "2026-08-18",
    start: input.start ?? "08:00",
    end: input.end ?? "09:00",
    shift: input.shift ?? "Dia",
    category: input.category ?? "actividad",
    tracking_type: input.tracking_type ?? "programado",
    item_type: input.item_type ?? "Perforacion",
    description: input.description ?? "Perforacion",
    notes: input.notes ?? null,
    updated_at: input.updated_at,
  };
}

function makeMutation(input: Partial<PendingPlanningMutation> = {}): PendingPlanningMutation {
  const userId = input.userId ?? scope.userId;

  return {
    id: input.id ?? "mutation-1",
    userId,
    scope: input.scope ?? { userId },
    method: input.method ?? "POST",
    payload: input.payload ?? {
      item_date: "2026-08-18",
      start_time: "10:00",
      end_time: "11:00",
      shift: "Dia",
      activity_group_id: "drill-2",
      category: "actividad",
      tracking_type: "programado",
      item_type: "Perforacion",
      description: "Perforacion local",
    },
    createdAt: input.createdAt ?? "2026-08-18T08:00:00.000Z",
    status: input.status ?? "pending",
    attempts: input.attempts ?? 0,
    failureReason: input.failureReason,
  };
}

describe("PlanningLocalRepository", () => {
  beforeEach(() => {
    localStore.readPlanningCache.mockReset();
    localStore.savePlanningCache.mockReset();
  });

  it("hydrates an existing local snapshot without using the API", async () => {
    const repository = new PlanningLocalRepository();
    const items = [makeItem()];
    localStore.readPlanningCache.mockResolvedValueOnce({
      items,
      updatedAt: "2026-08-18T10:00:00.000Z",
    });

    await expect(repository.readByDate("2026-08-18", scope)).resolves.toEqual({
      items,
      updatedAt: "2026-08-18T10:00:00.000Z",
    });
  });

  it("returns null when there is no local snapshot", async () => {
    const repository = new PlanningLocalRepository();
    localStore.readPlanningCache.mockResolvedValueOnce(null);

    await expect(repository.readByDate("2026-08-18", scope)).resolves.toBeNull();
  });

  it("reconciles server snapshot plus pending create into the local store", async () => {
    const repository = new PlanningLocalRepository();
    const serverItem = makeItem({ id: 1 });
    const pendingCreate = makeMutation({ id: "create-local" });

    const effectiveItems = await repository.reconcileServerSnapshot(
      "2026-08-18",
      [serverItem],
      [pendingCreate],
      scope
    );

    expect(effectiveItems).toHaveLength(2);
    expect(effectiveItems.some((item) => item.id < 0 && item.description === "Perforacion local")).toBe(true);
    expect(localStore.savePlanningCache).toHaveBeenCalledWith("2026-08-18", effectiveItems, scope);
  });

  it("keeps a pending edit over a refreshed server snapshot", async () => {
    const repository = new PlanningLocalRepository();
    const pendingEdit = makeMutation({
      method: "PATCH",
      payload: {
        id: 1,
        item_date: "2026-08-18",
        start_time: "08:30",
        end_time: "09:30",
        shift: "Dia",
        activity_group_id: "drill-1",
        category: "actividad",
        tracking_type: "programado",
        item_type: "Perforacion",
        description: "Edit local",
      },
    });

    const effectiveItems = await repository.reconcileServerSnapshot(
      "2026-08-18",
      [makeItem({ id: 1, description: "Server stale" })],
      [pendingEdit],
      scope
    );

    expect(effectiveItems).toHaveLength(1);
    expect(effectiveItems[0]).toMatchObject({ id: 1, description: "Edit local", sync_status: "pending" });
  });

  it("does not revive a server record when delete is pending", async () => {
    const repository = new PlanningLocalRepository();
    const pendingDelete = makeMutation({
      method: "DELETE",
      payload: { id: 1, tracking_type: "programado" },
    });

    const effectiveItems = await repository.reconcileServerSnapshot(
      "2026-08-18",
      [makeItem({ id: 1 })],
      [pendingDelete],
      scope
    );

    expect(effectiveItems).toEqual([]);
  });

  it("does not mix another date into the effective snapshot", async () => {
    const repository = new PlanningLocalRepository();
    const pendingCreate = makeMutation({
      payload: {
        item_date: "2026-08-19",
        start_time: "10:00",
        end_time: "11:00",
        shift: "Dia",
        activity_group_id: "drill-2",
        category: "actividad",
        tracking_type: "programado",
        item_type: "Perforacion",
        description: "Other date",
      },
    });

    const effectiveItems = await repository.reconcileServerSnapshot(
      "2026-08-18",
      [makeItem({ id: 1, item_date: "2026-08-18" })],
      [pendingCreate],
      scope
    );

    expect(effectiveItems).toEqual([makeItem({ id: 1, item_date: "2026-08-18" })]);
  });

  it("applies a local delete immediately", async () => {
    const repository = new PlanningLocalRepository();
    const pendingDelete = makeMutation({
      method: "DELETE",
      payload: { id: 1, tracking_type: "programado" },
    });

    const effectiveItems = await repository.applyLocalMutation(
      "2026-08-18",
      [makeItem({ id: 1 }), makeItem({ id: 2 })],
      pendingDelete,
      scope
    );

    expect(effectiveItems.map((item) => item.id)).toEqual([2]);
    expect(localStore.savePlanningCache).toHaveBeenCalledWith("2026-08-18", effectiveItems, scope);
  });

  it("replaces a confirmed create temporary item with the server id", async () => {
    const repository = new PlanningLocalRepository();
    const temporaryItem = makeItem({ id: -123, description: "Perforacion local" });
    const serverItem = makeItem({ id: 42, description: "Perforacion local", updated_at: "2026-08-18T11:00:00.000Z" });

    const effectiveItems = await repository.reconcileServerSnapshot(
      "2026-08-18",
      [serverItem],
      [],
      scope
    );

    expect(temporaryItem.id).toBeLessThan(0);
    expect(effectiveItems).toEqual([serverItem]);
    expect(effectiveItems.some((item) => item.id < 0)).toBe(false);
  });
});
