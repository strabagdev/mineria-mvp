import { NextResponse } from "next/server";
import { requireAdminUser, requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import type {
  PlanningCatalogCreateRequestDto,
  PlanningCatalogDeleteRequestDto,
  PlanningCatalogUpdateRequestDto,
} from "@/modules/planning/contracts/planning-catalog";
import {
  createCatalogDetail,
  createCatalogLevel,
  createCatalogType,
  deleteCatalogDetail,
  deleteCatalogLevel,
  deleteCatalogType,
  getPlanningCatalog,
  slugifyPlanningCatalogValue,
  updateCatalogDetail,
  updateCatalogLevel,
  updateCatalogType,
} from "@/server/services/planning-catalog.service";

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);

    return NextResponse.json(await getPlanningCatalog());
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as PlanningCatalogCreateRequestDto;

    if (body.entity === "type") {
      const category = String(body.category ?? "").trim().toLowerCase();
      const label = String(body.label ?? "").trim();

      if (!["actividad", "interferencia"].includes(category) || !label) {
        return NextResponse.json(
          { error: "Debes indicar una categoria valida y un nombre para el tipo." },
          { status: 400 }
        );
      }

      const slug = slugifyPlanningCatalogValue(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del tipo no es valido." },
          { status: 400 }
        );
      }

      const type = await createCatalogType({
        actor: { user, profile },
        category,
        slug,
        label,
      });

      return NextResponse.json({ type }, { status: 201 });
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

      const detail = await createCatalogDetail({
        actor: { user, profile },
        typeId,
        label,
      });

      return NextResponse.json({ detail }, { status: 201 });
    }

    if (body.entity === "level") {
      const label = String(body.label ?? "").trim().toUpperCase();

      if (!label) {
        return NextResponse.json(
          { error: "Debes indicar un nombre para el nivel." },
          { status: 400 }
        );
      }

      const slug = slugifyPlanningCatalogValue(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del nivel no es valido." },
          { status: 400 }
        );
      }

      const level = await createCatalogLevel({
        actor: { user, profile },
        slug,
        label,
      });

      return NextResponse.json({ level }, { status: 201 });
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
    const body = (await req.json()) as PlanningCatalogUpdateRequestDto;

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

      const slug = slugifyPlanningCatalogValue(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del tipo no es valido." },
          { status: 400 }
        );
      }

      const type = await updateCatalogType({
        actor: { user, profile },
        id,
        category,
        label,
        slug,
      });

      return NextResponse.json({ type });
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

      const detail = await updateCatalogDetail({
        actor: { user, profile },
        id,
        typeId,
        label,
      });

      return NextResponse.json({ detail });
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

      const slug = slugifyPlanningCatalogValue(label);

      if (!slug) {
        return NextResponse.json(
          { error: "El nombre del nivel no es valido." },
          { status: 400 }
        );
      }

      const level = await updateCatalogLevel({
        actor: { user, profile },
        id,
        label,
        slug,
      });

      return NextResponse.json({ level });
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
    const body = (await req.json()) as PlanningCatalogDeleteRequestDto;

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Debes indicar un id valido." }, { status: 400 });
    }

    if (body.entity === "type") {
      await deleteCatalogType({ actor: { user, profile }, id });
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "detail") {
      await deleteCatalogDetail({ actor: { user, profile }, id });
      return NextResponse.json({ ok: true });
    }

    if (body.entity === "level") {
      await deleteCatalogLevel({ actor: { user, profile }, id });
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
