"use client";

import { createClient } from "@supabase/supabase-js";
import { AuthNetworkError } from "@/lib/authErrors";
import { NETWORK_ERROR_MESSAGE, isNetworkRequestError } from "@/lib/networkStatus";
import { recordOperationalEvent } from "@/lib/observability/logger";

const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!authUrl || !authAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
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
      const isNetworkError = isNetworkRequestError(error);

      if (!isNetworkError) {
        throw error;
      }

      if (attempt === AUTH_FETCH_RETRY_DELAYS_MS.length) {
        recordOperationalEvent({
          level: "warn",
          name: "auth.network_fallback",
          source: "authClient",
          metadata: { reason: "auth-fetch-network-error" },
        });
        throw new AuthNetworkError(NETWORK_ERROR_MESSAGE, { cause: error });
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
