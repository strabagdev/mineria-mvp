import "server-only";

import type { User } from "@supabase/supabase-js";
import type { AppProfile } from "@/lib/accessControl";
import { getSupabaseServerClient } from "@/server/db/supabase";

type AuditActor = {
  user?: Pick<User, "id" | "email"> | null;
  profile?: Pick<AppProfile, "user_id" | "email"> | null;
};

type AuditLogInput = {
  actor?: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown> | null;
};

function toAuditJson(value: unknown) {
  return value === undefined ? null : value;
}

export async function writeAuditLog({
  actor,
  action,
  entityType,
  entityId,
  before,
  after,
  metadata,
}: AuditLogInput) {
  const actorUserId = actor?.profile?.user_id ?? actor?.user?.id ?? null;
  const actorEmail = actor?.profile?.email ?? actor?.user?.email ?? null;

  try {
    const db = getSupabaseServerClient();
    const { error } = await db.from("audit_logs").insert({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action,
      entity_type: entityType,
      entity_id: entityId === undefined || entityId === null ? null : String(entityId),
      before_data: toAuditJson(before),
      after_data: toAuditJson(after),
      metadata: metadata ?? null,
    });

    if (error) {
      console.error("Audit log write failed:", error.message);
    }
  } catch (error: unknown) {
    console.error("Audit log write failed:", error instanceof Error ? error.message : error);
  }
}
