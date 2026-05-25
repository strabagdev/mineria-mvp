import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "./contracts";

function toAuthenticatedUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    metadata: user.user_metadata,
    provider: "supabase",
  };
}

export async function requireAuthSessionUser(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw new Error("Missing Bearer token");
  }

  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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

  return { user: toAuthenticatedUser(data.user), token, provider: "supabase" };
}
