import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type AuditLogRowInput = {
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  metadata: Record<string, unknown> | null;
};

export async function insertAuditLog(input: AuditLogRowInput) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("audit_logs").insert(input);

  return { error };
}
