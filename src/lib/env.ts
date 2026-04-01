import "server-only";

type ServerEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

function normalizeSupabaseUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    throw new Error("Invalid Supabase URL. Use format: https://<project-ref>.supabase.co");
  }
}

function requireEnv(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing env var: ${name}`);
  }
  return trimmed;
}

export function getServerEnv(): ServerEnv {
  const rawUrl =
    process.env.SUPABASE_DATA_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_DATA_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    supabaseUrl: normalizeSupabaseUrl(
      requireEnv(
        "SUPABASE_DATA_URL (or NEXT_PUBLIC_SUPABASE_AUTH_URL / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL)",
        rawUrl
      )
    ),
    supabaseServiceRoleKey: requireEnv(
      "SUPABASE_DATA_SERVICE_ROLE_KEY (or SUPABASE_AUTH_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY)",
      serviceRoleKey
    ),
  };
}

export const serverEnv = getServerEnv();
