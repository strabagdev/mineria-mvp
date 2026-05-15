import { requireAuthSessionUser } from "@/server/auth/auth-session";

export async function requireAuthUser(req: Request) {
  return requireAuthSessionUser(req);
}
