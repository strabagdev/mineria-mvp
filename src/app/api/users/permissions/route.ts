import { NextResponse } from "next/server";
import { PERMISSIONS, requirePermission } from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import {
  deleteUserPermissionOverride,
  getUserPermissionSummary,
  resolvePermissionEffectOrThrow,
  resolvePermissionOrThrow,
  setUserPermissionOverride,
} from "@/server/services/user-permissions.service";

function getUserId(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(req: Request) {
  try {
    await requirePermission(req, PERMISSIONS.USERS_MANAGE);
    const { searchParams } = new URL(req.url);
    const userId = getUserId(searchParams.get("user_id"));

    if (!userId) {
      return NextResponse.json({ error: "Usuario no valido para la operacion." }, { status: 400 });
    }

    return NextResponse.json(await getUserPermissionSummary(userId));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
    const body = (await req.json()) as {
      user_id?: unknown;
      permission?: unknown;
      effect?: unknown;
    };
    const userId = getUserId(body.user_id);
    const permission = resolvePermissionOrThrow(String(body.permission ?? ""));
    const effect = resolvePermissionEffectOrThrow(String(body.effect ?? ""));

    if (!userId) {
      return NextResponse.json({ error: "Usuario no valido para la operacion." }, { status: 400 });
    }

    return NextResponse.json(
      await setUserPermissionOverride({
        actor: { user, profile },
        userId,
        permission,
        effect,
      })
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requirePermission(req, PERMISSIONS.USERS_MANAGE);
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({})) as {
      user_id?: unknown;
      permission?: unknown;
    };
    const userId = getUserId(body.user_id ?? searchParams.get("user_id"));
    const permission = resolvePermissionOrThrow(
      String(body.permission ?? searchParams.get("permission") ?? "")
    );

    if (!userId) {
      return NextResponse.json({ error: "Usuario no valido para la operacion." }, { status: 400 });
    }

    return NextResponse.json(
      await deleteUserPermissionOverride({
        actor: { user, profile },
        userId,
        permission,
      })
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
