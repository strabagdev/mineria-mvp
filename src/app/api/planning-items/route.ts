import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type PlanningItemPayload = {
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: string;
  tracking_type: string;
  item_type: string;
  description: string;
  notes: string | null;
};

type PlanningItemResponse = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  description: string;
  notes: string | null;
};

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

function buildRealSegments(payload: PlanningItemPayload) {
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

async function validateCatalogSelection(db: ReturnType<typeof getSupabaseServerClient>, payload: PlanningItemPayload) {
  const { data: selectedType, error: typeError } = await db
    .from("planning_catalog_types")
    .select("id")
    .eq("category", payload.category)
    .eq("label", payload.item_type)
    .maybeSingle();

  if (typeError) {
    throw typeError;
  }

  if (!selectedType) {
    return NextResponse.json(
      { error: "La combinacion entre categoria, tipo y descripcion no es valida." },
      { status: 400 }
    );
  }

  const { data: selectedDetail, error: detailError } = await db
    .from("planning_catalog_details")
    .select("id")
    .eq("type_id", selectedType.id)
    .eq("label", payload.description)
    .maybeSingle();

  if (detailError) {
    throw detailError;
  }

  if (!selectedDetail) {
    return NextResponse.json(
      { error: "La combinacion entre categoria, tipo y descripcion no es valida." },
      { status: 400 }
    );
  }

  return null;
}

function mapPlanningRow(row: Omit<PlanningItemResponse, "tracking_type"> & { tracking_type?: "programado" | "real" }): PlanningItemResponse {
  return {
    id: row.id,
    activity_group_id: row.activity_group_id,
    item_date: row.item_date,
    start_time: row.start_time,
    end_time: row.end_time,
    shift: row.shift,
    level: row.level,
    front: row.front,
    category: row.category,
    tracking_type: row.tracking_type ?? "programado",
    item_type: row.item_type,
    description: row.description,
    notes: row.notes ?? null,
  };
}

function getSegmentOrderBase() {
  return Math.floor(Date.now() / 1000);
}

async function validateAndNormalizePlanningItem(
  req: Request,
  body: {
    activity_group_id?: string;
    item_date?: string;
    start_time?: string;
    end_time?: string;
    shift?: string;
    level?: string;
    front?: string;
    category?: string;
    tracking_type?: string;
    item_type?: string;
    description?: string;
    notes?: string | null;
  }
) {
  const { user } = await requireApprovedUser(req);
  const db = getSupabaseServerClient();
  const payload: PlanningItemPayload = {
    activity_group_id: String(body.activity_group_id ?? "").trim() || crypto.randomUUID(),
    item_date: String(body.item_date ?? "").trim(),
    start_time: String(body.start_time ?? "").trim(),
    end_time: String(body.end_time ?? "").trim(),
    shift: String(body.shift ?? "").trim(),
    level: String(body.level ?? "").trim(),
    front: String(body.front ?? "").trim(),
    category: String(body.category ?? "").trim().toLowerCase(),
    tracking_type: String(body.tracking_type ?? "").trim().toLowerCase(),
    item_type: String(body.item_type ?? "").trim().toLowerCase(),
    description: String(body.description ?? "").trim(),
    notes: String(body.notes ?? "").trim() || null,
  };

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

  if (!["actividad", "interferencia"].includes(payload.category)) {
    return {
      errorResponse: NextResponse.json(
        { error: "La categoria debe ser actividad o interferencia." },
        { status: 400 }
      ),
    };
  }

  if (!["programado", "real"].includes(payload.tracking_type)) {
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

  if (!["Dia", "Noche"].includes(payload.shift)) {
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

  const catalogError = await validateCatalogSelection(db, payload);
  if (catalogError) {
    return { errorResponse: catalogError };
  }

  let plannedItem: { id: number; activity_group_id: string } | null = null;

  if (payload.tracking_type === "real") {
    const { data, error } = await db
      .from("planning_items")
      .select("id, activity_group_id")
      .eq("activity_group_id", payload.activity_group_id)
      .eq("tracking_type", "programado")
      .maybeSingle();

    if (error) {
      throw error;
    }

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

  return { db, payload, user, plannedItem };
}

export async function GET(req: Request) {
  try {
    const db = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date")?.trim() ?? "";

    let executionQuery = db
      .from("activity_execution_segments")
      .select("id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes")
      .order("item_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (date) {
      executionQuery = executionQuery.eq("item_date", date);
    }

    const { data: executionSegments, error: executionError } = await executionQuery;

    if (executionError) {
      throw executionError;
    }

    const executionGroupIds = Array.from(
      new Set((executionSegments ?? []).map((segment) => segment.activity_group_id).filter(Boolean))
    );

    let planningByDateQuery = db
      .from("planning_items")
      .select(
        "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes, tracking_type"
      )
      .eq("tracking_type", "programado")
      .order("item_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (date) {
      planningByDateQuery = planningByDateQuery.eq("item_date", date);
    }

    const { data: planningByDate, error: planningByDateError } = await planningByDateQuery;

    if (planningByDateError) {
      throw planningByDateError;
    }

    let relatedPlanning: typeof planningByDate = [];

    if (executionGroupIds.length) {
      const { data, error } = await db
        .from("planning_items")
        .select(
          "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes, tracking_type"
        )
        .eq("tracking_type", "programado")
        .in("activity_group_id", executionGroupIds)
        .order("item_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        throw error;
      }

      relatedPlanning = data ?? [];
    }

    const planningMap = new Map<number, NonNullable<typeof planningByDate>[number]>();

    for (const row of planningByDate ?? []) {
      planningMap.set(row.id, row);
    }

    for (const row of relatedPlanning ?? []) {
      planningMap.set(row.id, row);
    }

    const planningItems = Array.from(planningMap.values());

    const items = [
      ...(planningItems ?? []).map((row) => mapPlanningRow(row)),
      ...((executionSegments ?? []).map((row) =>
        mapPlanningRow({
          ...row,
          tracking_type: "real",
        })
      ) as PlanningItemResponse[]),
    ].sort((left, right) => `${left.item_date}-${left.start_time}`.localeCompare(`${right.item_date}-${right.start_time}`));

    return NextResponse.json({ items });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      activity_group_id?: string;
      item_date?: string;
      start_time?: string;
      end_time?: string;
      shift?: string;
      level?: string;
      front?: string;
      category?: string;
      tracking_type?: string;
      item_type?: string;
      description?: string;
      notes?: string | null;
    };
    const result = await validateAndNormalizePlanningItem(req, body);
    if ("errorResponse" in result) {
      return result.errorResponse;
    }
    const { db, payload, user, plannedItem } = result;

    if (payload.tracking_type === "programado") {
      const { data, error } = await db
        .from("planning_items")
        .insert({
          created_by: user.id,
          ...payload,
        })
        .select(
          "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes, tracking_type"
        )
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ item: mapPlanningRow(data) }, { status: 201 });
    }

    const segments = buildRealSegments(payload) ?? [];

    const { data: existingReal, error: existingRealError } = await db
      .from("activity_execution_segments")
      .select("id")
      .eq("activity_group_id", payload.activity_group_id)
      .limit(1)
      .maybeSingle();

    if (existingRealError) {
      throw existingRealError;
    }

    if (existingReal) {
      return NextResponse.json(
        { error: "Esta programacion ya tiene un real registrado." },
        { status: 400 }
      );
    }

    const baseSegmentOrder = getSegmentOrderBase();

    const { data, error } = await db
      .from("activity_execution_segments")
      .insert(
        segments.map((segment, index) => {
          const base = {
            planning_item_id: plannedItem?.id,
            activity_group_id: segment.activity_group_id,
            item_date: segment.item_date,
            start_time: segment.start_time,
            end_time: segment.end_time,
            shift: segment.shift,
            level: segment.level,
            front: segment.front,
            category: segment.category,
            item_type: segment.item_type,
            description: segment.description,
            notes: segment.notes,
            created_by: user.id,
          } as Record<string, unknown>;

          if (segments.length > 1) {
            base.segment_order = baseSegmentOrder + index;
          }

          return base;
        })
      )
      .select("id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes")
      .order("start_time", { ascending: true });

    if (error) {
      if (segments.length > 1 && /segment_order|column/i.test(error.message ?? "")) {
        const message =
          "Para registrar un real que cruza turnos necesitamos que la API reconozca `segment_order`. Asegura que la migracion de `activity_execution_segments` se ejecuto en este proyecto y luego refresca el schema cache con: select pg_notify('pgrst', 'reload schema');";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(
      {
        item: mapPlanningRow({
          ...(data?.[0] as Omit<PlanningItemResponse, "tracking_type">),
          tracking_type: "real",
        }),
        items: (data ?? []).map((row) =>
          mapPlanningRow({
            ...row,
            tracking_type: "real",
          })
        ),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: number;
      activity_group_id?: string;
      item_date?: string;
      start_time?: string;
      end_time?: string;
      shift?: string;
      level?: string;
      front?: string;
      category?: string;
      tracking_type?: string;
      item_type?: string;
      description?: string;
      notes?: string | null;
    };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }
    const result = await validateAndNormalizePlanningItem(req, body);
    if ("errorResponse" in result) {
      return result.errorResponse;
    }
    const { db, payload, plannedItem } = result;

    if (payload.tracking_type === "programado") {
      const { data, error } = await db
        .from("planning_items")
        .update(payload)
        .eq("id", id)
        .eq("tracking_type", "programado")
        .select(
          "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes, tracking_type"
        )
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ item: mapPlanningRow(data) });
    }

    const { data, error } = await db
      .from("activity_execution_segments")
      .update({
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
      })
      .eq("id", id)
      .select("id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      item: mapPlanningRow({
        ...data,
        tracking_type: "real",
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireApprovedUser(req);
    const body = (await req.json()) as { id?: number; tracking_type?: string };
    const id = Number(body.id);
    const trackingType = String(body.tracking_type ?? "").trim().toLowerCase();

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }

    if (!["programado", "real"].includes(trackingType)) {
      return NextResponse.json({ error: "Debes indicar si eliminas programado o real." }, { status: 400 });
    }

    const db = getSupabaseServerClient();

    if (trackingType === "programado") {
      const { data: currentItem, error: currentItemError } = await db
        .from("planning_items")
        .select("id, activity_group_id")
        .eq("id", id)
        .eq("tracking_type", "programado")
        .maybeSingle();

      if (currentItemError) {
        throw currentItemError;
      }

      if (!currentItem) {
        return NextResponse.json({ error: "No se encontro la programacion indicada." }, { status: 404 });
      }

      const { data: realSegments, error: realSegmentsError } = await db
        .from("activity_execution_segments")
        .select("id")
        .eq("planning_item_id", currentItem.id)
        .limit(1);

      if (realSegmentsError) {
        throw realSegmentsError;
      }

      if (realSegments?.length) {
        return NextResponse.json(
          { error: "No puedes eliminar la programacion mientras exista un real asociado a esa actividad." },
          { status: 409 }
        );
      }

      const { error } = await db.from("planning_items").delete().eq("id", id).eq("tracking_type", "programado");
      if (error) {
        throw error;
      }

      return NextResponse.json({ ok: true });
    }

    const { data: currentSegment, error: currentSegmentError } = await db
      .from("activity_execution_segments")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (currentSegmentError) {
      throw currentSegmentError;
    }

    if (!currentSegment) {
      return NextResponse.json({ error: "No se encontro el tramo real indicado." }, { status: 404 });
    }

    const { error } = await db.from("activity_execution_segments").delete().eq("id", id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
