"use client";

import type { SignInWithPasswordInput, VerifyEmailOtpInput } from "./auth-provider-adapter";
import { supabaseAuthAdapter } from "./supabase-auth-adapter";

const authProviderAdapter = supabaseAuthAdapter;

export async function getCurrentAuthSession() {
  return authProviderAdapter.getCurrentSession();
}

export async function signInWithPassword(input: SignInWithPasswordInput) {
  return authProviderAdapter.signInWithPassword(input);
}

export async function signOut() {
  await authProviderAdapter.signOut();
}

export function onAuthSessionChange(listener: Parameters<typeof authProviderAdapter.onSessionChange>[0]) {
  return authProviderAdapter.onSessionChange(listener);
}

export async function exchangeCodeForSession(code: string) {
  return authProviderAdapter.exchangeCodeForSession(code);
}

export async function verifyEmailOtp(input: VerifyEmailOtpInput) {
  return authProviderAdapter.verifyEmailOtp(input);
}
