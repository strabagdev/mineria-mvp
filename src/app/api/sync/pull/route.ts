import { NextResponse } from "next/server";
import { PERMISSIONS, requirePermission } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import { pullPlanningSyncChanges } from "@/server/services/sync.service";

export async function GET(req: Request) {
  try {
    const { user } = await requirePermission(req, PERMISSIONS.RECORDS_VIEW);
    const { searchParams } = new URL(req.url);
    const cursor = Number(searchParams.get("cursor") ?? 0);
    const limit = Number(searchParams.get("limit") ?? 200);

    return NextResponse.json(await pullPlanningSyncChanges({
      cursor,
      limit,
      scopeUserId: user.id,
    }));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
