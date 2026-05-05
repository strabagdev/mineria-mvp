import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/accessControl";
import { writeAuditLog } from "@/lib/auditLog";
import { getErrorMessage } from "@/lib/errorMessage";
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
    const [
      { data: types, error: typesError },
      { data: details, error: detailsError },
      { data: levels, error: levelsError },
    ] =
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
        db
          .from("planning_levels")
          .select("id, slug, label")
          .order("id", { ascending: true }),
      ]);

    if (typesError) {
      throw typesError;
    }

    if (detailsError) {
      throw detailsError;
    }

    if (levelsError) {
      throw levelsError;
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

    return NextResponse.json({ categories, levels: levels ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as {
      entity?: "type" | "detail" | "level";
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

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.type.created",
        entityType: "planning_catalog_type",
        entityId: data.id,
        after: data,
      });

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

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.detail.created",
        entityType: "planning_catalog_detail",
        entityId: data.id,
        after: data,
      });

      return NextResponse.json({ detail: data }, { status: 201 });
    }

    if (body.entity === "level") {
      const label = String(body.label ?? "").trim().toUpperCase();

      if (!label) {
        return NextResponse.json(
          { error: "Debes indicar un nombre para el nivel." },
          { status: 400 }
        );
      }

      const slug = slugify(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del nivel no es valido." },
          { status: 400 }
        );
      }

      const { data, error } = await db
        .from("planning_levels")
        .insert({ slug, label })
        .select("id, slug, label")
        .single();

      if (error) {
        throw error;
      }

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.level.created",
        entityType: "planning_level",
        entityId: data.id,
        after: data,
      });

      return NextResponse.json({ level: data }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Entidad no soportada. Usa type, detail o level." },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as {
      entity?: "type" | "detail" | "level";
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

      const { data: beforeData, error: beforeError } = await db
        .from("planning_catalog_types")
        .select("id, category, slug, label")
        .eq("id", id)
        .maybeSingle();

      if (beforeError) {
        throw beforeError;
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

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.type.updated",
        entityType: "planning_catalog_type",
        entityId: data.id,
        before: beforeData,
        after: data,
      });

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

      const { data: beforeData, error: beforeError } = await db
        .from("planning_catalog_details")
        .select("id, type_id, label")
        .eq("id", id)
        .maybeSingle();

      if (beforeError) {
        throw beforeError;
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

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.detail.updated",
        entityType: "planning_catalog_detail",
        entityId: data.id,
        before: beforeData,
        after: data,
      });

      return NextResponse.json({ detail: data });
    }

    if (body.entity === "level") {
      const id = Number(body.id);
      const label = String(body.label ?? "").trim().toUpperCase();

      if (!Number.isFinite(id) || id <= 0 || !label) {
        return NextResponse.json(
          { error: "Debes indicar un nivel valido y un nombre." },
          { status: 400 }
        );
      }

      const slug = slugify(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del nivel no es valido." },
          { status: 400 }
        );
      }

      const { data: beforeData, error: beforeError } = await db
        .from("planning_levels")
        .select("id, slug, label")
        .eq("id", id)
        .maybeSingle();

      if (beforeError) {
        throw beforeError;
      }

      const { data, error } = await db
        .from("planning_levels")
        .update({ label, slug })
        .eq("id", id)
        .select("id, slug, label")
        .single();

      if (error) {
        throw error;
      }

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.level.updated",
        entityType: "planning_level",
        entityId: data.id,
        before: beforeData,
        after: data,
      });

      return NextResponse.json({ level: data });
    }

    return NextResponse.json(
      { error: "Entidad no soportada. Usa type, detail o level." },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as {
      entity?: "type" | "detail" | "level";
      id?: number;
    };

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }

    const db = getSupabaseServerClient();

    if (body.entity === "type") {
      const { data: beforeData, error: beforeError } = await db
        .from("planning_catalog_types")
        .select("id, category, slug, label")
        .eq("id", id)
        .maybeSingle();

      if (beforeError) {
        throw beforeError;
      }

      const { error } = await db.from("planning_catalog_types").delete().eq("id", id);

      if (error) {
        throw error;
      }

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.type.deleted",
        entityType: "planning_catalog_type",
        entityId: id,
        before: beforeData,
      });

      return NextResponse.json({ ok: true });
    }

    if (body.entity === "detail") {
      const { data: beforeData, error: beforeError } = await db
        .from("planning_catalog_details")
        .select("id, type_id, label")
        .eq("id", id)
        .maybeSingle();

      if (beforeError) {
        throw beforeError;
      }

      const { error } = await db.from("planning_catalog_details").delete().eq("id", id);

      if (error) {
        throw error;
      }

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.detail.deleted",
        entityType: "planning_catalog_detail",
        entityId: id,
        before: beforeData,
      });

      return NextResponse.json({ ok: true });
    }

    if (body.entity === "level") {
      const { data: beforeData, error: beforeError } = await db
        .from("planning_levels")
        .select("id, slug, label")
        .eq("id", id)
        .maybeSingle();

      if (beforeError) {
        throw beforeError;
      }

      const { error } = await db.from("planning_levels").delete().eq("id", id);

      if (error) {
        throw error;
      }

      await writeAuditLog({
        actor: { user, profile },
        action: "catalog.level.deleted",
        entityType: "planning_level",
        entityId: id,
        before: beforeData,
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Entidad no soportada. Usa type, detail o level." },
      { status: 400 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
