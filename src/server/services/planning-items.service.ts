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
import {
  PlannedSyncRpcError,
  processPlannedItemSyncMutation,
} from "@/server/repositories/planned-sync.repository";
import { writeAuditLog } from "@/lib/auditLog";
import {
  deleteExecutionSegmentById,
  findExecutionSegmentById,
  getNextSegmentOrder,
  hasExecutionSegmentForPlanningItem,
  insertExecutionSegments,
  listExecutionSegmentsByDate,
  processRealSegmentCreateSyncMutation,
  processRealSegmentDeleteSyncMutation,
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

export class PlanningConcurrencyConflictError extends Error {
  status = 409;
  current: PlanningItemResponse | null;

  constructor(message: string, current: PlanningItemResponse | null = null) {
    super(message);
    this.name = "PlanningConcurrencyConflictError";
    this.current = current;
  }
}

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
    updated_at: row.updated_at,
  };

  if (row.operational_header_values !== undefined) {
    item.operational_header_values = row.operational_header_values;
  }

  return item;
}

function toPlanningOperationResponseItem(response: unknown) {
  const item = response && typeof response === "object" && "item" in response
    ? (response as { item?: unknown }).item
    : null;

  if (!item || typeof item !== "object") {
    return null;
  }

  return mapPlanningReadRow(item as Omit<PlanningItemResponse, "tracking_type"> & { tracking_type?: "programado" | "real" });
}

function mapPlannedSyncRpcError(error: unknown) {
  if (!(error instanceof PlannedSyncRpcError)) {
    throw error;
  }

  if (/sync_concurrency_conflict/i.test(error.message)) {
    throw new PlanningConcurrencyConflictError(
      "El registro fue modificado por otro usuario. Actualiza la planificacion antes de volver a editar.",
      null
    );
  }

  if (/sync_delete_blocked_by_real/i.test(error.message)) {
    return { status: "blocked-by-real" as const };
  }

  throw error;
}

function getRealSyncErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isRealSyncOverlapError(error: unknown) {
  return /solapa|solaparse/i.test(getRealSyncErrorMessage(error));
}

