import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errorMessage";
import { requestAccess } from "@/server/services/profile.service";

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

    const result = await requestAccess({
      name,
      email,
      password,
      isBootstrapAdmin,
    });

    if (result.status === "conflict") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    if (result.status === "auth-error") {
      return NextResponse.json(
        { error: "No se pudo crear la cuenta en Supabase. Revisa si el correo ya existe." },
        { status: 400 }
      );
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
