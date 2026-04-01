import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function getSupabaseServerClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