export async function processPlannedPlanningItemSyncMutation(input: {
  actor: AuditActor;
  userId: string;
  mutationId: string;
  operation: "create" | "update" | "delete";
  payload: PlanningItemPayload | Record<string, unknown>;
  id?: number | null;
  expectedUpdatedAt?: string | null;
}) {
  try {
    const response = await processPlannedItemSyncMutation({
      mutationId: input.mutationId,
      operation: input.operation,
      actorUserId: input.userId,
      entityId: input.id ?? null,
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      payload: input.payload,
    });

    const item = toPlanningOperationResponseItem(response);

    if (input.operation === "delete") {
      return { status: "deleted" as const, response };
    }

    if (!item) {
      throw new Error("La mutacion atomica de planning no devolvio un item valido.");
    }

    await writeAuditLog({
      actor: input.actor,
      action: input.operation === "create" ? "planning_item.created" : "planning_item.updated",
      entityType: "planning_item",
      entityId: item.id,
      after: item,
    });

    return {
      status: "applied" as const,
      item,
      response,
    };
  } catch (error) {
    const mapped = mapPlannedSyncRpcError(error);
    if (mapped) {
      return mapped;
    }
    throw error;
  }
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
    try {
      const realResponse = await processRealSegmentCreateSyncMutation({
        mutationId: input.payload.client_mutation_id,
        actorUserId: input.actor?.profile?.user_id ?? input.actor?.user?.id ?? null,
        actorEmail: input.actor?.profile?.email ?? input.actor?.user?.email ?? null,
        createdBy: input.userId,
        planningItemId: input.plannedItem?.id,
        activityGroupId: input.payload.activity_group_id,
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
        operationalHeaderValues: input.payload.operational_header_values ?? [],
      });

      return {
        status: "created" as const,
        item: mapPlanningReadRow({
          ...(realResponse.item as Omit<PlanningItemResponse, "tracking_type">),
          tracking_type: "real",
        }),
        items: realResponse.items.map((row) =>
          mapPlanningReadRow({
            ...row,
            tracking_type: "real",
          })
        ),
      };
    } catch (error) {
      if (isRealSyncOverlapError(error)) {
        return {
          status: "overlap" as const,
          response: new Response(JSON.stringify({ error: getRealSyncErrorMessage(error) }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }),
        };
      }

      if (error instanceof Error && /sync_concurrency_conflict/i.test(error.message)) {
        throw new PlanningConcurrencyConflictError(
          "El registro fue modificado por otro usuario. Actualiza la planificacion antes de volver a editar.",
          null
        );
      }

      throw error;
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
  expectedUpdatedAt?: string | null;
  operationalHeaderValues?: PlanningItemPayload["operational_header_values"];
}) {
  const beforeData = await findPlannedItemById(input.id);
  const item = await updatePlannedItemById(input.id, input.updatePayload, input.expectedUpdatedAt);

  if (!item) {
    const current = await findPlannedItemById(input.id);
    throw new PlanningConcurrencyConflictError(
      "El registro fue modificado por otro usuario. Actualiza la planificacion antes de volver a editar.",
      current ? mapPlanningReadRow(current) : null
    );
  }

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
  expectedUpdatedAt?: string | null;
  operationalHeaderValues?: PlanningItemPayload["operational_header_values"];
}) {
  const beforeData = await findExecutionSegmentById(input.id);
  if (input.expectedUpdatedAt && beforeData?.updated_at !== input.expectedUpdatedAt) {
    throw new PlanningConcurrencyConflictError(
      "El registro fue modificado por otro usuario. Actualiza la planificacion antes de volver a editar.",
      beforeData ? mapPlanningReadRow({ ...beforeData, tracking_type: "real" }) : null
    );
  }
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
  expectedUpdatedAt?: string | null;
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
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      syncMutationId: typeof input.updatePayload.client_mutation_id === "string"
        ? input.updatePayload.client_mutation_id
        : null,
    });
  } catch (error) {
    if (error instanceof Error && /sync_concurrency_conflict/i.test(error.message)) {
      const current = await findExecutionSegmentById(input.id).catch(() => null);
      throw new PlanningConcurrencyConflictError(
        "El registro fue modificado por otro usuario. Actualiza la planificacion antes de volver a editar.",
        current ? mapPlanningReadRow({ ...current, tracking_type: "real" }) : null
      );
    }

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
  expectedUpdatedAt?: string | null;
  mutationId?: string | null;
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

    const deleted = await deletePlannedItemById(input.id, input.expectedUpdatedAt);

    if (!deleted) {
      const current = await findPlannedItemById(input.id);
      throw new PlanningConcurrencyConflictError(
        "El registro fue modificado por otro usuario. Actualiza la planificacion antes de eliminar.",
        current ? mapPlanningReadRow(current) : null
      );
    }

    await writeAuditLog({
      actor: input.actor,
      action: "planning_item.deleted",
      entityType: "planning_item",
      entityId: input.id,
      before: currentItem,
    });

    return {
      status: "deleted" as const,
      deletedItem: {
        id: currentItem.id,
        trackingType: "programado" as const,
        itemDate: currentItem.item_date,
        updatedAt: currentItem.updated_at,
      },
    };
  }

  if (input.mutationId) {
    try {
      await processRealSegmentDeleteSyncMutation({
        mutationId: input.mutationId,
        segmentId: input.id,
        actorUserId: input.actor?.profile?.user_id ?? input.actor?.user?.id ?? null,
        actorEmail: input.actor?.profile?.email ?? input.actor?.user?.email ?? null,
        expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      });

      return {
        status: "deleted" as const,
        deletedItem: undefined,
      };
    } catch (error) {
      if (error instanceof Error && /sync_concurrency_conflict/i.test(error.message)) {
        const current = await findExecutionSegmentById(input.id).catch(() => null);
        throw new PlanningConcurrencyConflictError(
          "El registro fue modificado por otro usuario. Actualiza la planificacion antes de eliminar.",
          current ? mapPlanningReadRow({ ...current, tracking_type: "real" }) : null
        );
      }

      throw error;
    }
  }

  const currentSegment = await findExecutionSegmentById(input.id);

  if (!currentSegment) {
    return { status: "deleted" as const };
  }

  if (input.expectedUpdatedAt && currentSegment.updated_at !== input.expectedUpdatedAt) {
    throw new PlanningConcurrencyConflictError(
      "El registro fue modificado por otro usuario. Actualiza la planificacion antes de eliminar.",
      mapPlanningReadRow({ ...currentSegment, tracking_type: "real" })
    );
  }

  await deleteExecutionSegmentById(input.id);

  await writeAuditLog({
    actor: input.actor,
    action: "activity_execution_segment.deleted",
    entityType: "activity_execution_segment",
    entityId: input.id,
    before: currentSegment,
  });

  return {
    status: "deleted" as const,
    deletedItem: {
      id: currentSegment.id,
      trackingType: "real" as const,
      itemDate: currentSegment.item_date,
      updatedAt: currentSegment.updated_at,
    },
  };
}
