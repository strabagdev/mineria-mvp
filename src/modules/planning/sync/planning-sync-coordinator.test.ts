import { describe, expect, it, vi } from "vitest";
import { PlanningSyncCoordinator } from "./planning-sync-coordinator";
import type { PendingPlanningMutation, PlanningMutationFailureReason } from "./planning-sync-models";

function makeMutation(input: Partial<PendingPlanningMutation> = {}): PendingPlanningMutation {
  const userId = input.userId ?? "user-1";

  return {
    id: input.id ?? "mutation-1",
    userId,
    scope: input.scope ?? { userId },
    method: input.method ?? "POST",
    payload: input.payload ?? {
      item_date: "2026-08-18",
      start_time: "08:00",
      end_time: "09:00",
      activity_group_id: "drill",
      category: "actividad",
      tracking_type: "programado",
      item_type: "Perforacion",
      description: "Perforacion",
    },
    createdAt: input.createdAt ?? "2026-08-18T08:00:00.000Z",
    status: input.status ?? "pending",
    attempts: input.attempts ?? 0,
    nextRetryAt: input.nextRetryAt,
    failureReason: input.failureReason,
  };
}

function createHarness(input: {
  queue?: PendingPlanningMutation[];
  scopeUserId?: string | null;
  accessToken?: string;
  canSync?: boolean;
  offline?: boolean;
  sendMutation?: (mutation: PendingPlanningMutation) => Promise<unknown>;
  classifyError?: (error: unknown) => PlanningMutationFailureReason;
}) {
  let queue = input.queue ?? [makeMutation()];
  let offline = input.offline ?? false;
  const onQueueUpdated = vi.fn((nextQueue: PendingPlanningMutation[]) => {
    queue = nextQueue;
  });
  const setSyncing = vi.fn();
  const sendMutation = vi.fn(input.sendMutation ?? (() => Promise.resolve({ item: { id: 101 } })));
  const coordinator = new PlanningSyncCoordinator({
    getMutations: () => queue,
    getScopeUserId: () => input.scopeUserId ?? "user-1",
    getAccessToken: () => input.accessToken ?? "token",
    canSync: () => input.canSync ?? true,
    isOffline: () => offline,
    sendMutation,
    getErrorMessage: (error) => error instanceof Error ? error.message : "sync failed",
    classifyError: input.classifyError ?? (() => "unknown"),
    onQueueUpdated,
    setSyncing,
  });

  return {
    coordinator,
    getQueue: () => queue,
    setQueue: (nextQueue: PendingPlanningMutation[]) => {
      queue = nextQueue;
    },
    setOffline: (nextOffline: boolean) => {
      offline = nextOffline;
    },
    onQueueUpdated,
    sendMutation,
    setSyncing,
  };
}

describe("PlanningSyncCoordinator", () => {
  it("runs only one replay at a time", async () => {
    let resolveSendMutation: (value: unknown) => void = () => undefined;
    const harness = createHarness({
      sendMutation: () => new Promise((resolve) => {
        resolveSendMutation = resolve;
      }),
    });

    const firstReplay = harness.coordinator.processPendingMutations();
    const secondReplay = harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).toHaveBeenCalledTimes(1);
    await secondReplay;
    resolveSendMutation({ item: { id: 101 } });
    await firstReplay;
    expect(harness.sendMutation).toHaveBeenCalledTimes(1);
  });

  it("processes a newly queued mutation when requested", async () => {
    const harness = createHarness({ queue: [] });

    await harness.coordinator.processPendingMutations();
    expect(harness.sendMutation).not.toHaveBeenCalled();

    harness.setQueue([makeMutation({ id: "new-mutation" })]);
    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).toHaveBeenCalledWith(expect.objectContaining({ id: "new-mutation" }));
    expect(harness.getQueue()).toEqual([]);
  });

  it("does not destroy the outbox while offline", async () => {
    const queue = [makeMutation()];
    const harness = createHarness({ queue, offline: true });

    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).not.toHaveBeenCalled();
    expect(harness.onQueueUpdated).not.toHaveBeenCalled();
    expect(harness.getQueue()).toEqual(queue);
  });

  it("processes pending mutations after reconnection", async () => {
    const harness = createHarness({ offline: true });

    await harness.coordinator.processPendingMutations();
    harness.setOffline(false);
    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).toHaveBeenCalledTimes(1);
    expect(harness.getQueue()).toEqual([]);
  });

  it("respects nextRetryAt before retrying", async () => {
    const harness = createHarness({
      queue: [makeMutation({ nextRetryAt: "2999-01-01T00:00:00.000Z" })],
    });

    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).not.toHaveBeenCalled();
    expect(harness.onQueueUpdated).not.toHaveBeenCalled();
  });

  it("does not automatically retry concurrency conflicts", async () => {
    const harness = createHarness({
      sendMutation: () => Promise.reject(new Error("conflict")),
      classifyError: () => "concurrency_conflict",
    });

    await harness.coordinator.processPendingMutations();
    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).toHaveBeenCalledTimes(1);
    expect(harness.getQueue()[0]).toMatchObject({
      status: "conflict",
      failureReason: "concurrency_conflict",
    });
  });

  it("does not retry permission revocations forever", async () => {
    const harness = createHarness({
      sendMutation: () => Promise.reject(new Error("forbidden")),
      classifyError: () => "permission_revoked",
    });

    await harness.coordinator.processPendingMutations();
    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).toHaveBeenCalledTimes(1);
    expect(harness.getQueue()[0]).toMatchObject({
      status: "failed",
      failureReason: "permission_revoked",
    });
  });

  it("does not process another user's scoped outbox", async () => {
    const otherUserMutation = makeMutation({ id: "other-user", userId: "user-2", scope: { userId: "user-2" } });
    const harness = createHarness({ queue: [otherUserMutation], scopeUserId: "user-1" });

    await harness.coordinator.processPendingMutations();

    expect(harness.sendMutation).not.toHaveBeenCalled();
    expect(harness.onQueueUpdated).not.toHaveBeenCalled();
    expect(harness.getQueue()).toEqual([otherUserMutation]);
  });
});

