import { describe, expect, it, vi } from "vitest";
import type { PlanningItemReadRow } from "@/server/repositories/planning-items.repository";
import type { PlanningSegmentReadRow } from "@/server/repositories/planning-segments.repository";

const mocks = vi.hoisted(() => ({
  writeAuditLog: vi.fn(),
  findPlannedItemByClientMutationId: vi.fn(),
  insertPlannedItem: vi.fn(),
  findPlannedItemById: vi.fn(),
  updatePlannedItemById: vi.fn(),
  syncDynamicOperationalHeaderForPlanningItem: vi.fn(),
  syncDynamicOperationalHeaderForExecutionSegment: vi.fn(),
  listOperationalHeaderFields: vi.fn(),
  listOperationalHeaderValuesByPlanningItemIds: vi.fn(),
  listOperationalHeaderValuesByExecutionSegmentIds: vi.fn(),
  listExecutionSegmentsByDate: vi.fn(),
  listPlannedItemsByDate: vi.fn(),
  listPlannedItemsByActivityGroupIds: vi.fn(),
  findSegmentsByClientMutationId: vi.fn(),
  getNextSegmentOrder: vi.fn(),
  insertExecutionSegments: vi.fn(),
  findExecutionSegmentById: vi.fn(),
  updateExecutionSegmentById: vi.fn(),
  reconcileRealExecutionSegments: vi.fn(),
  hasExecutionSegmentForPlanningItem: vi.fn(),
  deletePlannedItemById: vi.fn(),
  deleteExecutionSegmentById: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auditLog", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/server/repositories/planning-items.repository", () => ({
  findPlannedItemByClientMutationId: mocks.findPlannedItemByClientMutationId,
  insertPlannedItem: mocks.insertPlannedItem,
  findPlannedItemById: mocks.findPlannedItemById,
  updatePlannedItemById: mocks.updatePlannedItemById,
  listPlannedItemsByDate: mocks.listPlannedItemsByDate,
  listPlannedItemsByActivityGroupIds: mocks.listPlannedItemsByActivityGroupIds,
  deletePlannedItemById: mocks.deletePlannedItemById,
}));

vi.mock("@/server/repositories/planning-segments.repository", () => ({
  listExecutionSegmentsByDate: mocks.listExecutionSegmentsByDate,
  findSegmentsByClientMutationId: mocks.findSegmentsByClientMutationId,
  getNextSegmentOrder: mocks.getNextSegmentOrder,
  insertExecutionSegments: mocks.insertExecutionSegments,
  findExecutionSegmentById: mocks.findExecutionSegmentById,
  updateExecutionSegmentById: mocks.updateExecutionSegmentById,
  reconcileRealExecutionSegments: mocks.reconcileRealExecutionSegments,
  hasExecutionSegmentForPlanningItem: mocks.hasExecutionSegmentForPlanningItem,
  deleteExecutionSegmentById: mocks.deleteExecutionSegmentById,
}));

vi.mock("@/server/services/operational-header.service", () => ({
  listOperationalHeaderFields: mocks.listOperationalHeaderFields,
  listOperationalHeaderValuesByExecutionSegmentIds: mocks.listOperationalHeaderValuesByExecutionSegmentIds,
  listOperationalHeaderValuesByPlanningItemIds: mocks.listOperationalHeaderValuesByPlanningItemIds,
  syncDynamicOperationalHeaderForExecutionSegment: mocks.syncDynamicOperationalHeaderForExecutionSegment,
  syncDynamicOperationalHeaderForPlanningItem: mocks.syncDynamicOperationalHeaderForPlanningItem,
}));

const actor = {
  user: { id: "user-1", email: "user@example.com" },
  profile: {
    user_id: "user-1",
    email: "user@example.com",
    full_name: "User",
    role: "operator",
    active: true,
    approval_status: "approved",
  },
} as const;

const plannedRow: PlanningItemReadRow = {
  id: 123,
  activity_group_id: "group-1",
  item_date: "2026-06-01",
  start_time: "08:00:00",
  end_time: "10:00:00",
  shift: "Dia",
  category: "actividad",
  tracking_type: "programado",
  item_type: "unitaria",
  description: "Perforacion",
  notes: null,
};

const segmentRow: PlanningSegmentReadRow = {
  id: 456,
  activity_group_id: "group-1",
  item_date: "2026-06-01",
  start_time: "08:30:00",
  end_time: "09:45:00",
  shift: "Dia",
  category: "actividad",
  item_type: "unitaria",
  description: "Perforacion real",
  notes: null,
};

const payload = {
  activity_group_id: "group-1",
  client_mutation_id: null,
  item_date: "2026-06-01",
  start_time: "08:00",
  end_time: "10:00",
  shift: "Dia",
  category: "actividad",
  tracking_type: "programado",
  item_type: "unitaria",
  description: "Perforacion",
  notes: null,
  operational_header_values: [],
};

describe("planning items operational header sync", () => {
  it("syncs operational header values after creating a planning item without changing the public response", async () => {
    vi.resetAllMocks();
    mocks.insertPlannedItem.mockResolvedValue(plannedRow);
    mocks.syncDynamicOperationalHeaderForPlanningItem.mockResolvedValue([]);
    const { createPlannedPlanningItem } = await import("./planning-items.service");

    const result = await createPlannedPlanningItem({
      actor,
      userId: "user-1",
      payload,
    });

    expect(mocks.syncDynamicOperationalHeaderForPlanningItem).toHaveBeenCalledWith({
      planningItemId: plannedRow.id,
      activityGroupId: plannedRow.activity_group_id,
      values: [],
    });
    expect(result).toEqual({
      status: "created",
      item: {
        id: 123,
        activity_group_id: "group-1",
        item_date: "2026-06-01",
        start_time: "08:00:00",
        end_time: "10:00:00",
        shift: "Dia",
        category: "actividad",
        tracking_type: "programado",
        item_type: "unitaria",
        description: "Perforacion",
        notes: null,
      },
    });
  });

  it("syncs operational header values after editing a planning item", async () => {
    vi.resetAllMocks();
    const updatedRow = {
      ...plannedRow,
    };
    mocks.findPlannedItemById.mockResolvedValue(plannedRow);
    mocks.updatePlannedItemById.mockResolvedValue(updatedRow);
    mocks.syncDynamicOperationalHeaderForPlanningItem.mockResolvedValue([]);
    const { updatePlannedPlanningItem } = await import("./planning-items.service");

    const result = await updatePlannedPlanningItem({
      actor,
      id: plannedRow.id,
      updatePayload: {
        ...payload,
      },
    });

    expect(mocks.syncDynamicOperationalHeaderForPlanningItem).toHaveBeenCalledWith({
      planningItemId: updatedRow.id,
      activityGroupId: updatedRow.activity_group_id,
      values: [],
    });
    expect(result.item).toMatchObject({
      id: 123,
      tracking_type: "programado",
    });
  });

  it("syncs dynamic operational header values after creating a planning item", async () => {
    vi.resetAllMocks();
    mocks.insertPlannedItem.mockResolvedValue(plannedRow);
    mocks.syncDynamicOperationalHeaderForPlanningItem.mockResolvedValue([]);
    const { createPlannedPlanningItem } = await import("./planning-items.service");

    await createPlannedPlanningItem({
      actor,
      userId: "user-1",
      payload: {
        ...payload,
        operational_header_values: [{ field_id: 30, value: "Mina" }],
      },
    });

    expect(mocks.insertPlannedItem).toHaveBeenCalledWith(expect.not.objectContaining({
      operational_header_values: expect.anything(),
    }));
    expect(mocks.syncDynamicOperationalHeaderForPlanningItem).toHaveBeenCalledWith({
      planningItemId: plannedRow.id,
      activityGroupId: plannedRow.activity_group_id,
      values: [{ field_id: 30, value: "Mina" }],
    });
  });

  it("syncs dynamic operational header values after editing a planning item", async () => {
    vi.resetAllMocks();
    mocks.findPlannedItemById.mockResolvedValue(plannedRow);
    mocks.updatePlannedItemById.mockResolvedValue(plannedRow);
    mocks.syncDynamicOperationalHeaderForPlanningItem.mockResolvedValue([]);
    const { updatePlannedPlanningItem } = await import("./planning-items.service");

    await updatePlannedPlanningItem({
      actor,
      id: plannedRow.id,
      updatePayload: payload,
      operationalHeaderValues: [{ field_id: 30, value: "Mantencion" }],
    });

    expect(mocks.syncDynamicOperationalHeaderForPlanningItem).toHaveBeenCalledWith({
      planningItemId: plannedRow.id,
      activityGroupId: plannedRow.activity_group_id,
      values: [{ field_id: 30, value: "Mantencion" }],
    });
  });

  it("syncs operational header values after creating execution segments without changing the public response", async () => {
    vi.resetAllMocks();
    mocks.getNextSegmentOrder.mockResolvedValue(1);
    mocks.insertExecutionSegments.mockResolvedValue({ data: [segmentRow], error: null });
    mocks.syncDynamicOperationalHeaderForExecutionSegment.mockResolvedValue([]);
    const { createRealPlanningSegments } = await import("./planning-items.service");

    const result = await createRealPlanningSegments({
      actor,
      userId: "user-1",
      payload: {
        ...payload,
        tracking_type: "real",
      },
      plannedItem: { id: plannedRow.id, activity_group_id: plannedRow.activity_group_id },
      segments: [{
        ...payload,
        tracking_type: "real",
      }],
      validateOverlap: () => Promise.resolve(null),
    });

    expect(mocks.syncDynamicOperationalHeaderForExecutionSegment).toHaveBeenCalledWith({
      executionSegmentId: segmentRow.id,
      activityGroupId: segmentRow.activity_group_id,
      values: [],
    });
    expect(result).toEqual({
      status: "created",
      item: {
        id: 456,
        activity_group_id: "group-1",
        item_date: "2026-06-01",
        start_time: "08:30:00",
        end_time: "09:45:00",
        shift: "Dia",
        category: "actividad",
        tracking_type: "real",
        item_type: "unitaria",
        description: "Perforacion real",
        notes: null,
      },
      items: [{
        id: 456,
        activity_group_id: "group-1",
        item_date: "2026-06-01",
        start_time: "08:30:00",
        end_time: "09:45:00",
        shift: "Dia",
        category: "actividad",
        tracking_type: "real",
        item_type: "unitaria",
        description: "Perforacion real",
        notes: null,
      }],
    });
  });

  it("syncs operational header values after editing an execution segment", async () => {
    vi.resetAllMocks();
    const updatedSegment = {
      ...segmentRow,
    };
    mocks.findExecutionSegmentById.mockResolvedValue(segmentRow);
    mocks.updateExecutionSegmentById.mockResolvedValue({ data: updatedSegment, error: null });
    mocks.syncDynamicOperationalHeaderForExecutionSegment.mockResolvedValue([]);
    const { updateRealPlanningSegment } = await import("./planning-items.service");

    const result = await updateRealPlanningSegment({
      actor,
      id: segmentRow.id,
      updatePayload: {
        planning_item_id: plannedRow.id,
        activity_group_id: segmentRow.activity_group_id,
        item_date: segmentRow.item_date,
        start_time: segmentRow.start_time,
        end_time: segmentRow.end_time,
        shift: segmentRow.shift,
        category: segmentRow.category,
        item_type: segmentRow.item_type,
        description: segmentRow.description,
        notes: segmentRow.notes,
      },
    });

    expect(mocks.syncDynamicOperationalHeaderForExecutionSegment).toHaveBeenCalledWith({
      executionSegmentId: updatedSegment.id,
      activityGroupId: updatedSegment.activity_group_id,
      values: [],
    });
    expect(result.item).toMatchObject({
      id: 456,
      tracking_type: "real",
    });
  });

  it("syncs dynamic operational header values after creating a real segment", async () => {
    vi.resetAllMocks();
    mocks.getNextSegmentOrder.mockResolvedValue(1);
    mocks.insertExecutionSegments.mockResolvedValue({ data: [segmentRow], error: null });
    mocks.syncDynamicOperationalHeaderForExecutionSegment.mockResolvedValue([]);
    const { createRealPlanningSegments } = await import("./planning-items.service");

    await createRealPlanningSegments({
      actor,
      userId: "user-1",
      payload: {
        ...payload,
        tracking_type: "real",
        operational_header_values: [{ field_id: 30, value: "Mina" }],
      },
      plannedItem: { id: plannedRow.id, activity_group_id: plannedRow.activity_group_id },
      segments: [{
        ...payload,
        tracking_type: "real",
        operational_header_values: [{ field_id: 30, value: "Mina" }],
      }],
      validateOverlap: () => Promise.resolve(null),
    });

    expect(mocks.syncDynamicOperationalHeaderForExecutionSegment).toHaveBeenCalledWith({
      executionSegmentId: segmentRow.id,
      activityGroupId: segmentRow.activity_group_id,
      values: [{ field_id: 30, value: "Mina" }],
    });
  });

  it("syncs dynamic operational header values after creating a real interference segment", async () => {
    vi.resetAllMocks();
    const interferenceSegment = {
      ...segmentRow,
      category: "interferencia" as const,
      item_type: "Interferencia",
      description: "Espera",
    };
    mocks.getNextSegmentOrder.mockResolvedValue(1);
    mocks.insertExecutionSegments.mockResolvedValue({ data: [interferenceSegment], error: null });
    mocks.syncDynamicOperationalHeaderForExecutionSegment.mockResolvedValue([]);
    const { createRealPlanningSegments } = await import("./planning-items.service");

    await createRealPlanningSegments({
      actor,
      userId: "user-1",
      payload: {
        ...payload,
        category: "interferencia",
        tracking_type: "real",
        item_type: "Interferencia",
        description: "Espera",
        operational_header_values: [{ field_id: 30, value: "Mantencion" }],
      },
      plannedItem: { id: plannedRow.id, activity_group_id: plannedRow.activity_group_id },
      segments: [{
        ...payload,
        category: "interferencia",
        tracking_type: "real",
        item_type: "Interferencia",
        description: "Espera",
        operational_header_values: [{ field_id: 30, value: "Mantencion" }],
      }],
      validateOverlap: () => Promise.resolve(null),
    });

    expect(mocks.syncDynamicOperationalHeaderForExecutionSegment).toHaveBeenCalledWith({
      executionSegmentId: interferenceSegment.id,
      activityGroupId: interferenceSegment.activity_group_id,
      values: [{ field_id: 30, value: "Mantencion" }],
    });
  });

  it("syncs dynamic operational header values after editing a real segment", async () => {
    vi.resetAllMocks();
    mocks.findExecutionSegmentById.mockResolvedValue(segmentRow);
    mocks.updateExecutionSegmentById.mockResolvedValue({ data: segmentRow, error: null });
    mocks.syncDynamicOperationalHeaderForExecutionSegment.mockResolvedValue([]);
    const { updateRealPlanningSegment } = await import("./planning-items.service");

    await updateRealPlanningSegment({
      actor,
      id: segmentRow.id,
      operationalHeaderValues: [{ field_id: 30, value: "Geologia" }],
      updatePayload: {
        planning_item_id: plannedRow.id,
        activity_group_id: segmentRow.activity_group_id,
        item_date: segmentRow.item_date,
        start_time: segmentRow.start_time,
        end_time: segmentRow.end_time,
        shift: segmentRow.shift,
        category: segmentRow.category,
        item_type: segmentRow.item_type,
        description: segmentRow.description,
        notes: segmentRow.notes,
      },
    });

    expect(mocks.syncDynamicOperationalHeaderForExecutionSegment).toHaveBeenCalledWith({
      executionSegmentId: segmentRow.id,
      activityGroupId: segmentRow.activity_group_id,
      values: [{ field_id: 30, value: "Geologia" }],
    });
  });

  it("reconciles a real edit through a single transactional repository call", async () => {
    vi.resetAllMocks();
    const firstSegment = {
      ...segmentRow,
      id: 456,
      start_time: "18:00",
      end_time: "20:00",
      shift: "Dia",
      client_mutation_id: "reconciled-real-456",
      segment_order: 1,
    };
    const secondSegment = {
      ...segmentRow,
      id: 457,
      start_time: "20:00",
      end_time: "22:00",
      shift: "Noche",
      client_mutation_id: "reconciled-real-456",
      segment_order: 10,
    };
    mocks.reconcileRealExecutionSegments.mockResolvedValue([firstSegment, secondSegment]);
    const { updateRealPlanningSegments } = await import("./planning-items.service");

    const result = await updateRealPlanningSegments({
      actor,
      id: segmentRow.id,
      userId: "user-1",
      updatePayload: {
        planning_item_id: plannedRow.id,
        activity_group_id: "group-1",
        item_date: "2026-06-01",
        start_time: "18:00",
        end_time: "22:00",
        shift: "Dia",
        category: "actividad",
        item_type: "unitaria",
        description: "Perforacion real",
        notes: null,
      },
      segments: [
        { ...payload, tracking_type: "real", start_time: "18:00", end_time: "20:00", shift: "Dia" },
        { ...payload, tracking_type: "real", start_time: "20:00", end_time: "22:00", shift: "Noche" },
      ],
      operationalHeaderValues: [{ field_id: 30, value: "Mina" }],
    });

    expect(mocks.reconcileRealExecutionSegments).toHaveBeenCalledWith({
      segmentId: segmentRow.id,
      planningItemId: plannedRow.id,
      activityGroupId: "group-1",
      segments: [
        expect.objectContaining({ start_time: "18:00", end_time: "20:00", shift: "Dia" }),
        expect.objectContaining({ start_time: "20:00", end_time: "22:00", shift: "Noche" }),
      ],
      operationalHeaderValues: [{ field_id: 30, value: "Mina" }],
      actorUserId: "user-1",
      actorEmail: "user@example.com",
      createdBy: "user-1",
    });
    expect(mocks.findExecutionSegmentById).not.toHaveBeenCalled();
    expect(mocks.updateExecutionSegmentById).not.toHaveBeenCalled();
    expect(mocks.insertExecutionSegments).not.toHaveBeenCalled();
    expect(mocks.deleteExecutionSegmentById).not.toHaveBeenCalled();
    expect(mocks.syncDynamicOperationalHeaderForExecutionSegment).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({
      action: "activity_execution_segment.updated",
    }));
    expect(result).toMatchObject({
      status: "updated",
      item: { id: 456, tracking_type: "real" },
      items: [
        { id: 456, tracking_type: "real" },
        { id: 457, tracking_type: "real" },
      ],
    });
  });

  it("returns transactional update-error when the RPC reconciliation fails", async () => {
    vi.resetAllMocks();
    const rpcError = new Error("No se puede eliminar un tramo que tiene asignaciones. Reasigna o elimina esas asignaciones antes de reducir el evento.");
    mocks.reconcileRealExecutionSegments.mockRejectedValue(rpcError);
    const { updateRealPlanningSegments } = await import("./planning-items.service");

    const result = await updateRealPlanningSegments({
      actor,
      id: segmentRow.id,
      userId: "user-1",
      updatePayload: {
        planning_item_id: plannedRow.id,
        activity_group_id: "group-1",
        item_date: "2026-06-01",
        start_time: "18:00",
        end_time: "22:00",
        shift: "Dia",
        category: "actividad",
        item_type: "unitaria",
        description: "Perforacion real",
        notes: null,
      },
      segments: [
        { ...payload, tracking_type: "real", start_time: "18:00", end_time: "20:00", shift: "Dia" },
        { ...payload, tracking_type: "real", start_time: "20:00", end_time: "22:00", shift: "Noche" },
      ],
    });

    expect(result).toEqual({ status: "update-error", error: rpcError });
    expect(mocks.updateExecutionSegmentById).not.toHaveBeenCalled();
    expect(mocks.insertExecutionSegments).not.toHaveBeenCalled();
    expect(mocks.deleteExecutionSegmentById).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalledWith(expect.objectContaining({
      action: "activity_execution_segment.updated",
    }));
  });
});
