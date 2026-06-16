import { NextResponse } from "next/server";
import { requireApprovedUser, requireOperationalUser } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import {
  isPlanningCategoryDto,
  isPlanningShiftDto,
  isPlanningTrackingTypeDto,
  normalizePlanningItemMutationPayload,
  type NormalizedPlanningItemPayloadDto,
  type PlanningItemDeleteRequestDto,
  type PlanningItemMutationPayloadDto,
  type RealSegmentRangeInputDto,
} from "@/modules/planning/contracts/planning-items";
import {
  findPlanningCatalogDetailByTypeAndLabel,
  findPlanningCatalogTypeByCategoryAndLabel,
  findPlanningLevelByLabel,
} from "@/server/repositories/planning-catalog.repository";
import { findPlannedItemSummaryByActivityGroupId } from "@/server/repositories/planning-items.repository";
import { listSegmentsForOverlap } from "@/server/repositories/planning-segments.repository";
import {
  createPlannedPlanningItem,
  createRealPlanningSegments,
  deletePlanningItem,
  listPlanningItems,
  updatePlannedPlanningItem,
  updateRealPlanningSegment,
} from "@/server/services/planning-items.service";

const REAL_SEGMENT_OVERLAP_MESSAGE =
  "Ese horario se solapa con otro evento real del mismo programado. Actualiza la planificacion y elige un espacio disponible.";

function isDatabaseOverlapError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  return /activity_execution_segments_no_overlap|exclusion constraint|conflicting key value/i.test(message);
}

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function isTimeWithinShift(time: string, shift: string) {
  const minutes = toMinutes(time);

  if (shift === "Dia") {
    return minutes >= toMinutes("08:00") && minutes <= toMinutes("20:00");
  }

  if (shift === "Noche") {
    return minutes >= toMinutes("20:00") || minutes <= toMinutes("08:00");
  }

  return false;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function toOperationalOffsetMinutes(time: string, shift: string) {
  const minutes = toMinutes(time);

  if (shift === "Dia") {
    return minutes >= toMinutes("08:00") ? minutes : minutes + 24 * 60;
  }

  return minutes >= toMinutes("20:00") ? minutes : minutes + 24 * 60;
}

function toDateBaseMinutes(dateString: string) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 60000);
}

function toTimelineRange(segment: RealSegmentRangeInputDto) {
  const baseMinutes = toDateBaseMinutes(segment.item_date);
  const start = baseMinutes + toOperationalOffsetMinutes(segment.start_time, segment.shift);
  let end = baseMinutes + toOperationalOffsetMinutes(segment.end_time, segment.shift);

  if (end <= start) {
    end += 24 * 60;
  }

  return { start, end };
}

function rangesOverlap(
  left: RealSegmentRangeInputDto,
  right: RealSegmentRangeInputDto
) {
  const leftRange = toTimelineRange(left);
  const rightRange = toTimelineRange(right);

  return leftRange.start < rightRange.end && leftRange.end > rightRange.start;
}

function buildRealSegments(payload: NormalizedPlanningItemPayloadDto) {
  const startOffset = toOperationalOffsetMinutes(payload.start_time, payload.shift);
  const endOffset = toOperationalOffsetMinutes(payload.end_time, payload.shift);

  if (endOffset <= startOffset) {
    return null;
  }

  if (payload.shift === "Dia") {
    if (endOffset <= toMinutes("20:00")) {
      return [
        {
          ...payload,
          tracking_type: "real" as const,
        },
      ];
    }

    if (endOffset <= toMinutes("08:00") + 24 * 60) {
      return [
        {
          ...payload,
          shift: "Dia",
          end_time: "20:00",
          tracking_type: "real" as const,
        },
        {
          ...payload,
          item_date: payload.item_date,
          shift: "Noche",
          start_time: "20:00",
          end_time: payload.end_time,
          tracking_type: "real" as const,
        },
      ];
    }

    return null;
  }

  if (endOffset <= toMinutes("08:00") + 24 * 60) {
    return [
      {
        ...payload,
        tracking_type: "real" as const,
      },
    ];
  }

  if (endOffset <= toMinutes("20:00") + 24 * 60) {
    return [
      {
        ...payload,
        shift: "Noche",
        end_time: "08:00",
        tracking_type: "real" as const,
      },
      {
        ...payload,
        item_date: addDays(payload.item_date, 1),
        shift: "Dia",
        start_time: "08:00",
        end_time: payload.end_time,
        tracking_type: "real" as const,
      },
    ];
  }

  return null;
}

