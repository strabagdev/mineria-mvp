import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { getReport } from "@/server/services/reports.service";

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("date_from")?.trim() ?? "";
    const dateTo = searchParams.get("date_to")?.trim() ?? "";
    const shift = searchParams.get("shift")?.trim() ?? "";
    const level = searchParams.get("level")?.trim() ?? "";
    const front = searchParams.get("front")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const trackingType = searchParams.get("tracking_type")?.trim() ?? "";
    const itemType = searchParams.get("item_type")?.trim() ?? "";

    return NextResponse.json(
      await getReport({
        dateFrom,
        dateTo,
        shift,
        level,
        front,
        category,
        trackingType,
        itemType,
      })
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
