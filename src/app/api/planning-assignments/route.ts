import { NextResponse } from "next/server";
import { requireApprovedUser, requireOperationalUser } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import type { AssignmentTarget, PlanningAssignmentsReplaceRequestDto } from "@/modules/planning-assignments/contracts/planning-assignments";
import { getAssignmentsForTarget, getPlanningAssignments, getPlanningAssignmentsForPlanningItems, saveAssignmentsForTarget, savePlanningAssignments } from "@/server/services/planning-assignments.service";

function toPlanningItemId(value: unknown) {
  const planningItemId = Number(value);
  return Number.isFinite(planningItemId) && planningItemId > 0 ? planningItemId : null;
}

function toPlanningItemIds(value: string | null) {
  if (!value) return [];
  return [...new Set(value.split(",").map(toPlanningItemId).filter((id): id is number => id !== null))].slice(0, 250);
}

function toTargetId(value: unknown) {
  const targetId = Number(value);
  return Number.isFinite(targetId) && targetId > 0 ? targetId : null;
}

function isAssignmentTargetKind(value: string): value is AssignmentTarget["target_kind"] {
  return value === "planning_item" || value === "execution_segment";
}

function toAssignmentTarget(input: { target_kind?: unknown; target_id?: unknown; planning_item_id?: unknown; execution_segment_id?: unknown }) {
  const explicitKind = typeof input.target_kind === "string" ? input.target_kind : "";
  const explicitTargetId = toTargetId(input.target_id);
  if (isAssignmentTargetKind(explicitKind) && explicitTargetId) {
    return { target_kind: explicitKind, target_id: explicitTargetId } satisfies AssignmentTarget;
  }

  const planningItemId = toTargetId(input.planning_item_id);
  const executionSegmentId = toTargetId(input.execution_segment_id);
  if (planningItemId && executionSegmentId) {
    return null;
  }

  if (planningItemId) {
    return { target_kind: "planning_item", target_id: planningItemId } satisfies AssignmentTarget;
  }

  if (executionSegmentId) {
    return { target_kind: "execution_segment", target_id: executionSegmentId } satisfies AssignmentTarget;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const target = toAssignmentTarget({
      target_kind: searchParams.get("target_kind"),
      target_id: searchParams.get("target_id"),
      planning_item_id: searchParams.get("planning_item_id"),
      execution_segment_id: searchParams.get("execution_segment_id"),
    });
    if (target) {
      return NextResponse.json({ assignments: await getAssignmentsForTarget(target) });
    }

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
    const { user, profile } = await requireOperationalUser(req);
    const body = (await req.json()) as PlanningAssignmentsReplaceRequestDto;
    const target = toAssignmentTarget({
      target_kind: body.target?.target_kind,
      target_id: body.target?.target_id,
      planning_item_id: body.planning_item_id,
      execution_segment_id: body.execution_segment_id,
    });
    const planningItemId = toPlanningItemId(body.planning_item_id);
    if (!target || !Array.isArray(body.assignments)) {
      return NextResponse.json({ error: "Debes indicar un target y una lista de asignaciones validos." }, { status: 400 });
    }

    if (target.target_kind === "planning_item" && planningItemId) {
      return NextResponse.json({
        assignments: await savePlanningAssignments({
          actor: { user, profile },
          planningItemId,
          assignments: body.assignments,
        }),
      });
    }

    return NextResponse.json({
      assignments: await saveAssignmentsForTarget({
        actor: { user, profile },
        target,
        assignments: body.assignments,
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
