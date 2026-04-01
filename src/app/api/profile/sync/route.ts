import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errorMessage";
import { requireAuthUser } from "@/lib/requireAuthUser";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuthUser(req);
    const email = (user.email ?? "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Authenticated user does not have an email." },
        { status: 400 }
      );
    }

    const db = getSupabaseServerClient();
    const { error } = await db.from("profiles").upsert({
      user_id: user.id,
      email,
      full_name: user.user_metadata.full_name ?? user.user_metadata.name ?? null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      const message = getErrorMessage(error);

      // During the platform reset we may authenticate before the domain tables
      // exist. In that case, keep auth usable and report sync as deferred.
      if (
        message.includes("profiles") ||
        message.includes("schema cache") ||
        message.includes("relation")
      ) {
        return NextResponse.json({
          ok: true,
          deferred: true,
          reason: message,
          user_id: user.id,
          email,
        });
      }

      throw error;
    }

    return NextResponse.json({ ok: true, user_id: user.id, email });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
