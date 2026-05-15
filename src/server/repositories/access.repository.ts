import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type AccessProfileRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  active: boolean;
  approval_status: string;
  created_at?: string;
  updated_at?: string;
};

export const accessProfileSelect =
  "user_id, email, full_name, role, active, approval_status, created_at, updated_at";

export async function findProfileForAuthUser(input: { userId: string; email: string }) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(accessProfileSelect)
    .or(`user_id.eq.${input.userId},email.eq.${input.email}`)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AccessProfileRow | null;
}

export async function upsertLegacyAuthProfile(input: {
  user_id: string;
  email: string;
  full_name: string;
  updated_at: string;
}) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("profiles").upsert(input, { onConflict: "user_id" });

  if (error) {
    throw error;
  }
}

export async function upsertAccessProfile(input: {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  active: boolean;
  approval_status: string;
  updated_at: string;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .upsert(input, { onConflict: "user_id" })
    .select(accessProfileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as AccessProfileRow;
}

