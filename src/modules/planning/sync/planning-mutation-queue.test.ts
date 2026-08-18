import { describe, expect, it, vi } from "vitest";
import {
  applyPendingPlanningMutations,
  discardConflictedPlanningMutations,
  getNextRetryAt,
  getRetryablePlanningMutations,
  makePendingPlanningMutation,
  replayPendingPlanningMutations,
  toOptimisticPlanningItem,
  withClientMutationId,
} from "./planning-mutation-queue";
import type { PendingPlanningMutation } from "./planning-sync-models";

const baseScope = { userId: "user-1" };

const baseMutation: PendingPlanningMutation = {
  id: "mutation-1",
  userId: "user-1",
  scope: baseScope,
  method: "POST",
  createdAt: "2026-05-23T00:00:00.000Z",
  status: "pending",
  attempts: 0,
  payload: {
    activity_group_id: "group-1",
    item_date: "2026-05-23",
    start_time: "08:00",
    end_time: "10:00",
    shift: "Dia",
    category: "actividad",
    tracking_type: "programado",
    item_type: "unitaria",
    description: "Extraccion",
    notes: "Nota",
  },
};

describe("planning mutation queue helpers", () => {
  it("adds a client mutation id without replacing an existing one", () => {
    expect(withClientMutationId({ description: "A" }, "fallback-1")).toEqual({
      description: "A",
      client_mutation_id: "fallback-1",
    });

    expect(withClientMutationId({ client_mutation_id: "existing" }, "fallback-2")).toEqual({
      client_mutation_id: "existing",
    });
  });

  it("maps pending mutations to optimistic planning items", () => {
    const optimisticItem = toOptimisticPlanningItem(baseMutation);

    expect(optimisticItem).toMatchObject({
      activity_group_id: "group-1",
      item_date: "2026-05-23",
      start: "08:00",
      end: "10:00",
      category: "actividad",
      tracking_type: "programado",
      sync_status: "pending",
    });
    expect(optimisticItem?.id).toBeLessThan(0);
  });

  it("keeps assignments outside the core planning payload", () => {
    const assignmentPayload = [{ assignment_type_id: 1, instance_order: 1, values: [{ field_id: 10, value_number: 8 }] }];
    const mutation = makePendingPlanningMutation(
      "POST",
      { description: "Extraccion" },
      { assignmentPayload, userId: "user-1", scope: baseScope }
    );

    expect(mutation.payload).toMatchObject({ description: "Extraccion" });
    expect(mutation.payload).not.toHaveProperty("assignmentPayload");
    expect(mutation.assignmentPayload).toEqual(assignmentPayload);
  });

  it("applies pending creates and deletes to visible planning items", () => {
    const visibleItems = applyPendingPlanningMutations(
      [
        {
          id: 42,
          activity_group_id: "group-delete",
          item_date: "2026-05-23",
          start: "09:00",
          end: "10:00",
          shift: "Dia",
          category: "actividad",
          tracking_type: "programado",
          item_type: "unitaria",
          description: "Eliminar",
          notes: null,
        },
      ],
      [
        baseMutation,
        {
          id: "mutation-delete",
          userId: "user-1",
          scope: baseScope,
          method: "DELETE",
          createdAt: "2026-05-23T00:01:00.000Z",
          status: "pending",
          attempts: 0,
          payload: { id: 42, tracking_type: "programado" },
        },
      ],
      "2026-05-23"
    );

    expect(visibleItems).toHaveLength(1);
    expect(visibleItems[0]).toMatchObject({ description: "Extraccion", sync_status: "pending" });
  });

  it("separates retryable and conflicted mutations", () => {
    const conflicted: PendingPlanningMutation = { ...baseMutation, id: "conflict", status: "conflict" };
    const queue = [baseMutation, conflicted];

    expect(getRetryablePlanningMutations(queue)).toEqual([baseMutation]);
    expect(discardConflictedPlanningMutations(queue)).toEqual([baseMutation]);
  });

  it("replays pending mutations and marks non-retryable failures as conflicts", async () => {
    const sendMutation = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("solape"));

    const result = await replayPendingPlanningMutations({
      mutations: [
        baseMutation,
        { ...baseMutation, id: "mutation-2", payload: { ...baseMutation.payload, description: "Conflict" } },
      ],
      sendMutation,
      getErrorMessage: (error) => (error instanceof Error ? error.message : "error"),
      classifyError: () => "concurrency_conflict",
    });

    expect(sendMutation).toHaveBeenCalledTimes(2);
    expect(result.syncedCount).toBe(1);
    expect(result.foundConflict).toBe(true);
    expect(result.nextQueue).toHaveLength(1);
    expect(result.nextQueue[0]).toMatchObject({
      id: "mutation-2",
      status: "conflict",
      failureReason: "concurrency_conflict",
      lastError: "solape",
    });
  });

  it("stops replay on retryable failures and keeps the remaining queue", async () => {
    const retryableError = new Error("Invalid session");
    const pendingAfterRetry: PendingPlanningMutation = { ...baseMutation, id: "mutation-after" };
    const sendMutation = vi.fn().mockRejectedValueOnce(retryableError);

    const result = await replayPendingPlanningMutations({
      mutations: [baseMutation, pendingAfterRetry],
      sendMutation,
      getErrorMessage: (error) => (error instanceof Error ? error.message : "error"),
      classifyError: () => "network",
      now: () => new Date("2026-05-23T00:00:00.000Z"),
    });

    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(result.stoppedForRetryableError).toBe(true);
    expect(result.retryableError).toBe(retryableError);
    expect(result.retryableErrorMessage).toBe("Invalid session");
    expect(result.nextQueue[0]).toMatchObject({
      ...baseMutation,
      attempts: 1,
      failureReason: "network",
      lastError: "Invalid session",
      nextRetryAt: "2026-05-23T00:00:30.000Z",
    });
    expect(result.nextQueue[1]).toEqual(pendingAfterRetry);
  });

  it("retries assignment replay without sending an already synced core again", async () => {
    const retryableError = new Error("Network offline");
    const mutation: PendingPlanningMutation = {
      ...baseMutation,
      assignmentPayload: [],
    };
    const sendMutation = vi.fn().mockResolvedValueOnce({ item: { id: 123 } });
    const replayAssignmentPayload = vi.fn().mockRejectedValueOnce(retryableError);

    const firstResult = await replayPendingPlanningMutations({
      mutations: [mutation],
      sendMutation,
      replayAssignmentPayload,
      getErrorMessage: (error) => (error instanceof Error ? error.message : "error"),
      classifyError: () => "network",
    });

    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(replayAssignmentPayload).toHaveBeenCalledWith(
      expect.objectContaining({ id: mutation.id, status: "syncing", syncedPlanningItemId: 123, attempts: 1 }),
      { item: { id: 123 } }
    );
    expect(firstResult.nextQueue[0]).toMatchObject({ ...mutation, syncedPlanningItemId: 123, attempts: 1 });

    replayAssignmentPayload.mockReset();
    replayAssignmentPayload.mockResolvedValueOnce(undefined);
    const secondResult = await replayPendingPlanningMutations({
      mutations: firstResult.nextQueue.map((queued) => ({ ...queued, nextRetryAt: undefined })),
      sendMutation,
      replayAssignmentPayload,
      getErrorMessage: (error) => (error instanceof Error ? error.message : "error"),
      classifyError: () => "network",
    });

    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(replayAssignmentPayload).toHaveBeenCalledWith(
      expect.objectContaining({ id: mutation.id, status: "syncing", syncedPlanningItemId: 123 }),
      { item: { id: 123 } }
    );
    expect(secondResult.syncedCount).toBe(1);
    expect(secondResult.nextQueue).toEqual([]);
  });

  it("marks 403-style permission revocations as failed without retry", async () => {
    const result = await replayPendingPlanningMutations({
      mutations: [baseMutation],
      sendMutation: vi.fn().mockRejectedValueOnce(new Error("Forbidden")),
      getErrorMessage: () => "Permiso retirado",
      classifyError: () => "permission_revoked",
    });

    expect(result.stoppedForRetryableError).toBe(false);
    expect(result.nextQueue[0]).toMatchObject({
      status: "failed",
      failureReason: "permission_revoked",
      lastError: "Permiso retirado",
      attempts: 1,
    });
  });

  it("keeps server and local snapshots for concurrency conflicts", async () => {
    const currentServerItem = { id: 42, updated_at: "server-version" };
    const result = await replayPendingPlanningMutations({
      mutations: [{ ...baseMutation, method: "PATCH", payload: { id: 42, item_date: "2026-05-23" } }],
      sendMutation: vi.fn().mockRejectedValueOnce(new Error("Conflict")),
      getErrorMessage: () => "El registro cambio",
      classifyError: () => "concurrency_conflict",
      loadServerConflictSnapshot: vi.fn().mockResolvedValueOnce(currentServerItem),
    });

    expect(result.foundConflict).toBe(true);
    expect(result.nextQueue[0]).toMatchObject({
      status: "conflict",
      failureReason: "concurrency_conflict",
      conflictSnapshot: {
        localPayload: { id: 42, item_date: "2026-05-23" },
        serverItem: currentServerItem,
      },
    });
  });

  it("does not retry mutations before nextRetryAt", () => {
    const queue: PendingPlanningMutation[] = [
      { ...baseMutation, id: "later", nextRetryAt: "2999-01-01T00:00:00.000Z" },
      { ...baseMutation, id: "ready", nextRetryAt: "2000-01-01T00:00:00.000Z" },
      { ...baseMutation, id: "failed", status: "failed" },
    ];

    expect(getRetryablePlanningMutations(queue).map((mutation) => mutation.id)).toEqual(["ready"]);
    expect(getNextRetryAt(3, new Date("2026-05-23T00:00:00.000Z"))).toBe("2026-05-23T00:02:00.000Z");
  });
});
