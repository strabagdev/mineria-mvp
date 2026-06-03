import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { listAuditEvents } from "@/server/services/audit.service";

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  return Number(value);
}

export async function GET(req: Request) {
  try {
    await requireAdminUser(req);
    const { searchParams } = new URL(req.url);

    return NextResponse.json(
      await listAuditEvents({
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        action: searchParams.get("action") ?? undefined,
        entity_type: searchParams.get("entity_type") ?? undefined,
        entity_id: searchParams.get("entity_id") ?? undefined,
        user_id: searchParams.get("user_id") ?? undefined,
        limit: parseLimit(searchParams.get("limit")),
        cursor: searchParams.get("cursor") ?? undefined,
      })
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
