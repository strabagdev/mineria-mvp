import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

// Supabase remains the active provider. This module is the new server/db
// boundary so future migrations to managed PostgreSQL can happen behind it.
// Future adapters could target AWS RDS, Neon, Drizzle, or Prisma.
export function getSupabaseServerClient() {
  const serverEnv = getServerEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export function getSupabaseAuthAdminClient() {
  const serverEnv = getServerEnv();

  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
