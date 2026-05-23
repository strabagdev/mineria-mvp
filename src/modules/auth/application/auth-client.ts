"use client";

import type { EmailOtpType, Session } from "@supabase/supabase-js";
import { supabaseAuth } from "@/lib/authClient";
import type { AppAuthError, AppEmailOtpType, AppSession } from "./auth-types";

type SignInWithPasswordInput = {
  email: string;
  password: string;
};

type VerifyEmailOtpInput = {
  token_hash: string;
  type: AppEmailOtpType;
};

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
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
}

export async function getCurrentAuthSession() {
  const { data } = await supabaseAuth.auth.getSession();
  return toAppSession(data.session ?? null);
}

export async function signInWithPassword(input: SignInWithPasswordInput) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword(input);

  return {
    session: toAppSession(data.session ?? null),
    error: toAppAuthError(error),
  };
}

export async function signOut() {
  await supabaseAuth.auth.signOut();
}

export function onAuthSessionChange(listener: (session: AppSession | null) => void) {
  const { data } = supabaseAuth.auth.onAuthStateChange((_event, nextSession) => {
    listener(toAppSession(nextSession ?? null));
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

export async function exchangeCodeForSession(code: string) {
  const { error } = await supabaseAuth.auth.exchangeCodeForSession(code);

  return {
    error: toAppAuthError(error),
  };
}

export async function verifyEmailOtp(input: VerifyEmailOtpInput) {
  const { error } = await supabaseAuth.auth.verifyOtp({
    token_hash: input.token_hash,
    type: input.type as EmailOtpType,
  });

  return {
    error: toAppAuthError(error),
  };
}
