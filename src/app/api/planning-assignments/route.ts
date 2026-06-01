import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import type { PlanningAssignmentsReplaceRequestDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { getPlanningAssignments, getPlanningAssignmentsForPlanningItems, savePlanningAssignments } from "@/server/services/planning-assignments.service";

function toPlanningItemId(value: unknown) {
  const planningItemId = Number(value);
  return Number.isFinite(planningItemId) && planningItemId > 0 ? planningItemId : null;
}

function toPlanningItemIds(value: string | null) {
  if (!value) return [];
  return [...new Set(value.split(",").map(toPlanningItemId).filter((id): id is number => id !== null))].slice(0, 250);
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const planningItemIds = toPlanningItemIds(searchParams.get("planning_item_ids"));
    if (planningItemIds.length) {
      return NextResponse.json({ assignments: await getPlanningAssignmentsForPlanningItems(planningItemIds) });
    }
    const planningItemId = toPlanningItemId(searchParams.get("planning_item_id"));
    if (!planningItemId) {
      return NextResponse.json({ error: "Debes indicar un programado valido." }, { status: 400 });
    }
    return NextResponse.json({ assignments: await getPlanningAssignments(planningItemId) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireApprovedUser(req);
    const body = (await req.json()) as PlanningAssignmentsReplaceRequestDto;
    const planningItemId = toPlanningItemId(body.planning_item_id);
    if (!planningItemId || !Array.isArray(body.assignments)) {
      return NextResponse.json({ error: "Debes indicar un programado y una lista de asignaciones validos." }, { status: 400 });
    }
    return NextResponse.json({
      assignments: await savePlanningAssignments({
        actor: { user, profile },
        planningItemId,
        assignments: body.assignments,
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
