"use client";

import type { EmailOtpType, Session } from "@supabase/supabase-js";
import {
  assertSupabaseAuthConfigured,
  hasSupabaseAuthConfiguration,
  supabaseAuth,
} from "@/lib/authClient";
import {
  AuthNetworkError,
  isRetryableAuthProviderError,
} from "@/lib/authErrors";
import { NETWORK_ERROR_MESSAGE, isBrowserOffline } from "@/lib/networkStatus";
import type { AppAuthError, AppSession } from "./auth-types";
import type { AuthProviderAdapter } from "./auth-provider-adapter";

function toAppAuthError(error: { message?: string } | null | undefined): AppAuthError | null {
  if (!error) {
    return null;
  }

  return {
    message: error.message || "Authentication error",
  };
}

function throwIfAuthNetworkFailure(error: unknown) {
  if (isRetryableAuthProviderError(error)) {
    throw new AuthNetworkError(NETWORK_ERROR_MESSAGE, { cause: error });
  }
}

function assertAuthProviderAvailable() {
  assertSupabaseAuthConfigured();

  if (isBrowserOffline()) {
    throw new AuthNetworkError(NETWORK_ERROR_MESSAGE);
  }
}

function toAppSession(session: Session | null): AppSession | null {
  if (!session?.access_token) {
    return null;
  }

  return {
    access_token: session.access_token,
    provider: "supabase",
    user: {
      id: session.user.id,
      email: session.user.email,
      provider: "supabase",
    },
  };
}

export const supabaseAuthAdapter: AuthProviderAdapter = {
  id: "supabase",
  capabilities: ["password-sign-in", "session-listener", "oauth-callback", "email-otp", "bearer-token"],
  async getCurrentSession() {
    assertAuthProviderAvailable();
    const { data, error } = await supabaseAuth.auth.getSession();
    throwIfAuthNetworkFailure(error);
    return toAppSession(data.session ?? null);
  },
  async signInWithPassword(input) {
    assertAuthProviderAvailable();
    const { data, error } = await supabaseAuth.auth.signInWithPassword(input);
    throwIfAuthNetworkFailure(error);

    return {
      session: toAppSession(data.session ?? null),
      error: toAppAuthError(error),
    };
  },
  async signOut() {
    assertAuthProviderAvailable();
    const { error } = await supabaseAuth.auth.signOut();
    throwIfAuthNetworkFailure(error);

    if (error) {
      throw new Error(error.message);
    }
  },
  onSessionChange(listener) {
    if (!hasSupabaseAuthConfiguration()) {
      return () => undefined;
    }

    const { data } = supabaseAuth.auth.onAuthStateChange((_event, nextSession) => {
      listener(toAppSession(nextSession ?? null));
    });

    return () => {
      data.subscription.unsubscribe();
    };
  },
  async exchangeCodeForSession(code) {
    assertAuthProviderAvailable();
    const { error } = await supabaseAuth.auth.exchangeCodeForSession(code);
    throwIfAuthNetworkFailure(error);

    return {
      error: toAppAuthError(error),
    };
  },
  async verifyEmailOtp(input) {
    assertAuthProviderAvailable();
    const { error } = await supabaseAuth.auth.verifyOtp({
      token_hash: input.token_hash,
      type: input.type as EmailOtpType,
    });
    throwIfAuthNetworkFailure(error);

    return {
      error: toAppAuthError(error),
    };
  },
};
