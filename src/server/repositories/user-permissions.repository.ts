import "server-only";

import { getSupabaseServerClient } from "@/server/db/supabase";

export type UserPermissionEffect = "allow" | "deny";

export type UserPermissionRow = {
  id: number;
  user_id: string;
  permission: string;
  effect: UserPermissionEffect;
  created_at?: string;
  updated_at?: string;
};

export const userPermissionSelect =
  "id, user_id, permission, effect, created_at, updated_at";

export async function listUserPermissionRows(userId: string) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("user_permissions")
    .select(userPermissionSelect)
    .eq("user_id", userId)
    .order("permission", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as UserPermissionRow[];
}

export async function getUserPermissionRow(input: {
  userId: string;
  permission: string;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("user_permissions")
    .select(userPermissionSelect)
    .eq("user_id", input.userId)
    .eq("permission", input.permission)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as UserPermissionRow | null;
}

export async function upsertUserPermissionRow(input: {
  userId: string;
  permission: string;
  effect: UserPermissionEffect;
}) {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from("user_permissions")
    .upsert(
      {
        user_id: input.userId,
        permission: input.permission,
        effect: input.effect,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,permission" }
    )
    .select(userPermissionSelect)
    .single();

  if (error) {
    throw error;
  }

  return data as UserPermissionRow;
}

export async function deleteUserPermissionRow(input: {
  userId: string;
  permission: string;
}) {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from("user_permissions")
    .delete()
    .eq("user_id", input.userId)
    .eq("permission", input.permission);

  if (error) {
    throw error;
  }
}
