import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendPlanningSyncMutation } from "./planning-writes.client";

const syncClient = vi.hoisted(() => ({
  pushSyncMutations: vi.fn(),
}));

vi.mock("@/lib/networkStatus", () => ({
  assertBrowserOnline: vi.fn(),
}));

vi.mock("@/modules/sync/sync-api.client", () => ({
  SyncApiRequestError: class SyncApiRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
  pushSyncMutations: syncClient.pushSyncMutations,
}));

describe("sendPlanningSyncMutation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    syncClient.pushSyncMutations.mockResolvedValue({ results: [{ response: { item: { id: 42 } } }] });
  });

  it("sends assignment payload as a dependent sync operation outside the core planning payload", async () => {
    const assignmentPayload = [
      { assignment_type_id: 7, instance_order: 1, values: [{ field_id: 12, value_text: "Equipo A" }] },
    ];

    await sendPlanningSyncMutation(
      "POST",
      {
        client_mutation_id: "mutation-1",
        activity_group_id: "group-1",
        item_date: "2026-08-19",
        tracking_type: "programado",
      },
      "token-1",
      assignmentPayload
    );

    expect(syncClient.pushSyncMutations).toHaveBeenCalledWith([
      expect.objectContaining({
        mutationId: "mutation-1",
        domain: "planning",
        operation: "create",
        assignmentPayload,
        payload: expect.not.objectContaining({ assignmentPayload }),
      }),
    ], "token-1");
  });
});
