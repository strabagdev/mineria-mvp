import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { getReport } from "@/server/services/reports.service";

function getOperationalHeaderFilters(searchParams: URLSearchParams) {
  const filters: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("header_")) {
      continue;
    }

    const slug = key.slice("header_".length).trim();
    const normalizedValue = value.trim();

    if (slug && normalizedValue) {
      filters[slug] = normalizedValue;
    }
  }

  return filters;
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("date_from")?.trim() ?? "";
    const dateTo = searchParams.get("date_to")?.trim() ?? "";
    const shift = searchParams.get("shift")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const trackingType = searchParams.get("tracking_type")?.trim() ?? "";
    const itemType = searchParams.get("item_type")?.trim() ?? "";
    const operationalHeaderFilters = getOperationalHeaderFilters(searchParams);

    return NextResponse.json(
      await getReport({
        dateFrom,
        dateTo,
        shift,
        category,
        trackingType,
        itemType,
        operational_header_filters: operationalHeaderFilters,
      })
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
