import "server-only";

import { getSupabaseAuthAdminClient } from "@/server/db/supabase";
import type { AuthAdminCreateUserInput } from "./contracts";

export async function createAuthUser(input: AuthAdminCreateUserInput) {
  const authAdmin = getSupabaseAuthAdminClient();

  return authAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      full_name: input.name,
    },
  });
}

export async function deleteAuthUser(userId: string) {
  const authAdmin = getSupabaseAuthAdminClient();
  return authAdmin.auth.admin.deleteUser(userId);
}

export async function updateAuthUserById(
  userId: string,
  input: { password: string; email_confirm: true }
) {
  const authAdmin = getSupabaseAuthAdminClient();
  return authAdmin.auth.admin.updateUserById(userId, input);
}
