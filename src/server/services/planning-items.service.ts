import "server-only";

import type {
  NormalizedPlanningItemPayloadDto,
  PlanningItemDto,
} from "@/modules/planning/contracts/planning-items";
import {
  deletePlannedItemById,
  findPlannedItemById,
  findPlannedItemByClientMutationId,
  insertPlannedItem,
  listPlannedItemsByActivityGroupIds,
  listPlannedItemsByDate,
  updatePlannedItemById,
  type PlanningItemUpdateInput,
  type PlanningItemReadRow,
} from "@/server/repositories/planning-items.repository";
import { writeAuditLog } from "@/lib/auditLog";
import {
  deleteExecutionSegmentById,
  findExecutionSegmentById,
  findSegmentsByClientMutationId,
  getNextSegmentOrder,
  hasExecutionSegmentForPlanningItem,
  insertExecutionSegments,
  listExecutionSegmentsByDate,
  reconcileRealExecutionSegments,
  updateExecutionSegmentById,
  type PlanningSegmentReadRow,
  type PlanningSegmentUpdateRow,
} from "@/server/repositories/planning-segments.repository";
import {
  listOperationalHeaderFields,
  listOperationalHeaderValuesByExecutionSegmentIds,
  listOperationalHeaderValuesByPlanningItemIds,
  syncDynamicOperationalHeaderForExecutionSegment,
  syncDynamicOperationalHeaderForPlanningItem,
} from "@/server/services/operational-header.service";

type PlanningItemResponse = PlanningItemDto;
type PlanningItemPayload = NormalizedPlanningItemPayloadDto;

type AuditActor = Parameters<typeof writeAuditLog>[0]["actor"];

function mapPlanningReadRow(
  row: Omit<PlanningItemResponse, "tracking_type"> & { tracking_type?: "programado" | "real" }
): PlanningItemResponse {
  const item: PlanningItemResponse = {
    id: row.id,
    activity_group_id: row.activity_group_id,
    item_date: row.item_date,
    start_time: row.start_time,
    end_time: row.end_time,
    shift: row.shift,
    category: row.category,
    tracking_type: row.tracking_type ?? "programado",
    item_type: row.item_type,
    description: row.description,
    notes: row.notes ?? null,
  };

  if (row.operational_header_values !== undefined) {
    item.operational_header_values = row.operational_header_values;
  }

  return item;
}

export async function listPlanningItems(date: string) {
  const executionSegments = await listExecutionSegmentsByDate(date);
  const executionGroupIds = Array.from(
    new Set(executionSegments.map((segment) => segment.activity_group_id).filter(Boolean))
  );

  const planningByDate = await listPlannedItemsByDate(date);
  const relatedPlanning = await listPlannedItemsByActivityGroupIds(executionGroupIds);

  const planningMap = new Map<number, PlanningItemReadRow>();

  for (const row of planningByDate) {
    planningMap.set(row.id, row);
  }

  for (const row of relatedPlanning) {
    planningMap.set(row.id, row);
  }

  const planningItems = Array.from(planningMap.values());
  const [planningOperationalHeaderValues, segmentOperationalHeaderValues] = await Promise.all([
    listOperationalHeaderValuesByPlanningItemIds(planningItems.map((item) => item.id)),
    listOperationalHeaderValuesByExecutionSegmentIds(executionSegments.map((segment) => segment.id)),
  ]);
  const operationalHeaderValues = [...planningOperationalHeaderValues, ...segmentOperationalHeaderValues];
  const operationalHeaderFields = operationalHeaderValues.length
    ? await listOperationalHeaderFields({ activeOnly: false })
    : [];
  const operationalHeaderOptionsById = new Map(
    operationalHeaderFields.flatMap((field) => field.options.map((option) => [option.id, option] as const))
  );
  const operationalHeaderValuesByPlanningItemId = new Map<number, PlanningItemResponse["operational_header_values"]>();
  const operationalHeaderValuesByExecutionSegmentId = new Map<number, PlanningItemResponse["operational_header_values"]>();

  for (const value of operationalHeaderValues) {
    if (!value.planning_item_id) {
      continue;
    }

    operationalHeaderValuesByPlanningItemId.set(value.planning_item_id, [
      ...(operationalHeaderValuesByPlanningItemId.get(value.planning_item_id) ?? []),
      {
        field_id: value.field_id,
        value: value.option_id
          ? operationalHeaderOptionsById.get(value.option_id)?.label ?? operationalHeaderOptionsById.get(value.option_id)?.value ?? ""
          : value.value_text ?? "",
        option_id: value.option_id,
      },
    ]);
  }

  for (const value of operationalHeaderValues) {
    if (!value.execution_segment_id) {
      continue;
    }

    operationalHeaderValuesByExecutionSegmentId.set(value.execution_segment_id, [
      ...(operationalHeaderValuesByExecutionSegmentId.get(value.execution_segment_id) ?? []),
      {
        field_id: value.field_id,
        value: value.option_id
          ? operationalHeaderOptionsById.get(value.option_id)?.label ?? operationalHeaderOptionsById.get(value.option_id)?.value ?? ""
          : value.value_text ?? "",
        option_id: value.option_id,
      },
    ]);
  }

  const items = [
    ...planningItems.map((row) => mapPlanningReadRow({
      ...row,
      operational_header_values: operationalHeaderValuesByPlanningItemId.get(row.id) ?? [],
    })),
    ...(executionSegments.map((row: PlanningSegmentReadRow) =>
      mapPlanningReadRow({
        ...row,
        tracking_type: "real",
        operational_header_values: operationalHeaderValuesByExecutionSegmentId.get(row.id) ?? [],
      })
    ) as PlanningItemResponse[]),
  ].sort((left, right) => `${left.item_date}-${left.start_time}`.localeCompare(`${right.item_date}-${right.start_time}`));

  return { items };
}

