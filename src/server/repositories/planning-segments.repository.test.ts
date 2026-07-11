import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/db/supabase", () => ({
  getSupabaseServerClient: () => ({
    rpc: mocks.rpc,
  }),
}));

describe("planning segments repository", () => {
  it("reconciles real execution segments through the transactional RPC", async () => {
    vi.resetAllMocks();
    const rows = [{
      id: 456,
      planning_item_id: 123,
      activity_group_id: "group-1",
      item_date: "2026-06-01",
      start_time: "18:00:00",
      end_time: "20:00:00",
      shift: "Dia",
      category: "actividad",
      item_type: "unitaria",
      description: "Perforacion real",
      notes: null,
      segment_order: 1,
      client_mutation_id: "real-1",
    }];
    mocks.rpc.mockResolvedValue({ data: rows, error: null });
    const { reconcileRealExecutionSegments } = await import("./planning-segments.repository");

    const result = await reconcileRealExecutionSegments({
      segmentId: 456,
      planningItemId: 123,
      activityGroupId: "group-1",
      segments: [{
        item_date: "2026-06-01",
        start_time: "18:00",
        end_time: "20:00",
        shift: "Dia",
        category: "actividad",
        item_type: "unitaria",
        description: "Perforacion real",
        notes: null,
      }],
      operationalHeaderValues: [{ field_id: 30, value: "Mina", option_id: 90 }],
      actorUserId: "user-1",
      actorEmail: "user@example.com",
      createdBy: "user-1",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_real_execution_segments", {
      p_segment_id: 456,
      p_planning_item_id: 123,
      p_activity_group_id: "group-1",
      p_segments: [{
        item_date: "2026-06-01",
        start_time: "18:00",
        end_time: "20:00",
        shift: "Dia",
        category: "actividad",
        item_type: "unitaria",
        description: "Perforacion real",
        notes: null,
      }],
      p_operational_header_values: [{ field_id: 30, value: "Mina", option_id: 90 }],
      p_actor_user_id: "user-1",
      p_actor_email: "user@example.com",
      p_created_by: "user-1",
    });
    expect(result).toEqual(rows);
  });

  it("propagates transactional RPC errors", async () => {
    vi.resetAllMocks();
    const error = new Error("rollback");
    mocks.rpc.mockResolvedValue({ data: null, error });
    const { reconcileRealExecutionSegments } = await import("./planning-segments.repository");

    await expect(reconcileRealExecutionSegments({
      segmentId: 456,
      planningItemId: 123,
      activityGroupId: "group-1",
      segments: [],
      createdBy: "user-1",
    })).rejects.toThrow("rollback");
  });
});