async function validateCatalogSelection(payload: NormalizedPlanningItemPayloadDto) {
  const selectedLevel = await findPlanningLevelByLabel(payload.level);

  if (!selectedLevel) {
    return NextResponse.json(
      { error: "El nivel seleccionado no es valido." },
      { status: 400 }
    );
  }

  const selectedType = await findPlanningCatalogTypeByCategoryAndLabel(
    payload.category,
    payload.item_type
  );

  if (!selectedType) {
    return NextResponse.json(
      { error: "La combinacion entre categoria, tipo y descripcion no es valida." },
      { status: 400 }
    );
  }

  const selectedDetail = await findPlanningCatalogDetailByTypeAndLabel(
    selectedType.id,
    payload.description
  );

  if (!selectedDetail) {
    return NextResponse.json(
      { error: "La combinacion entre categoria, tipo y descripcion no es valida." },
      { status: 400 }
    );
  }

  return null;
}

function toPlanningItemUpdatePayload(payload: NormalizedPlanningItemPayloadDto) {
  return {
    activity_group_id: payload.activity_group_id,
    item_date: payload.item_date,
    start_time: payload.start_time,
    end_time: payload.end_time,
    shift: payload.shift,
    level: payload.level,
    front: payload.front,
    category: payload.category,
    tracking_type: payload.tracking_type,
    item_type: payload.item_type,
    description: payload.description,
    notes: payload.notes,
  };
}

async function validateRealSegmentsDoNotOverlap(
  activityGroupId: string,
  segments: RealSegmentRangeInputDto[],
  excludedSegmentId?: number
) {
  const existingSegments = await listSegmentsForOverlap(activityGroupId);
  const comparableExistingSegments = (existingSegments ?? []).filter(
    (segment) => Number(segment.id) !== excludedSegmentId
  );

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    for (let nextIndex = index + 1; nextIndex < segments.length; nextIndex += 1) {
      if (rangesOverlap(segment, segments[nextIndex])) {
        return NextResponse.json(
          { error: "Los eventos reales de una misma programacion no pueden solaparse." },
          { status: 400 }
        );
      }
    }

    const overlappingSegment = comparableExistingSegments.find((existingSegment) =>
      rangesOverlap(segment, {
        id: Number(existingSegment.id),
        item_date: String(existingSegment.item_date),
        start_time: String(existingSegment.start_time),
        end_time: String(existingSegment.end_time),
        shift: String(existingSegment.shift),
      })
    );

    if (overlappingSegment) {
      return NextResponse.json(
        { error: REAL_SEGMENT_OVERLAP_MESSAGE },
        { status: 400 }
      );
    }
  }

  return null;
}