export async function createPlannedPlanningItem(input: {
  actor: AuditActor;
  userId: string;
  payload: PlanningItemPayload;
}) {
  if (input.payload.client_mutation_id) {
    const existingItem = await findPlannedItemByClientMutationId(
      input.payload.client_mutation_id
    );

    if (existingItem) {
      return {
        status: "existing" as const,
        item: mapPlanningReadRow(existingItem),
      };
    }
  }

  const { operational_header_values: operationalHeaderValues, ...corePayload } = input.payload;
  const item = await insertPlannedItem({
    created_by: input.userId,
    ...corePayload,
  });

  await syncDynamicOperationalHeaderForPlanningItem({
    planningItemId: item.id,
    activityGroupId: item.activity_group_id,
    values: operationalHeaderValues ?? [],
  });

  await writeAuditLog({
    actor: input.actor,
    action: "planning_item.created",
    entityType: "planning_item",
    entityId: item.id,
    after: item,
  });

  return {
    status: "created" as const,
    item: mapPlanningReadRow(item),
  };
}

export async function createRealPlanningSegments(input: {
  actor: AuditActor;
  userId: string;
  payload: PlanningItemPayload;
  plannedItem: { id: number; activity_group_id: string } | null;
  segments: PlanningItemPayload[];
  validateOverlap: () => Promise<Response | null>;
}) {
  if (input.payload.client_mutation_id) {
    const existingSegments = await findSegmentsByClientMutationId(
      input.payload.client_mutation_id
    );

    if (existingSegments.length) {
      return {
        status: "existing" as const,
        item: mapPlanningReadRow({
          ...existingSegments[0],
          tracking_type: "real",
        }),
        items: existingSegments.map((row) =>
          mapPlanningReadRow({
            ...row,
            tracking_type: "real",
          })
        ),
      };
    }
  }

  const overlapResponse = await input.validateOverlap();
  if (overlapResponse) {
    return {
      status: "overlap" as const,
      response: overlapResponse,
    };
  }

  const baseSegmentOrder = await getNextSegmentOrder(input.payload.activity_group_id);
  const { data, error } = await insertExecutionSegments(
    input.segments.map((segment, index) => ({
      planning_item_id: input.plannedItem?.id,
      activity_group_id: segment.activity_group_id,
      item_date: segment.item_date,
      start_time: segment.start_time,
      end_time: segment.end_time,
      shift: segment.shift,
      category: segment.category,
      item_type: segment.item_type,
      description: segment.description,
      notes: segment.notes,
      client_mutation_id: input.payload.client_mutation_id,
      created_by: input.userId,
      segment_order: baseSegmentOrder + index,
    }))
  );

  if (error) {
    return {
      status: "insert-error" as const,
      error,
    };
  }

  await Promise.all((data ?? []).map((segment) =>
    syncDynamicOperationalHeaderForExecutionSegment({
      executionSegmentId: segment.id,
      activityGroupId: segment.activity_group_id,
      values: input.payload.operational_header_values ?? [],
    })
  ));

  await writeAuditLog({
    actor: input.actor,
    action: "activity_execution_segment.created",
    entityType: "activity_execution_segment",
    entityId: data?.[0]?.id ?? null,
    after: data ?? [],
    metadata: {
      count: data?.length ?? 0,
      activity_group_id: input.payload.activity_group_id,
    },
  });

  return {
    status: "created" as const,
    item: mapPlanningReadRow({
      ...(data?.[0] as Omit<PlanningItemResponse, "tracking_type">),
      tracking_type: "real",
    }),
    items: (data ?? []).map((row) =>
      mapPlanningReadRow({
        ...row,
        tracking_type: "real",
      })
    ),
  };
}

