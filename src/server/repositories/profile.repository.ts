import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type ExistingProfileApprovalRow = {
  approval_status: string;
};

export async function findProfileApprovalByEmail(email: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select("approval_status")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ExistingProfileApprovalRow | null;
}

export async function insertAccessRequestProfile(input: {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  approval_status: string;
}) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("profiles").insert(input);

  if (error) {
    throw error;
  }
}

export async function insertLegacyAccessRequestProfile(input: {
  user_id: string;
  email: string;
  full_name: string;
}) {
  const db = getSupabaseServerClient();
  const { error } = await db.from("profiles").insert(input);

  if (error) {
    throw error;
  }
}