async function validateAndNormalizePlanningItem(
  req: Request,
  body: PlanningItemMutationPayloadDto
) {
  const { user, profile } = await requireOperationalUser(req);
  const payload = normalizePlanningItemMutationPayload(body);

  if (
    !payload.item_date ||
    !payload.start_time ||
    !payload.end_time ||
    !payload.shift ||
    !payload.level ||
    !payload.front ||
    !payload.category ||
    !payload.tracking_type ||
    !payload.item_type ||
    !payload.description
  ) {
    return {
      errorResponse: NextResponse.json(
        { error: "Completa fecha, horario, turno, nivel, frente, categoria, vista, tipo y descripcion." },
        { status: 400 }
      ),
    };
  }

  if (!isPlanningCategoryDto(payload.category)) {
    return {
      errorResponse: NextResponse.json(
        { error: "La categoria debe ser actividad o interferencia." },
        { status: 400 }
      ),
    };
  }

  if (!isPlanningTrackingTypeDto(payload.tracking_type)) {
    return {
      errorResponse: NextResponse.json(
        { error: "La vista debe ser programado o real." },
        { status: 400 }
      ),
    };
  }

  if (payload.tracking_type === "programado" && payload.category !== "actividad") {
    return {
      errorResponse: NextResponse.json(
        { error: "La programacion solo permite actividades. Las interferencias se registran en lo real." },
        { status: 400 }
      ),
    };
  }

  if (!isPlanningShiftDto(payload.shift)) {
    return {
      errorResponse: NextResponse.json(
        { error: "El turno debe ser Dia o Noche." },
        { status: 400 }
      ),
    };
  }

  const isReal = payload.tracking_type === "real";

  if (!isReal && (!isTimeWithinShift(payload.start_time, payload.shift) || !isTimeWithinShift(payload.end_time, payload.shift))) {
    return {
      errorResponse: NextResponse.json(
        { error: "El horario debe estar dentro de la ventana del turno seleccionado." },
        { status: 400 }
      ),
    };
  }

  if (payload.start_time === payload.end_time) {
    return {
      errorResponse: NextResponse.json(
        { error: "La hora de termino debe ser distinta a la hora de inicio." },
        { status: 400 }
      ),
    };
  }

  if (!isReal && payload.shift === "Dia" && payload.end_time <= payload.start_time) {
    return {
      errorResponse: NextResponse.json(
        { error: "En turno Dia la hora de termino debe ser mayor a la hora de inicio." },
        { status: 400 }
      ),
    };
  }

  if (isReal && !buildRealSegments(payload)) {
    return {
      errorResponse: NextResponse.json(
        { error: "El real solo puede extenderse al turno inmediatamente siguiente." },
        { status: 400 }
      ),
    };
  }

  const catalogError = await validateCatalogSelection(payload);
  if (catalogError) {
    return { errorResponse: catalogError };
  }

  let plannedItem: { id: number; activity_group_id: string } | null = null;

  if (payload.tracking_type === "real") {
    const data = await findPlannedItemSummaryByActivityGroupId(payload.activity_group_id);

    if (!data) {
      return {
        errorResponse: NextResponse.json(
          { error: "Solo puedes registrar lo real cuando la programacion ya existe para esa actividad." },
          { status: 400 }
        ),
      };
    }

    plannedItem = data;
  }

  return { payload, user, profile, plannedItem };
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date")?.trim() ?? "";

    return NextResponse.json(await listPlanningItems(date));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PlanningItemMutationPayloadDto;
    const result = await validateAndNormalizePlanningItem(req, body);
    if ("errorResponse" in result) {
      return result.errorResponse;
    }
    const { payload, user, profile, plannedItem } = result;

    if (payload.tracking_type === "programado") {
      const plannedResult = await createPlannedPlanningItem({
        actor: { user, profile },
        userId: user.id,
        payload,
      });

      return NextResponse.json(
        { item: plannedResult.item },
        { status: plannedResult.status === "existing" ? 200 : 201 }
      );
    }

    const segments = buildRealSegments(payload) ?? [];

    const realResult = await createRealPlanningSegments({
      actor: { user, profile },
      userId: user.id,
      payload,
      plannedItem,
      segments,
      validateOverlap: () =>
        validateRealSegmentsDoNotOverlap(payload.activity_group_id, segments),
    });

    if (realResult.status === "overlap") {
      return realResult.response;
    }

    if (realResult.status === "insert-error") {
      if (segments.length > 1 && /segment_order|column/i.test(realResult.error.message ?? "")) {
        const message =
          "Para registrar un real que cruza turnos necesitamos que la API reconozca `segment_order`. Asegura que la migracion de `activity_execution_segments` se ejecuto en este proyecto y luego refresca el schema cache con: select pg_notify('pgrst', 'reload schema');";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      if (isDatabaseOverlapError(realResult.error)) {
        return NextResponse.json({ error: REAL_SEGMENT_OVERLAP_MESSAGE }, { status: 409 });
      }

      throw realResult.error;
    }

    return NextResponse.json(
      { item: realResult.item, items: realResult.items },
      { status: realResult.status === "existing" ? 200 : 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as PlanningItemMutationPayloadDto;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }
    const result = await validateAndNormalizePlanningItem(req, body);
    if ("errorResponse" in result) {
      return result.errorResponse;
    }
    const { payload, user, profile, plannedItem } = result;

    if (payload.tracking_type === "programado") {
      const updatePayload = toPlanningItemUpdatePayload(payload);
      const { item } = await updatePlannedPlanningItem({
        actor: { user, profile },
        id,
        updatePayload,
      });

      return NextResponse.json({ item });
    }

    const realSegments = buildRealSegments(payload) ?? [];

    if (realSegments.length !== 1) {
      return NextResponse.json(
        { error: "Para cruzar de turno, crea un nuevo evento real en el espacio correspondiente." },
        { status: 400 }
      );
    }

    const overlapError = await validateRealSegmentsDoNotOverlap(
      payload.activity_group_id,
      realSegments,
      id
    );

    if (overlapError) {
      return overlapError;
    }

    const realResult = await updateRealPlanningSegment({
      actor: { user, profile },
      id,
      updatePayload: {
        planning_item_id: plannedItem?.id,
        activity_group_id: payload.activity_group_id,
        item_date: payload.item_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        shift: payload.shift,
        level: payload.level,
        front: payload.front,
        category: payload.category,
        item_type: payload.item_type,
        description: payload.description,
        notes: payload.notes,
      },
    });

    if (realResult.status === "update-error") {
      if (isDatabaseOverlapError(realResult.error)) {
        return NextResponse.json({ error: REAL_SEGMENT_OVERLAP_MESSAGE }, { status: 409 });
      }

      throw realResult.error;
    }

    return NextResponse.json({ item: realResult.item });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireOperationalUser(req);
    const body = (await req.json()) as PlanningItemDeleteRequestDto;
    const id = Number(body.id);
    const trackingType = String(body.tracking_type ?? "").trim().toLowerCase();

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }

    if (!["programado", "real"].includes(trackingType)) {
      return NextResponse.json({ error: "Debes indicar si eliminas programado o real." }, { status: 400 });
    }

    const result = await deletePlanningItem({
      actor: { user, profile },
      id,
      trackingType,
    });

    if (result.status === "blocked-by-real") {
      return NextResponse.json(
        { error: "No puedes eliminar la programacion mientras exista un real asociado a esa actividad." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
