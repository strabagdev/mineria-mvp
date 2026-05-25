"use client";

import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { supabaseAuth } from "@/lib/authClient";
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
    const { data } = await supabaseAuth.auth.getSession();
    return toAppSession(data.session ?? null);
  },
  async signInWithPassword(input) {
    const { data, error } = await supabaseAuth.auth.signInWithPassword(input);

    return {
      session: toAppSession(data.session ?? null),
      error: toAppAuthError(error),
    };
  },
  async signOut() {
    await supabaseAuth.auth.signOut();
  },
  onSessionChange(listener) {
    const { data } = supabaseAuth.auth.onAuthStateChange((_event, nextSession) => {
      listener(toAppSession(nextSession ?? null));
    });

    return () => {
      data.subscription.unsubscribe();
    };
  },
  async exchangeCodeForSession(code) {
    const { error } = await supabaseAuth.auth.exchangeCodeForSession(code);

    return {
      error: toAppAuthError(error),
    };
  },
  async verifyEmailOtp(input) {
    const { error } = await supabaseAuth.auth.verifyOtp({
      token_hash: input.token_hash,
      type: input.type as EmailOtpType,
    });

    return {
      error: toAppAuthError(error),
    };
  },
};

