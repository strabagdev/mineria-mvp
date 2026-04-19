import { NextResponse } from "next/server";
import {
  APPROVAL_STATUS,
  requireAdminUser,
  resolveApprovalStatus,
  resolveRole,
  USER_ROLES,
} from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import {
  getSupabaseAuthAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabaseServer";

function selectProfiles() {
  return "user_id, email, full_name, role, active, approval_status, created_at, updated_at";
}

function isMissingAccessColumns(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("role") ||
    message.includes("active") ||
    message.includes("approval_status") ||
    message.includes("schema cache")
  );
}

function legacyUser(row: {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at?: string;
  updated_at?: string;
}) {
  const bootstrapAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isBootstrapAdmin = row.email.trim().toLowerCase() === bootstrapAdminEmail;

  return {
    ...row,
    role: isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
    active: true,
    approval_status: isBootstrapAdmin ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.PENDING,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdminUser(req);
    const db = getSupabaseServerClient();
    const { data, error } = await db
      .from("profiles")
      .select(selectProfiles())
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingAccessColumns(error)) {
        const { data: legacyProfiles, error: legacyError } = await db
          .from("profiles")
          .select("user_id, email, full_name, created_at, updated_at")
          .order("created_at", { ascending: false });

        if (legacyError) {
          throw legacyError;
        }

        return NextResponse.json({ users: (legacyProfiles ?? []).map(legacyUser) });
      }

      throw error;
    }

    return NextResponse.json({ users: data ?? [] });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminUser(req);
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

    const db = getSupabaseServerClient();
    const authAdmin = getSupabaseAuthAdminClient();
    const { data: createdAuthUser, error: authError } = await authAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        full_name: name,
      },
    });

    if (authError || !createdAuthUser.user) {
      return NextResponse.json(
        { error: "No se pudo crear el usuario en Supabase. Revisa si el correo ya existe." },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from("profiles")
      .insert({
        user_id: createdAuthUser.user.id,
        email,
        full_name: name,
        role,
        active: true,
        approval_status: APPROVAL_STATUS.APPROVED,
      })
      .select(selectProfiles())
      .single();

    if (error) {
      if (isMissingAccessColumns(error)) {
        const { data: legacyProfile, error: legacyError } = await db
          .from("profiles")
          .insert({
            user_id: createdAuthUser.user.id,
            email,
            full_name: name,
          })
          .select("user_id, email, full_name, created_at, updated_at")
          .single();

        if (legacyError) {
          await authAdmin.auth.admin.deleteUser(createdAuthUser.user.id).catch(() => undefined);
          throw legacyError;
        }

        return NextResponse.json({ user: legacyUser(legacyProfile) }, { status: 201 });
      } else {
        await authAdmin.auth.admin.deleteUser(createdAuthUser.user.id).catch(() => undefined);
        throw error;
      }
    }

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminUser(req);
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

    const db = getSupabaseServerClient();

    if (body.action === "reset-password") {
      const password = String(body.password ?? "");

      if (password.length < 8) {
        return NextResponse.json(
          { error: "La nueva contrasena debe tener al menos 8 caracteres." },
          { status: 400 }
        );
      }

      const authAdmin = getSupabaseAuthAdminClient();
      const { error } = await authAdmin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });

      if (error) {
        throw error;
      }

      return NextResponse.json({ ok: true });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.action === "update-role") {
      updates.role = resolveRole(String(body.role ?? USER_ROLES.VIEWER));
    } else if (body.action === "toggle-active") {
      updates.active = Boolean(body.active);
    } else if (body.action === "update-approval-status") {
      updates.approval_status = resolveApprovalStatus(
        String(body.approval_status ?? APPROVAL_STATUS.PENDING)
      );
    } else {
      return NextResponse.json({ error: "Accion no soportada." }, { status: 400 });
    }

    const { data, error } = await db
      .from("profiles")
      .update(updates)
      .eq("user_id", userId)
      .select(selectProfiles())
      .single();

    if (error) {
      if (isMissingAccessColumns(error)) {
        return NextResponse.json(
          {
            error:
              "La tabla profiles aun no tiene columnas de permisos. Ejecuta la migracion de supabase/sql/001_schema.sql para aprobar usuarios y cambiar roles.",
          },
          { status: 400 }
        );
      }

      throw error;
    }

    return NextResponse.json({ user: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
