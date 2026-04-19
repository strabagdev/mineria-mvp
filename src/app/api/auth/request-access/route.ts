import { NextResponse } from "next/server";
import { APPROVAL_STATUS, USER_ROLES } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import {
  getSupabaseAuthAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabaseServer";

function isMissingAccessColumns(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("role") ||
    message.includes("active") ||
    message.includes("approval_status") ||
    message.includes("schema cache")
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    const isBootstrapAdmin = process.env.ADMIN_EMAIL?.trim().toLowerCase() === email;

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Completa nombre, correo y ambas contrasenas para solicitar acceso." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Las contrasenas no coinciden." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    const db = getSupabaseServerClient();
    const { data: existingProfile, error: existingProfileError } = await db
      .from("profiles")
      .select("approval_status")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (existingProfile) {
      const message =
        existingProfile.approval_status === APPROVAL_STATUS.PENDING
          ? "Ya existe una solicitud pendiente para este correo."
          : "Este correo ya existe en el sistema. Intenta ingresar o pide revision a un administrador.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

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
        { error: "No se pudo crear la cuenta en Supabase. Revisa si el correo ya existe." },
        { status: 400 }
      );
    }

    const { error: profileError } = await db.from("profiles").insert({
      user_id: createdAuthUser.user.id,
      email,
      full_name: name,
      role: isBootstrapAdmin ? USER_ROLES.ADMIN : USER_ROLES.VIEWER,
      active: true,
      approval_status: isBootstrapAdmin ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.PENDING,
    });

    if (profileError) {
      if (isMissingAccessColumns(profileError)) {
        const { error: legacyProfileError } = await db.from("profiles").insert({
          user_id: createdAuthUser.user.id,
          email,
          full_name: name,
        });

        if (legacyProfileError) {
          await authAdmin.auth.admin.deleteUser(createdAuthUser.user.id).catch(() => undefined);
          throw legacyProfileError;
        }
      } else {
        await authAdmin.auth.admin.deleteUser(createdAuthUser.user.id).catch(() => undefined);
        throw profileError;
      }
    }

    return NextResponse.json({
      ok: true,
      message: isBootstrapAdmin
        ? "Cuenta administradora creada. Ya puedes ingresar."
        : "Solicitud enviada. Un administrador debe aprobar tu acceso antes de ingresar.",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
