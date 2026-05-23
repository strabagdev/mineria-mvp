import { describe, expect, it, vi } from "vitest";
import {
  applyPendingPlanningMutations,
  discardConflictedPlanningMutations,
  getRetryablePlanningMutations,
  replayPendingPlanningMutations,
  toOptimisticPlanningItem,
  withClientMutationId,
} from "./planning-mutation-queue";
import type { PendingPlanningMutation } from "./planning-sync-models";

const baseMutation: PendingPlanningMutation = {
  id: "mutation-1",
  method: "POST",
  createdAt: "2026-05-23T00:00:00.000Z",
  payload: {
    activity_group_id: "group-1",
    item_date: "2026-05-23",
    start_time: "08:00",
    end_time: "10:00",
    shift: "Dia",
    level: "NTI",
    front: "GT1",
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
          level: "NTI",
          front: "GT1",
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
          method: "DELETE",
          createdAt: "2026-05-23T00:01:00.000Z",
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
      isRetryableError: () => false,
    });

    expect(sendMutation).toHaveBeenCalledTimes(2);
    expect(result.syncedCount).toBe(1);
    expect(result.foundConflict).toBe(true);
    expect(result.nextQueue).toHaveLength(1);
    expect(result.nextQueue[0]).toMatchObject({
      id: "mutation-2",
      status: "conflict",
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
      isRetryableError: () => true,
    });

    expect(sendMutation).toHaveBeenCalledTimes(1);
    expect(result.stoppedForRetryableError).toBe(true);
    expect(result.retryableError).toBe(retryableError);
    expect(result.retryableErrorMessage).toBe("Invalid session");
    expect(result.nextQueue).toEqual([baseMutation, pendingAfterRetry]);
  });
});