export async function updatePlannedPlanningItem(input: {
  actor: AuditActor;
  id: number;
  updatePayload: PlanningItemUpdateInput;
  operationalHeaderValues?: PlanningItemPayload["operational_header_values"];
}) {
  const beforeData = await findPlannedItemById(input.id);
  const item = await updatePlannedItemById(input.id, input.updatePayload);

  await syncDynamicOperationalHeaderForPlanningItem({
    planningItemId: item.id,
    activityGroupId: item.activity_group_id,
    values: input.operationalHeaderValues ?? [],
  });

  await writeAuditLog({
    actor: input.actor,
    action: "planning_item.updated",
    entityType: "planning_item",
    entityId: item.id,
    before: beforeData,
    after: item,
  });

  return {
    item: mapPlanningReadRow(item),
  };
}

export async function updateRealPlanningSegment(input: {
  actor: AuditActor;
  id: number;
  updatePayload: PlanningSegmentUpdateRow;
  operationalHeaderValues?: PlanningItemPayload["operational_header_values"];
}) {
  const beforeData = await findExecutionSegmentById(input.id);
  const { data, error } = await updateExecutionSegmentById(
    input.id,
    input.updatePayload
  );

  if (error) {
    return {
      status: "update-error" as const,
      error,
    };
  }

  if (!data) {
    throw new Error("No se pudo actualizar el segmento real.");
  }

  await syncDynamicOperationalHeaderForExecutionSegment({
    executionSegmentId: data.id,
    activityGroupId: data.activity_group_id,
    values: input.operationalHeaderValues ?? [],
  });

  await writeAuditLog({
    actor: input.actor,
    action: "activity_execution_segment.updated",
    entityType: "activity_execution_segment",
    entityId: data.id,
    before: beforeData,
    after: data,
  });

  return {
    status: "updated" as const,
    item: mapPlanningReadRow({
      ...data,
      tracking_type: "real",
    }),
  };
}

export async function updateRealPlanningSegments(input: {
  actor: AuditActor;
  id: number;
  userId: string;
  updatePayload: PlanningSegmentUpdateRow;
  segments: PlanningItemPayload[];
  operationalHeaderValues?: PlanningItemPayload["operational_header_values"];
}) {
  let updatedSegments: PlanningSegmentReadRow[];

  try {
    updatedSegments = await reconcileRealExecutionSegments({
      segmentId: input.id,
      planningItemId: input.updatePayload.planning_item_id,
      activityGroupId: input.updatePayload.activity_group_id,
      segments: input.segments.map((segment) => ({
        item_date: segment.item_date,
        start_time: segment.start_time,
        end_time: segment.end_time,
        shift: segment.shift,
        category: segment.category,
        item_type: segment.item_type,
        description: segment.description,
        notes: segment.notes,
      })),
      operationalHeaderValues: input.operationalHeaderValues ?? [],
      actorUserId: input.actor?.profile?.user_id ?? input.actor?.user?.id ?? null,
      actorEmail: input.actor?.profile?.email ?? input.actor?.user?.email ?? null,
      createdBy: input.userId,
    });
  } catch (error) {
    return {
      status: "update-error" as const,
      error,
    };
  }

  if (!updatedSegments.length) {
    throw new Error("No se pudo actualizar el segmento real.");
  }

  return {
    status: "updated" as const,
    item: mapPlanningReadRow({
      ...(updatedSegments[0] as Omit<PlanningItemResponse, "tracking_type">),
      tracking_type: "real",
    }),
    items: updatedSegments.map((row) =>
      mapPlanningReadRow({
        ...row,
        tracking_type: "real",
      })
    ),
  };
}

export async function deletePlanningItem(input: {
  actor: AuditActor;
  id: number;
  trackingType: string;
}) {
  if (input.trackingType === "programado") {
    const currentItem = await findPlannedItemById(input.id);

    if (!currentItem) {
      return { status: "deleted" as const };
    }

    const hasRealSegments = await hasExecutionSegmentForPlanningItem(currentItem.id);

    if (hasRealSegments) {
      return { status: "blocked-by-real" as const };
    }

    await deletePlannedItemById(input.id);

    await writeAuditLog({
      actor: input.actor,
      action: "planning_item.deleted",
      entityType: "planning_item",
      entityId: input.id,
      before: currentItem,
    });

    return { status: "deleted" as const };
  }

  const currentSegment = await findExecutionSegmentById(input.id);

  if (!currentSegment) {
    return { status: "deleted" as const };
  }

  await deleteExecutionSegmentById(input.id);

  await writeAuditLog({
    actor: input.actor,
    action: "activity_execution_segment.deleted",
    entityType: "activity_execution_segment",
    entityId: input.id,
    before: currentSegment,
  });

  return { status: "deleted" as const };
}
