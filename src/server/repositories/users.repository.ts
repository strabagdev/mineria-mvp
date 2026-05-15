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

