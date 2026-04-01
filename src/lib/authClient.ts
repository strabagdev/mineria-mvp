"use client";

import { createClient } from "@supabase/supabase-js";

const authUrl =
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const authAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!authUrl || !authAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_AUTH_URL/NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY."
  );
}

export const supabaseAuth = createClient(authUrl, authAnonKey);
