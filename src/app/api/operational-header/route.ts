import { NextResponse } from "next/server";
import { requireAdminUser, requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import type {
  OperationalHeaderFieldCreateRequestDto,
  OperationalHeaderFieldDeleteRequestDto,
  OperationalHeaderFieldUpdateRequestDto,
  OperationalHeaderJson,
  OperationalHeaderDependencyCreateRequestDto,
  OperationalHeaderDependencyDeleteRequestDto,
  OperationalHeaderOptionCreateRequestDto,
  OperationalHeaderOptionDeleteRequestDto,
  OperationalHeaderOptionUpdateRequestDto,
} from "@/modules/operational-header/contracts/operational-header";
import { isOperationalHeaderInputType } from "@/modules/operational-header/contracts/operational-header";
import {
  createOperationalHeaderFieldDefinition,
  createOperationalHeaderDependencyDefinition,
  createOperationalHeaderOptionDefinition,
  deleteOperationalHeaderDependencyDefinition,
  deleteUnusedOperationalHeaderFieldDefinition,
  deleteUnusedOperationalHeaderOptionDefinition,
  getOperationalHeaderConfig,
  slugifyOperationalHeaderField,
  slugifyOperationalHeaderOptionValue,
  updateOperationalHeaderFieldDefinition,
  updateOperationalHeaderOptionDefinition,
} from "@/server/services/operational-header.service";

function toSortOrder(value: unknown) {
  const sortOrder = Number(value ?? 100);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100;
}

function toMetadata(value: unknown) {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as OperationalHeaderJson;
  }

  throw Object.assign(new Error("La metadata de la opcion debe ser un objeto JSON."), { status: 400 });
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") !== "false";

    return NextResponse.json(await getOperationalHeaderConfig({ activeOnly }));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminUser(req);
    const body = (await req.json()) as
      | OperationalHeaderDependencyCreateRequestDto
      | OperationalHeaderFieldCreateRequestDto
      | OperationalHeaderOptionCreateRequestDto;

    if ("entity" in body && body.entity === "dependency") {
      const fieldId = Number(body.field_id);
      const optionId = Number(body.option_id);
      const dependsOnFieldId = Number(body.depends_on_field_id);
      const dependsOnOptionId = Number(body.depends_on_option_id);

      if (
        !Number.isFinite(fieldId) ||
        !Number.isFinite(optionId) ||
        !Number.isFinite(dependsOnFieldId) ||
        !Number.isFinite(dependsOnOptionId) ||
        fieldId <= 0 ||
        optionId <= 0 ||
        dependsOnFieldId <= 0 ||
        dependsOnOptionId <= 0
      ) {
        return NextResponse.json(
          { error: "Debes indicar campos y opciones validas para la dependencia." },
          { status: 400 }
        );
      }

      const dependency = await createOperationalHeaderDependencyDefinition({
        fieldId,
        optionId,
        dependsOnFieldId,
        dependsOnOptionId,
      });

      return NextResponse.json({ dependency }, { status: 201 });
    }

    if ("entity" in body && body.entity === "option") {
      const fieldId = Number(body.field_id);
      const label = String(body.label ?? "").trim();
      const value = slugifyOperationalHeaderOptionValue(String(body.value ?? label));

      if (!Number.isFinite(fieldId) || fieldId <= 0 || !label || !value) {
        return NextResponse.json(
          { error: "Debes indicar campo, valor y nombre validos para la opcion." },
          { status: 400 }
        );
      }

      const option = await createOperationalHeaderOptionDefinition({
        fieldId,
        value,
        label,
        active: body.active !== false,
        sortOrder: toSortOrder(body.sort_order),
        metadata: toMetadata(body.metadata),
      });

      return NextResponse.json({ option }, { status: 201 });
    }

    const fieldBody = body as OperationalHeaderFieldCreateRequestDto;
    const label = String(fieldBody.label ?? "").trim();
    const slug = slugifyOperationalHeaderField(String(fieldBody.slug ?? label));
    const inputType = String(fieldBody.input_type ?? "text");

    if (!label || !slug || !isOperationalHeaderInputType(inputType)) {
      return NextResponse.json(
        { error: "Debes indicar nombre, slug y tipo de campo validos." },
        { status: 400 }
      );
    }

    const field = await createOperationalHeaderFieldDefinition({
      slug,
      label,
      inputType,
      required: Boolean(fieldBody.required),
      active: fieldBody.active !== false,
      sortOrder: toSortOrder(fieldBody.sort_order),
      groupable: Boolean(fieldBody.groupable),
      filterable: Boolean(fieldBody.filterable),
      visibleInGantt: Boolean(fieldBody.visible_in_gantt),
      exportable: Boolean(fieldBody.exportable),
    });

    return NextResponse.json({ field }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminUser(req);
    const body = (await req.json()) as OperationalHeaderFieldUpdateRequestDto | OperationalHeaderOptionUpdateRequestDto;
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un campo valido." }, { status: 400 });
    }

    if ("entity" in body && body.entity === "option") {
      const updates: Parameters<typeof updateOperationalHeaderOptionDefinition>[0]["updates"] = {};

      if (body.field_id !== undefined) updates.fieldId = Number(body.field_id);
      if (body.value !== undefined) updates.value = String(body.value);
      if (body.label !== undefined) updates.label = String(body.label);
      if (body.active !== undefined) updates.active = Boolean(body.active);
      if (body.sort_order !== undefined) updates.sortOrder = toSortOrder(body.sort_order);
      if (body.metadata !== undefined) updates.metadata = toMetadata(body.metadata);

      const option = await updateOperationalHeaderOptionDefinition({ id, updates });
      return NextResponse.json({ option });
    }

    const fieldBody = body as OperationalHeaderFieldUpdateRequestDto;
    const updates: Parameters<typeof updateOperationalHeaderFieldDefinition>[0]["updates"] = {};

    if (fieldBody.label !== undefined) updates.label = String(fieldBody.label);
    if (fieldBody.slug !== undefined) updates.slug = String(fieldBody.slug);

    if (fieldBody.input_type !== undefined) {
      const inputType = String(fieldBody.input_type);

      if (!isOperationalHeaderInputType(inputType)) {
        return NextResponse.json({ error: "El tipo del campo no es valido." }, { status: 400 });
      }

      updates.inputType = inputType;
    }

    if (fieldBody.required !== undefined) updates.required = Boolean(fieldBody.required);
    if (fieldBody.active !== undefined) updates.active = Boolean(fieldBody.active);
    if (fieldBody.sort_order !== undefined) updates.sortOrder = toSortOrder(fieldBody.sort_order);
    if (fieldBody.groupable !== undefined) updates.groupable = Boolean(fieldBody.groupable);
    if (fieldBody.filterable !== undefined) updates.filterable = Boolean(fieldBody.filterable);
    if (fieldBody.visible_in_gantt !== undefined) updates.visibleInGantt = Boolean(fieldBody.visible_in_gantt);
    if (fieldBody.exportable !== undefined) updates.exportable = Boolean(fieldBody.exportable);

    const field = await updateOperationalHeaderFieldDefinition({ id, updates });
    return NextResponse.json({ field });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdminUser(req);
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({})) as
      | OperationalHeaderDependencyDeleteRequestDto
      | OperationalHeaderFieldDeleteRequestDto
      | OperationalHeaderOptionDeleteRequestDto;
    const id = Number(body.id ?? searchParams.get("id"));

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un campo valido." }, { status: 400 });
    }

    if ("entity" in body && body.entity === "dependency") {
      await deleteOperationalHeaderDependencyDefinition({ id });
      return NextResponse.json({ deleted: true });
    }

    if ("entity" in body && body.entity === "option") {
      const result = await deleteUnusedOperationalHeaderOptionDefinition({ id });

      if (!result.deleted) {
        return NextResponse.json(
          {
            error: "No se puede eliminar esta opcion porque ya tiene valores historicos. Desactivala si no debe usarse en nuevos eventos.",
            usageCount: result.usageCount,
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ deleted: true });
    }

    const result = await deleteUnusedOperationalHeaderFieldDefinition({ id });

    if (!result.deleted) {
      return NextResponse.json(
        {
          error: "No se puede eliminar este campo porque ya tiene valores u opciones. Desactivalo si no debe usarse en nuevos eventos.",
          valueCount: result.valueCount,
          optionCount: result.optionCount,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
