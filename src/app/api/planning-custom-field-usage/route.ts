import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { slugifyPlanningCustomField } from "@/server/services/planning-custom-fields.service";
import { getCustomFieldUsage } from "@/server/services/planning-custom-fields.service";

export async function GET(req: Request) {
  try {
    await requireAdminUser(req);
    const { searchParams } = new URL(req.url);
    const fieldIdValue = searchParams.get("field_id");
    const slugValue = searchParams.get("slug");
    const fieldId = fieldIdValue ? Number(fieldIdValue) : undefined;
    const slug = slugValue ? slugifyPlanningCustomField(slugValue) : undefined;

    if (
      (fieldIdValue && (!Number.isFinite(fieldId) || Number(fieldId) <= 0)) ||
      (!fieldId && !slug)
    ) {
      return NextResponse.json(
        { error: "Debes indicar field_id o slug del campo configurable." },
        { status: 400 }
      );
    }

    const usage = await getCustomFieldUsage({ fieldId, slug });

    if (!usage) {
      return NextResponse.json(
        { error: "No se encontro el campo configurable solicitado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ usage });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
