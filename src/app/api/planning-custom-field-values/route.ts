import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import type { PlanningCustomFieldValuesSaveRequestDto } from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import {
  getCustomFieldValues,
  saveCustomFieldValues,
} from "@/server/services/planning-custom-fields.service";

function toTarget(input: {
  planning_item_id?: unknown;
  execution_segment_id?: unknown;
  activity_group_id?: unknown;
}) {
  const planningItemId = input.planning_item_id === undefined || input.planning_item_id === null || input.planning_item_id === ""
    ? null
    : Number(input.planning_item_id);
  const executionSegmentId = input.execution_segment_id === undefined || input.execution_segment_id === null || input.execution_segment_id === ""
    ? null
    : Number(input.execution_segment_id);
  const activityGroupId = String(input.activity_group_id ?? "").trim() || null;

  if (planningItemId !== null && (!Number.isFinite(planningItemId) || planningItemId <= 0)) {
    return { error: "El programado indicado no es valido." };
  }

  if (executionSegmentId !== null && (!Number.isFinite(executionSegmentId) || executionSegmentId <= 0)) {
    return { error: "El segmento real indicado no es valido." };
  }

  if (!planningItemId && !executionSegmentId && !activityGroupId) {
    return { error: "Debes indicar planning_item_id, execution_segment_id o activity_group_id." };
  }

  return {
    target: {
      planningItemId,
      executionSegmentId,
      activityGroupId,
    },
  };
}

export async function GET(req: Request) {
  try {
    await requireApprovedUser(req);
    const { searchParams } = new URL(req.url);
    const parsed = toTarget({
      planning_item_id: searchParams.get("planning_item_id"),
      execution_segment_id: searchParams.get("execution_segment_id"),
      activity_group_id: searchParams.get("activity_group_id"),
    });

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    return NextResponse.json({ values: await getCustomFieldValues(parsed.target) });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireApprovedUser(req);
    const body = (await req.json()) as PlanningCustomFieldValuesSaveRequestDto;
    const parsed = toTarget(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const values = Array.isArray(body.values) ? body.values : [];
    const savedValues = await saveCustomFieldValues({
      actor: { user, profile },
      target: parsed.target,
      values,
    });

    return NextResponse.json({ values: savedValues });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
