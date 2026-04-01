import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errorMessage";
import { requireAuthUser } from "@/lib/requireAuthUser";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type PlanningItemPayload = {
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: string;
  item_type: string;
  description: string;
  notes: string | null;
};

async function validateAndNormalizePlanningItem(
  req: Request,
  body: {
    item_date?: string;
    start_time?: string;
    end_time?: string;
    shift?: string;
    level?: string;
    front?: string;
    category?: string;
    item_type?: string;
    description?: string;
    notes?: string | null;
  }
) {
  const { user } = await requireAuthUser(req);
  const payload: PlanningItemPayload = {
    item_date: String(body.item_date ?? "").trim(),
    start_time: String(body.start_time ?? "").trim(),
    end_time: String(body.end_time ?? "").trim(),
    shift: String(body.shift ?? "").trim(),
    level: String(body.level ?? "").trim(),
    front: String(body.front ?? "").trim(),
    category: String(body.category ?? "").trim().toLowerCase(),
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
    !payload.item_type ||
    !payload.description
  ) {
    return {
      errorResponse: NextResponse.json(
        { error: "Completa fecha, horario, turno, nivel, frente, categoria, tipo y descripcion." },
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

  const db = getSupabaseServerClient();
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

  if (payload.end_time <= payload.start_time) {
    return {
      errorResponse: NextResponse.json(
        { error: "La hora de termino debe ser mayor a la hora de inicio." },
        { status: 400 }
      ),
    };
  }

  return { db, payload, user };
}

export async function GET() {
  try {
    const db = getSupabaseServerClient();
    const { data, error } = await db
      .from("planning_items")
      .select(
        "id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes"
      )
      .order("item_date", { ascending: true })
      .order("start_time", { ascending: true });

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
      item_date?: string;
      start_time?: string;
      end_time?: string;
      shift?: string;
      level?: string;
      front?: string;
      category?: string;
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
        "id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes"
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
      item_date?: string;
      start_time?: string;
      end_time?: string;
      shift?: string;
      level?: string;
      front?: string;
      category?: string;
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
        "id, item_date, start_time, end_time, shift, level, front, category, item_type, description, notes"
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
    const { error } = await db.from("planning_items").delete().eq("id", id);
    if (error) {
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
