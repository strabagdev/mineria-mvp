import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errorMessage";
import { requireAuthUser } from "@/lib/requireAuthUser";
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

function toMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function isTimeWithinShift(time: string, shift: string) {
  const minutes = toMinutes(time);

  if (shift === "Dia") {
    return minutes >= toMinutes("08:00") && minutes <= toMinutes("19:00");
  }

  if (shift === "Noche") {
    return minutes >= toMinutes("20:00") || minutes <= toMinutes("07:00");
  }

  return false;
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
  const { user } = await requireAuthUser(req);
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

  const db = getSupabaseServerClient();

  if (payload.tracking_type === "real") {
    const { data: plannedPair, error: plannedPairError } = await db
      .from("planning_items")
      .select("id")
      .eq("activity_group_id", payload.activity_group_id)
      .eq("tracking_type", "programado")
      .maybeSingle();

    if (plannedPairError) {
      throw plannedPairError;
    }

    if (!plannedPair) {
      return {
        errorResponse: NextResponse.json(
          { error: "Solo puedes registrar lo real cuando la programacion ya existe para esa actividad." },
          { status: 400 }
        ),
      };
    }
  }

  const email = (user.email ?? "").trim().toLowerCase();

  if (email) {
    const { error: profileError } = await db.from("profiles").upsert({
      user_id: user.id,
      email,
      full_name: user.user_metadata.full_name ?? user.user_metadata.name ?? null,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      throw profileError;
    }
  }

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
    return {
      errorResponse: NextResponse.json(
        { error: "La combinacion entre categoria, tipo y descripcion no es valida." },
        { status: 400 }
      ),
    };
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
    return {
      errorResponse: NextResponse.json(
        { error: "La combinacion entre categoria, tipo y descripcion no es valida." },
        { status: 400 }
      ),
    };
  }

  if (!isTimeWithinShift(payload.start_time, payload.shift) || !isTimeWithinShift(payload.end_time, payload.shift)) {
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

  if (payload.shift === "Dia" && payload.end_time <= payload.start_time) {
    return {
      errorResponse: NextResponse.json(
        { error: "En turno Dia la hora de termino debe ser mayor a la hora de inicio." },
        { status: 400 }
      ),
    };
  }

  return { db, payload, user };
}

export async function GET(req: Request) {
  try {
    const db = getSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date")?.trim() ?? "";

    let query = db
      .from("planning_items")
      .select(
        "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, tracking_type, item_type, description, notes"
      )
      .order("item_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (date) {
      query = query.eq("item_date", date);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: data ?? [] });
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
    const { db, payload, user } = result;

    const { data, error } = await db
      .from("planning_items")
      .insert({
        created_by: user.id,
        ...payload,
      })
      .select(
        "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, tracking_type, item_type, description, notes"
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data }, { status: 201 });
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
    const { db, payload } = result;

    const { data, error } = await db
      .from("planning_items")
      .update(payload)
      .eq("id", id)
      .select(
        "id, activity_group_id, item_date, start_time, end_time, shift, level, front, category, tracking_type, item_type, description, notes"
      )
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAuthUser(req);
    const body = (await req.json()) as { id?: number };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }
    const db = getSupabaseServerClient();
    const { data: currentItem, error: currentItemError } = await db
      .from("planning_items")
      .select("id, activity_group_id, tracking_type")
      .eq("id", id)
      .maybeSingle();

    if (currentItemError) {
      throw currentItemError;
    }

    if (!currentItem) {
      return NextResponse.json({ error: "No se encontro el registro indicado." }, { status: 404 });
    }

    if (currentItem.tracking_type === "programado") {
      const { data: realPair, error: realPairError } = await db
        .from("planning_items")
        .select("id")
        .eq("activity_group_id", currentItem.activity_group_id)
        .eq("tracking_type", "real")
        .maybeSingle();

      if (realPairError) {
        throw realPairError;
      }

      if (realPair) {
        return NextResponse.json(
          { error: "No puedes eliminar la programacion mientras exista un real asociado a esa actividad." },
          { status: 409 }
        );
      }
    }

    const { error } = await db.from("planning_items").delete().eq("id", id);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
