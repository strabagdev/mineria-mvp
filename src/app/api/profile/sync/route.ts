import { NextResponse } from "next/server";
import { syncProfileForAuthUser } from "@/lib/accessControl";
import { getErrorMessage } from "@/lib/errorMessage";
import { requireAuthUser } from "@/lib/requireAuthUser";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuthUser(req);
    const result = await syncProfileForAuthUser(user);

    if (result.status !== "approved") {
      const messageByStatus = {
        pending: "Tu solicitud existe, pero aun no ha sido aprobada por un administrador.",
        rejected: "Tu solicitud fue rechazada. Pide a un administrador que revise tu acceso.",
        inactive: "Tu cuenta esta inactiva o no esta habilitada para entrar.",
      } as const;

      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          profile: result.profile,
          error: messageByStatus[result.status],
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      profile: result.profile,
      user_id: result.profile.user_id,
      email: result.profile.email,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
