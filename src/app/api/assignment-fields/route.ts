import { NextResponse } from "next/server";
import { requireAdminUser, requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  AssignmentFieldCreateRequestDto,
  AssignmentFieldUpdateRequestDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import { isAssignmentFieldInputType } from "@/modules/planning-assignments/contracts/planning-assignments";
import {
  createAssignmentCatalogField,
  deleteUnusedAssignmentField,
  listAssignmentFields,
  slugifyAssignmentCatalogValue,
  updateAssignmentCatalogField,
} from "@/server/services/planning-assignments.service";

function toSortOrder(value: unknown) {
  const sortOrder = Number(value ?? 100);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100;
}

function toConfig(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const assignmentTypeIdValue = searchParams.get("assignment_type_id");
    const assignmentTypeId = assignmentTypeIdValue ? Number(assignmentTypeIdValue) : undefined;
    if (assignmentTypeIdValue && (!Number.isFinite(assignmentTypeId) || Number(assignmentTypeId) <= 0)) {
      return NextResponse.json({ error: "Debes indicar un tipo de asignacion valido." }, { status: 400 });
    }
    return NextResponse.json({ fields: await listAssignmentFields({ assignmentTypeId, activeOnly: searchParams.get("active") !== "false" }) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as AssignmentFieldCreateRequestDto;
    const assignmentTypeId = Number(body.assignment_type_id);
    const label = String(body.label ?? "").trim();
    const slug = slugifyAssignmentCatalogValue(String(body.slug ?? label));
    const inputType = String(body.input_type ?? "").trim();
    if (!Number.isFinite(assignmentTypeId) || assignmentTypeId <= 0 || !label || !slug || !isAssignmentFieldInputType(inputType)) {
      return NextResponse.json({ error: "Debes indicar tipo de asignacion, nombre, slug y tipo de campo validos." }, { status: 400 });
    }
    const field = await createAssignmentCatalogField({
      actor: { user, profile },
      assignmentTypeId,
      slug,
      label,
      inputType,
      active: body.active ?? true,
      required: body.required ?? false,
      sortOrder: toSortOrder(body.sort_order),
      config: toConfig(body.config),
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as AssignmentFieldUpdateRequestDto;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Debes indicar un campo de asignacion valido." }, { status: 400 });

    const updates: Parameters<typeof updateAssignmentCatalogField>[0]["updates"] = {};
    if (body.assignment_type_id !== undefined) {
      const assignmentTypeId = Number(body.assignment_type_id);
      if (!Number.isFinite(assignmentTypeId) || assignmentTypeId <= 0) return NextResponse.json({ error: "Debes indicar un tipo de asignacion valido." }, { status: 400 });
      updates.assignment_type_id = assignmentTypeId;
    }
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
    if (body.input_type !== undefined) {
      const inputType = String(body.input_type);
      if (!isAssignmentFieldInputType(inputType)) return NextResponse.json({ error: "El tipo de campo no es valido." }, { status: 400 });
      updates.input_type = inputType;
    }
    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.required !== undefined) updates.required = Boolean(body.required);
    if (body.sort_order !== undefined) updates.sort_order = toSortOrder(body.sort_order);
    if (body.config !== undefined) updates.config = toConfig(body.config);

    return NextResponse.json({ field: await updateAssignmentCatalogField({ actor: { user, profile }, id, updates }) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = await req.json().catch(() => ({})) as { id?: unknown };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Debes indicar un campo de asignacion valido." }, { status: 400 });
    const result = await deleteUnusedAssignmentField({ actor: { user, profile }, id });
    if (!result.deleted) {
      return NextResponse.json({ error: "No se puede eliminar este campo porque tiene opciones asociadas. Desactivalo si ya no debe usarse.", dependencyCount: result.dependencyCount }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
