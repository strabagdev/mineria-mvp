import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanningRemoteChangeApplier } from "./planning-remote-change-applier";
import type { SyncChange } from "@/modules/sync/sync-contracts";
import type { PendingPlanningMutation } from "./planning-sync-models";

const localStore = vi.hoisted(() => ({
  readSyncCursor: vi.fn(),
  saveSyncCursor: vi.fn(),
}));

const localRepository = vi.hoisted(() => ({
  readByDate: vi.fn(),
  replaceSnapshot: vi.fn(),
  deleteLocalItem: vi.fn((items: Array<{ id: number }>, id: number) => items.filter((item) => item.id !== id)),
  upsertLocalItem: vi.fn((items: Array<{ id: number }>, item: { id: number }) => [
    ...items.filter((entry) => entry.id !== item.id),
    item,
  ]),
}));

vi.mock("@/lib/localOfflineStore", () => ({
  readSyncCursor: localStore.readSyncCursor,
  saveSyncCursor: localStore.saveSyncCursor,
}));

vi.mock("../local/planning-local-repository", () => ({
  planningLocalRepository: localRepository,
}));

const scope = { userId: "user-1" };

function makeChange(input: Partial<SyncChange> = {}): SyncChange {
  return {
    sequenceId: input.sequenceId ?? 1,
    scopeUserId: input.scopeUserId ?? null,
    domain: "planning",
    entityType: input.entityType ?? "planning_item",
    entityId: input.entityId ?? "42",
    operation: input.operation ?? "upsert",
    serverRevision: input.serverRevision ?? "2026-08-18T12:00:00.000Z",
    occurredAt: input.occurredAt ?? "2026-08-18T12:00:00.000Z",
    mutationId: input.mutationId ?? "remote-1",
    payload: input.payload ?? {
      item: {
        id: 42,
        activity_group_id: "group-1",
        item_date: "2026-08-18",
        start_time: "08:00:00",
        end_time: "09:00:00",
        shift: "Dia",
        category: "actividad",
        tracking_type: "programado",
        item_type: "Perforacion",
        description: "Perforacion remota",
        notes: null,
        updated_at: "2026-08-18T12:00:00.000Z",
      },
    },
  };
}

function makeMutation(input: Partial<PendingPlanningMutation> = {}): PendingPlanningMutation {
  return {
    id: input.id ?? "local-1",
    userId: "user-1",
    scope,
    method: input.method ?? "PATCH",
    payload: input.payload ?? { id: 42, item_date: "2026-08-18" },
    createdAt: "2026-08-18T11:00:00.000Z",
    status: input.status ?? "pending",
    attempts: input.attempts ?? 0,
  };
}

describe("PlanningRemoteChangeApplier", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStore.readSyncCursor.mockResolvedValue(0);
    localRepository.readByDate.mockResolvedValue({ items: [], updatedAt: "2026-08-18T10:00:00.000Z" });
    localRepository.replaceSnapshot.mockResolvedValue({});
  });

  it("applies remote upserts to the local date snapshot and advances the cursor", async () => {
    const applier = new PlanningRemoteChangeApplier();
    const result = await applier.applyChanges({
      changes: [makeChange({ sequenceId: 7 })],
      scope,
      pendingMutations: [],
      currentDate: "2026-08-18",
    });

    expect(localRepository.upsertLocalItem).toHaveBeenCalledWith([], expect.objectContaining({
      id: 42,
      start: "08:00",
      end: "09:00",
    }));
    expect(localRepository.replaceSnapshot).toHaveBeenCalledWith("2026-08-18", [expect.objectContaining({ id: 42 })], scope);
    expect(localStore.saveSyncCursor).toHaveBeenCalledWith("planning", 7, scope);
    expect(result.currentDateTouched).toBe(true);
  });

  it("applies remote tombstones without reviving deleted records", async () => {
    localRepository.readByDate.mockResolvedValue({
      items: [{ id: 42 }, { id: 50 }],
      updatedAt: "2026-08-18T10:00:00.000Z",
    });
    const applier = new PlanningRemoteChangeApplier();

    await applier.applyChanges({
      changes: [makeChange({
        sequenceId: 8,
        operation: "delete",
        payload: { id: 42, tracking_type: "programado", item_date: "2026-08-18" },
      })],
      scope,
      pendingMutations: [],
    });

    expect(localRepository.deleteLocalItem).toHaveBeenCalledWith([{ id: 42 }, { id: 50 }], 42);
    expect(localRepository.replaceSnapshot).toHaveBeenCalledWith("2026-08-18", [{ id: 50 }], scope);
  });

  it("marks local pending mutations as conflicts when a remote change touches the same entity", async () => {
    const applier = new PlanningRemoteChangeApplier();
    const result = await applier.applyChanges({
      changes: [makeChange({ sequenceId: 9 })],
      scope,
      pendingMutations: [makeMutation()],
    });

    expect(result.foundConflict).toBe(true);
    expect(result.nextMutations[0]).toMatchObject({
      status: "conflict",
      failureReason: "concurrency_conflict",
    });
    expect(localRepository.replaceSnapshot).not.toHaveBeenCalled();
    expect(localStore.saveSyncCursor).toHaveBeenCalledWith("planning", 9, scope);
  });
});
