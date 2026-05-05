"use client";

import { createClient } from "@supabase/supabase-js";
import { isNetworkRequestError } from "@/lib/networkStatus";

const authUrl =
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const authAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!authUrl || !authAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_AUTH_URL/NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY or NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}

const AUTH_FETCH_RETRY_DELAYS_MS = [300, 1000];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function resilientAuthFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= AUTH_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error: unknown) {
      lastError = error;

      if (!isNetworkRequestError(error) || attempt === AUTH_FETCH_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await sleep(AUTH_FETCH_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

export const supabaseAuth = createClient(authUrl, authAnonKey, {
  global: {
    fetch: resilientAuthFetch,
  },
});
