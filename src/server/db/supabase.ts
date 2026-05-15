import { supabaseAuth } from "@/lib/authClient";
import {
  getSupabaseAuthAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabaseServer";

// Supabase remains the active provider. This module is the new server/db
// boundary so future migrations to managed PostgreSQL can happen behind it.
// Future adapters could target AWS RDS, Neon, Drizzle, or Prisma.
export {
  getSupabaseAuthAdminClient,
  getSupabaseServerClient,
  supabaseAuth,
};

