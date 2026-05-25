import "server-only";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  metadata?: Record<string, unknown>;
  provider?: string;
};

export type AuthSessionValidationResult = {
  user: AuthenticatedUser;
  token: string;
  provider: string;
};

export type AuthAdminCreateUserInput = {
  email: string;
  password: string;
  name: string;
};

export function getAuthenticatedUserDisplayName(user: Pick<AuthenticatedUser, "email" | "metadata">) {
  const fullName = typeof user.metadata?.full_name === "string" ? user.metadata.full_name.trim() : "";
  const name = typeof user.metadata?.name === "string" ? user.metadata.name.trim() : "";

  return fullName || name || user.email?.split("@")[0] || "Usuario";
}
