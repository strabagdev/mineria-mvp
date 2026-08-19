import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  findProcessedSyncMutation: vi.fn(),
  findSyncChangeByMutationEntity: vi.fn(),
  insertProcessedSyncMutation: vi.fn(),
  insertSyncChanges: vi.fn(),
  listSyncChanges: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/repositories/sync.repository", () => ({
  findProcessedSyncMutation: repository.findProcessedSyncMutation,
  findSyncChangeByMutationEntity: repository.findSyncChangeByMutationEntity,
  insertProcessedSyncMutation: repository.insertProcessedSyncMutation,
  insertSyncChanges: repository.insertSyncChanges,
  listSyncChanges: repository.listSyncChanges,
}));

const planningItem = {
  id: 42,
  activity_group_id: "group-1",
  item_date: "2026-08-18",
  start_time: "08:00:00",
  end_time: "09:00:00",
  shift: "Dia",
  category: "actividad",
  tracking_type: "programado",
  item_type: "Perforacion",
  description: "Perforacion",
  notes: null,
  updated_at: "2026-08-18T12:00:00.000Z",
} as const;

describe("sync service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("registers planning upserts and processed mutation responses", async () => {
    repository.insertSyncChanges.mockResolvedValue([{ sequenceId: 10 }]);
    repository.insertProcessedSyncMutation.mockResolvedValue({});
    const { registerPlanningMutationSync } = await import("./sync.service");

    await registerPlanningMutationSync({
      mutationId: "mutation-1",
      method: "PATCH",
      actorUserId: "user-1",
      response: { item: planningItem },
    });

    expect(repository.insertSyncChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        domain: "planning",
        entity_type: "planning_item",
        entity_id: "42",
        operation: "upsert",
        server_revision: planningItem.updated_at,
        mutation_id: "mutation-1",
      }),
    ]);
    expect(repository.insertProcessedSyncMutation).toHaveBeenCalledWith(expect.objectContaining({
      mutation_id: "mutation-1",
      domain: "planning",
      operation: "update",
      response: { item: planningItem },
    }));
  });

  it("registers planning tombstones for deletes", async () => {
    repository.insertSyncChanges.mockResolvedValue([{ sequenceId: 11 }]);
    repository.insertProcessedSyncMutation.mockResolvedValue({});
    const { registerPlanningMutationSync } = await import("./sync.service");

    await registerPlanningMutationSync({
      mutationId: "delete-1",
      method: "DELETE",
      actorUserId: "user-1",
      response: { ok: true },
      deleted: {
        id: 42,
        trackingType: "programado",
        itemDate: "2026-08-18",
        updatedAt: planningItem.updated_at,
      },
    });

    expect(repository.insertSyncChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        entity_id: "42",
        operation: "delete",
        payload: {
          id: 42,
          tracking_type: "programado",
          item_date: "2026-08-18",
        },
      }),
    ]);
  });

  it("returns incremental changes and hasMore from the extra row", async () => {
    repository.listSyncChanges.mockResolvedValue([
      { sequenceId: 2 },
      { sequenceId: 3 },
      { sequenceId: 4 },
    ]);
    const { pullPlanningSyncChanges } = await import("./sync.service");

    await expect(pullPlanningSyncChanges({ cursor: 1, limit: 2, scopeUserId: "user-1" })).resolves.toEqual({
      changes: [{ sequenceId: 2 }, { sequenceId: 3 }],
      nextCursor: 3,
      hasMore: true,
    });
    expect(repository.listSyncChanges).toHaveBeenCalledWith({
      cursor: 1,
      limit: 2,
      scopeUserId: "user-1",
      domain: "planning",
    });
  });

  it("looks up processed mutations by planning domain", async () => {
    repository.findProcessedSyncMutation.mockResolvedValue({ response: { item: planningItem } });
    const { findProcessedPlanningMutation } = await import("./sync.service");

    await expect(findProcessedPlanningMutation("mutation-1")).resolves.toEqual({
      response: { item: planningItem },
    });
    expect(repository.findProcessedSyncMutation).toHaveBeenCalledWith({
      mutationId: "mutation-1",
      domain: "planning",
      scopeUserId: null,
    });
  });

  it("registers assignment dependency changes idempotently", async () => {
    repository.findSyncChangeByMutationEntity.mockResolvedValueOnce(null);
    repository.insertSyncChanges.mockResolvedValueOnce([{ sequenceId: 20 }]);
    const { registerPlanningAssignmentSync } = await import("./sync.service");
    const target = { target_kind: "planning_item" as const, target_id: 42 };
    const assignments = [{ id: 1, planning_item_id: 42, execution_segment_id: null, assignment_type_id: 7, instance_order: 1, values: [] }];

    await registerPlanningAssignmentSync({
      mutationId: "mutation-assignments-1",
      actorUserId: "user-1",
      target,
      assignments,
    });

    expect(repository.findSyncChangeByMutationEntity).toHaveBeenCalledWith({
      mutationId: "mutation-assignments-1",
      domain: "planning",
      entityType: "planning_assignment",
      entityId: "planning_item:42",
      operation: "upsert",
    });
    expect(repository.insertSyncChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        entity_type: "planning_assignment",
        entity_id: "planning_item:42",
        operation: "upsert",
        payload: { target, assignments },
      }),
    ]);

    repository.findSyncChangeByMutationEntity.mockResolvedValueOnce({ sequenceId: 20 });
    repository.insertSyncChanges.mockClear();
    await registerPlanningAssignmentSync({
      mutationId: "mutation-assignments-1",
      actorUserId: "user-1",
      target,
      assignments,
    });

    expect(repository.insertSyncChanges).not.toHaveBeenCalled();
  });
});
