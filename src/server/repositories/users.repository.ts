import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type ProfileRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  active: boolean;
  approval_status: string;
  created_at?: string;
  updated_at?: string;
};

export type LegacyProfileRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at?: string;
  updated_at?: string;
};

export const profileSelect =
  "user_id, email, full_name, role, active, approval_status, created_at, updated_at";
export const legacyProfileSelect = "user_id, email, full_name, created_at, updated_at";

export async function listProfiles() {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(profileSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProfileRow[];
}

export async function listLegacyProfiles() {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(legacyProfileSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as LegacyProfileRow[];
}

export async function insertUserProfile(input: {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  approval_status: string;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .insert(input)
    .select(profileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function insertLegacyUserProfile(input: {
  user_id: string;
  email: string;
  full_name: string;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .insert(input)
    .select(legacyProfileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as LegacyProfileRow;
}

export async function getUserProfile(userId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .select(profileSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
}

async function countRows(
  table: string,
  column: string,
  value: string
) {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function countPlanningItemsCreatedBy(userId: string) {
  return countRows("planning_items", "created_by", userId);
}

export async function countExecutionSegmentsCreatedBy(userId: string) {
  return countRows("activity_execution_segments", "created_by", userId);
}

export async function countAuditLogsByActor(userId: string) {
  return countRows("audit_logs", "actor_user_id", userId);
}

export async function countActiveApprovedAdmins() {
  const db = getSupabaseServerClient();
  const { count, error } = await db
    .from("profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("active", true)
    .eq("approval_status", "approved");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function updateUserProfile(userId: string, updates: Record<string, unknown>) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select(profileSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as ProfileRow;
}

export async function deleteUserProfile(userId: string) {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from("profiles")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
