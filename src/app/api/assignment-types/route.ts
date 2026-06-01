import { NextResponse } from "next/server";
import { requireAdminUser, requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  AssignmentTypeCreateRequestDto,
  AssignmentTypeUpdateRequestDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import { isAssignmentTypeIconKey } from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  createAssignmentCatalogType,
  deleteUnusedAssignmentType,
  listAssignmentTypes,
  slugifyAssignmentCatalogValue,
  updateAssignmentCatalogType,
} from "@/server/services/planning-assignments.service";

function toSortOrder(value: unknown) {
  const sortOrder = Number(value ?? 100);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100;
}

function toMaxInstances(value: unknown) {
  const maxInstances = Number(value ?? 2);
  return Number.isInteger(maxInstances) && maxInstances >= 1 ? maxInstances : null;
}

function toConfig(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toIconKey(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const iconKey = String(value);
  return isAssignmentTypeIconKey(iconKey) ? iconKey : undefined;
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    return NextResponse.json({ types: await listAssignmentTypes({ activeOnly: searchParams.get("active") !== "false" }) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as AssignmentTypeCreateRequestDto;
    const label = String(body.label ?? "").trim();
    const slug = slugifyAssignmentCatalogValue(String(body.slug ?? label));
    const maxInstances = toMaxInstances(body.max_instances);
    const iconKey = toIconKey(body.icon_key);

    if (!label || !slug || maxInstances === null || iconKey === undefined) {
      return NextResponse.json({ error: "Debes indicar nombre, slug, icono y maximo de instancias validos." }, { status: 400 });
    }

    const type = await createAssignmentCatalogType({
      actor: { user, profile },
      slug,
      label,
      description: String(body.description ?? "").trim() || null,
      iconKey,
      active: body.active ?? true,
      maxInstances,
      sortOrder: toSortOrder(body.sort_order),
      config: toConfig(body.config),
    });
    return NextResponse.json({ type }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as AssignmentTypeUpdateRequestDto;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Debes indicar un tipo de asignacion valido." }, { status: 400 });

    const updates: Parameters<typeof updateAssignmentCatalogType>[0]["updates"] = {};
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return NextResponse.json({ error: "El nombre no puede quedar vacio." }, { status: 400 });
      updates.label = label;
    }
    if (body.slug !== undefined) {
      const slug = slugifyAssignmentCatalogValue(String(body.slug));
      if (!slug) return NextResponse.json({ error: "El slug no es valido." }, { status: 400 });
      updates.slug = slug;
    }
    if (body.description !== undefined) updates.description = String(body.description ?? "").trim() || null;
    if (body.icon_key !== undefined) {
      const iconKey = toIconKey(body.icon_key);
      if (iconKey === undefined) return NextResponse.json({ error: "El icono no es valido." }, { status: 400 });
      updates.icon_key = iconKey;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.max_instances !== undefined) {
      const maxInstances = toMaxInstances(body.max_instances);
      if (maxInstances === null) return NextResponse.json({ error: "El maximo de instancias debe ser al menos 1." }, { status: 400 });
      updates.max_instances = maxInstances;
    }
    if (body.sort_order !== undefined) updates.sort_order = toSortOrder(body.sort_order);
    if (body.config !== undefined) updates.config = toConfig(body.config);

    return NextResponse.json({ type: await updateAssignmentCatalogType({ actor: { user, profile }, id, updates }) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = await req.json().catch(() => ({})) as { id?: unknown };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Debes indicar un tipo de asignacion valido." }, { status: 400 });
    const result = await deleteUnusedAssignmentType({ actor: { user, profile }, id });
    if (!result.deleted) {
      return NextResponse.json({ error: "No se puede eliminar este tipo porque tiene campos asociados. Desactivalo si ya no debe usarse.", dependencyCount: result.dependencyCount }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
