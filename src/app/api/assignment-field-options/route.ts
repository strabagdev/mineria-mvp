import { NextResponse } from "next/server";
import { requireAdminUser, requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import type {
  AssignmentFieldOptionCreateRequestDto,
  AssignmentFieldOptionUpdateRequestDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  createAssignmentCatalogOption,
  deleteAssignmentCatalogOption,
  listAssignmentOptions,
  slugifyAssignmentCatalogValue,
  updateAssignmentCatalogOption,
} from "@/server/services/planning-assignments.service";

function toSortOrder(value: unknown) {
  const sortOrder = Number(value ?? 100);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100;
}

function toMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string | number | boolean | null> : {};
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const fieldIdValue = searchParams.get("field_id");
    const fieldId = fieldIdValue ? Number(fieldIdValue) : undefined;
    if (fieldIdValue && (!Number.isFinite(fieldId) || Number(fieldId) <= 0)) {
      return NextResponse.json({ error: "Debes indicar un campo valido." }, { status: 400 });
    }
    return NextResponse.json({ options: await listAssignmentOptions(fieldId) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as AssignmentFieldOptionCreateRequestDto;
    const fieldId = Number(body.field_id);
    const label = String(body.label ?? "").trim();
    const value = slugifyAssignmentCatalogValue(String(body.value ?? label));
    if (!Number.isFinite(fieldId) || fieldId <= 0 || !label || !value) {
      return NextResponse.json({ error: "Debes indicar campo, valor y nombre validos para la opcion." }, { status: 400 });
    }
    const option = await createAssignmentCatalogOption({ actor: { user, profile }, fieldId, value, label, active: body.active ?? true, sortOrder: toSortOrder(body.sort_order), metadata: toMetadata(body.metadata) });
    return NextResponse.json({ option }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as AssignmentFieldOptionUpdateRequestDto;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Debes indicar una opcion valida." }, { status: 400 });

    const updates: Parameters<typeof updateAssignmentCatalogOption>[0]["updates"] = {};
    if (body.field_id !== undefined) {
      const fieldId = Number(body.field_id);
      if (!Number.isFinite(fieldId) || fieldId <= 0) return NextResponse.json({ error: "Debes indicar un campo valido." }, { status: 400 });
      updates.field_id = fieldId;
    }
    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) return NextResponse.json({ error: "El nombre no puede quedar vacio." }, { status: 400 });
      updates.label = label;
    }
    if (body.value !== undefined) {
      const value = slugifyAssignmentCatalogValue(String(body.value));
      if (!value) return NextResponse.json({ error: "El valor no es valido." }, { status: 400 });
      updates.value = value;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.sort_order !== undefined) updates.sort_order = toSortOrder(body.sort_order);
    if (body.metadata !== undefined) updates.metadata = toMetadata(body.metadata);

    return NextResponse.json({ option: await updateAssignmentCatalogOption({ actor: { user, profile }, id, updates }) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = await req.json().catch(() => ({})) as { id?: unknown };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Debes indicar una opcion valida." }, { status: 400 });
    const result = await deleteAssignmentCatalogOption({ actor: { user, profile }, id });
    if (!result.deleted) {
      return NextResponse.json({ error: "No se puede eliminar esta opcion porque ya tiene valores historicos. Desactivala si ya no debe usarse.", usageCount: result.usageCount }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
