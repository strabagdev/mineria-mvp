import { NextResponse } from "next/server";
import {
  requireAdminUser,
  resolveRole,
  USER_ROLES,
} from "@/lib/accessControl";
import { getErrorMessage, getErrorStatus } from "@/lib/errorMessage";
import {
  createUser,
  deleteUserPermanently,
  listUsers,
  resetUserPassword,
  updateUserAccess,
  USER_DELETE_BLOCKED_BY_ACTIVITY_MESSAGE,
} from "@/server/services/users.service";

export async function GET(req: Request) {
  try {
    const { user } = await requireAdminUser(req);
    return NextResponse.json(await listUsers({ currentUserId: user.id }));
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = resolveRole(String(body.role ?? USER_ROLES.VIEWER));

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Completa nombre, correo y contrasena del usuario." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    const result = await createUser({
      actor: { user, profile },
      name,
      email,
      password,
      role,
    });

    if (result.status === "auth-error") {
      return NextResponse.json(
        { error: "No se pudo crear el usuario en Supabase. Revisa si el correo ya existe." },
        { status: 400 }
      );
    }

    return NextResponse.json({ user: result.user }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as {
      user_id?: string;
      action?: "update-role" | "toggle-active" | "update-approval-status" | "reset-password";
      role?: string;
      active?: boolean;
      approval_status?: string;
      password?: string;
    };
    const userId = String(body.user_id ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "Usuario no valido para la operacion." }, { status: 400 });
    }

    if (body.action === "reset-password") {
      const password = String(body.password ?? "");

      if (password.length < 8) {
        return NextResponse.json(
          { error: "La nueva contrasena debe tener al menos 8 caracteres." },
          { status: 400 }
        );
      }

      await resetUserPassword({
        actor: { user, profile },
        userId,
        password,
      });

      return NextResponse.json({ ok: true });
    }

    if (
      body.action !== "update-role" &&
      body.action !== "toggle-active" &&
      body.action !== "update-approval-status"
    ) {
      return NextResponse.json({ error: "Accion no soportada." }, { status: 400 });
    }

    const result = await updateUserAccess({
      actor: { user, profile },
      userId,
      action: body.action,
      role: body.role,
      active: body.active,
      approvalStatus: body.approval_status,
    });

    if (result.status === "missing-access-columns") {
      return NextResponse.json(
        {
          error:
            "La tabla profiles aun no tiene columnas de permisos. Ejecuta la migracion de supabase/sql/001_schema.sql para aprobar usuarios y cambiar roles.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ user: result.user });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireAdminUser(req);
    const body = (await req.json()) as {
      user_id?: string;
    };
    const userId = String(body.user_id ?? "").trim();

    if (!userId) {
      return NextResponse.json({ error: "Usuario no valido para la operacion." }, { status: 400 });
    }

    const result = await deleteUserPermanently({
      actor: { user, profile },
      userId,
    });

    if (result.status === "deleted") {
      return NextResponse.json({ ok: true });
    }

    if (result.status === "not-found") {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    if (result.status === "self-delete-blocked") {
      return NextResponse.json(
        { error: "No puedes eliminar tu propio usuario." },
        { status: 400 }
      );
    }

    if (result.status === "last-admin-blocked") {
      return NextResponse.json(
        { error: "No puedes eliminar el ultimo administrador activo y aprobado." },
        { status: 400 }
      );
    }

    if (result.status === "has-activity") {
      return NextResponse.json(
        { error: USER_DELETE_BLOCKED_BY_ACTIVITY_MESSAGE, references: result.references },
        { status: 409 }
      );
    }

    if (result.status === "auth-error") {
      return NextResponse.json(
        { error: "No se pudo eliminar la identidad del usuario en Supabase Auth." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error:
          "La identidad Auth fue eliminada, pero no se pudo eliminar el perfil. El perfil quedo inactivo para impedir acceso.",
      },
      { status: 500 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: getErrorStatus(error) });
  }
}
