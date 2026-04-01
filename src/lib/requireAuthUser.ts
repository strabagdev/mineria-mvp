import { createClient } from "@supabase/supabase-js";

export async function requireAuthUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw new Error("Missing Bearer token");
  }

  const authUrl =
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!authUrl || !authAnonKey) {
    throw new Error("Missing public Supabase auth configuration");
  }

  const supabase = createClient(authUrl, authAnonKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid session");
  }

  return { user: data.user, token };
}
