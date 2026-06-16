import { NextResponse } from "next/server";
import { requireAdminUser, requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import type {
  PlanningCustomFieldCreateRequestDto,
  PlanningCustomFieldUpdateRequestDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  isPlanningCustomFieldAppliesTo,
  isPlanningCustomFieldIconKey,
  isPlanningCustomFieldInputType,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  createCustomField,
  deleteUnusedCustomField,
  listPlanningCustomFields,
  slugifyPlanningCustomField,
  updateCustomField,
} from "@/server/services/planning-custom-fields.service";

function toSortOrder(value: unknown) {
  const sortOrder = Number(value ?? 100);
  return Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 100;
}

function toConfig(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseIconKey(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { iconKey: null, error: "" };
  }

  const iconKey = String(value).trim();

  if (!isPlanningCustomFieldIconKey(iconKey)) {
    return { iconKey: null, error: "El icono del campo no es valido." };
  }

  return { iconKey, error: "" };
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") !== "false";

    return NextResponse.json({ fields: await listPlanningCustomFields({ activeOnly }) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as PlanningCustomFieldCreateRequestDto;
    const label = String(body.label ?? "").trim();
    const inputType = String(body.input_type ?? "").trim();
    const appliesTo = String(body.applies_to ?? "planned").trim();
    const slug = slugifyPlanningCustomField(String(body.slug ?? label));
    const parsedIconKey = parseIconKey(body.icon_key);

    if (!label || !slug || !isPlanningCustomFieldInputType(inputType) || !isPlanningCustomFieldAppliesTo(appliesTo)) {
      return NextResponse.json(
        { error: "Debes indicar nombre, slug, tipo de campo y aplicacion validos." },
        { status: 400 }
      );
    }

    if (parsedIconKey.error) {
      return NextResponse.json({ error: parsedIconKey.error }, { status: 400 });
    }

    const field = await createCustomField({
      actor: { user, profile },
      slug,
      label,
      iconKey: parsedIconKey.iconKey,
      inputType,
      active: body.active ?? true,
      required: body.required ?? false,
      appliesTo,
      sortOrder: toSortOrder(body.sort_order),
      config: toConfig(body.config),
    });

    return NextResponse.json({ field }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as PlanningCustomFieldUpdateRequestDto;
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un campo valido." }, { status: 400 });
    }

    const updates: Parameters<typeof updateCustomField>[0]["updates"] = {};

    if (body.label !== undefined) {
      const label = String(body.label).trim();
      if (!label) {
        return NextResponse.json({ error: "El nombre del campo no puede quedar vacio." }, { status: 400 });
      }
      updates.label = label;
    }

    if (body.slug !== undefined) {
      const slug = slugifyPlanningCustomField(String(body.slug));
      if (!slug) {
        return NextResponse.json({ error: "El slug del campo no es valido." }, { status: 400 });
      }
      updates.slug = slug;
    }

    if (body.input_type !== undefined) {
      const inputType = String(body.input_type);
      if (!isPlanningCustomFieldInputType(inputType)) {
        return NextResponse.json({ error: "El tipo de campo no es valido." }, { status: 400 });
      }
      updates.input_type = inputType;
    }

    if (body.applies_to !== undefined) {
      const appliesTo = String(body.applies_to);
      if (!isPlanningCustomFieldAppliesTo(appliesTo)) {
        return NextResponse.json({ error: "La aplicacion del campo no es valida." }, { status: 400 });
      }
      updates.applies_to = appliesTo;
    }

    if (body.icon_key !== undefined) {
      const parsedIconKey = parseIconKey(body.icon_key);
      if (parsedIconKey.error) {
        return NextResponse.json({ error: parsedIconKey.error }, { status: 400 });
      }
      updates.icon_key = parsedIconKey.iconKey;
    }

    if (body.active !== undefined) updates.active = Boolean(body.active);
    if (body.required !== undefined) updates.required = Boolean(body.required);
    if (body.sort_order !== undefined) updates.sort_order = toSortOrder(body.sort_order);
    if (body.config !== undefined) updates.config = toConfig(body.config);

    const field = await updateCustomField({ actor: { user, profile }, id, updates });
    return NextResponse.json({ field });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({})) as { id?: unknown };
    const id = Number(body.id ?? searchParams.get("id"));

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un campo valido." }, { status: 400 });
    }

    const result = await deleteUnusedCustomField({ actor: { user, profile }, id });

    if (!result.deleted) {
      return NextResponse.json(
        {
          error: "No se puede eliminar este campo porque ya tiene valores historicos. Desactivalo para ocultarlo en nuevos programados.",
          usageCount: result.usageCount,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
