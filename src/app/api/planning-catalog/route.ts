import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errorMessage";
import { requireAuthUser } from "@/lib/requireAuthUser";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

const categoryLabels = {
  actividad: "Actividad",
  interferencia: "Interferencia",
} as const;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    const db = getSupabaseServerClient();
    const [{ data: types, error: typesError }, { data: details, error: detailsError }] =
      await Promise.all([
        db
          .from("planning_catalog_types")
          .select("id, category, slug, label")
          .order("category", { ascending: true })
          .order("label", { ascending: true }),
        db
          .from("planning_catalog_details")
          .select("id, type_id, label")
          .order("label", { ascending: true }),
      ]);

    if (typesError) {
      throw typesError;
    }

    if (detailsError) {
      throw detailsError;
    }

    const groupedDetails = new Map<number, Array<{ id: number; label: string }>>();

    for (const detail of details ?? []) {
      const current = groupedDetails.get(detail.type_id) ?? [];
      current.push({ id: detail.id, label: detail.label });
      groupedDetails.set(detail.type_id, current);
    }

    const categories = (Object.entries(categoryLabels) as Array<
      [keyof typeof categoryLabels, string]
    >).map(([slug, label]) => ({
      slug,
      label,
      types: (types ?? [])
        .filter((type) => type.category === slug)
        .map((type) => ({
          id: type.id,
          slug: type.slug,
          label: type.label,
          details: groupedDetails.get(type.id) ?? [],
        })),
    }));

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAuthUser(req);
    const body = (await req.json()) as {
      entity?: "type" | "detail";
      category?: string;
      label?: string;
      type_id?: number;
    };

    const db = getSupabaseServerClient();

    if (body.entity === "type") {
      const category = String(body.category ?? "").trim().toLowerCase();
      const label = String(body.label ?? "").trim();

      if (!["actividad", "interferencia"].includes(category) || !label) {
        return NextResponse.json(
          { error: "Debes indicar una categoria valida y un nombre para el tipo." },
          { status: 400 }
        );
      }

      const slug = slugify(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del tipo no es valido." },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("planning_catalog_types")
        .insert({ category, slug, label })
        .select("id, category, slug, label")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ type: data }, { status: 201 });
    }

    if (body.entity === "detail") {
      const typeId = Number(body.type_id);
      const label = String(body.label ?? "").trim();

      if (!Number.isFinite(typeId) || typeId <= 0 || !label) {
        return NextResponse.json(
          { error: "Debes indicar un tipo valido y un detalle." },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("planning_catalog_details")
        .insert({ type_id: typeId, label })
        .select("id, type_id, label")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ detail: data }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Entidad no soportada. Usa type o detail." },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAuthUser(req);
    const body = (await req.json()) as {
      entity?: "type" | "detail";
      id?: number;
      category?: string;
      label?: string;
      type_id?: number;
    };

    const db = getSupabaseServerClient();

    if (body.entity === "type") {
      const id = Number(body.id);
      const category = String(body.category ?? "").trim().toLowerCase();
      const label = String(body.label ?? "").trim();

      if (!Number.isFinite(id) || id <= 0 || !["actividad", "interferencia"].includes(category) || !label) {
        return NextResponse.json(
          { error: "Debes indicar un tipo valido, una categoria valida y un nombre." },
          { status: 400 }
        );
      }

      const slug = slugify(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del tipo no es valido." },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("planning_catalog_types")
        .update({ category, label, slug })
        .eq("id", id)
        .select("id, category, slug, label")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ type: data });
    }

    if (body.entity === "detail") {
      const id = Number(body.id);
      const typeId = Number(body.type_id);
      const label = String(body.label ?? "").trim();

      if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(typeId) || typeId <= 0 || !label) {
        return NextResponse.json(
          { error: "Debes indicar un detalle valido, un tipo valido y un nombre." },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("planning_catalog_details")
        .update({ type_id: typeId, label })
        .eq("id", id)
        .select("id, type_id, label")
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ detail: data });
    }

    return NextResponse.json(
      { error: "Entidad no soportada. Usa type o detail." },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAuthUser(req);
    const body = (await req.json()) as {
      entity?: "type" | "detail";
      id?: number;
    };

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }

    const db = getSupabaseServerClient();

    if (body.entity === "type") {
      const { error } = await db.from("planning_catalog_types").delete().eq("id", id);

      if (error) {
        throw error;
      }

      return NextResponse.json({ ok: true });
    }

    if (body.entity === "detail") {
      const { error } = await db.from("planning_catalog_details").delete().eq("id", id);

      if (error) {
        throw error;
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Entidad no soportada. Usa type o detail." },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
