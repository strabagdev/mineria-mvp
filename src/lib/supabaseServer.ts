import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function getSupabaseServerClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export function getSupabaseAuthAdminClient() {
  return createClient(serverEnv.supabaseAuthUrl, serverEnv.supabaseAuthServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
