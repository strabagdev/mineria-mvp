"use client";

import type { AppAuthError, AppEmailOtpType, AppSession } from "./auth-types";

export type AuthProviderCapability =
  | "password-sign-in"
  | "session-listener"
  | "oauth-callback"
  | "email-otp"
  | "bearer-token";

export type SignInWithPasswordInput = {
  email: string;
  password: string;
};

export type VerifyEmailOtpInput = {
  token_hash: string;
  type: AppEmailOtpType;
};

export type AuthSessionResult = {
  session: AppSession | null;
  error: AppAuthError | null;
};

export type AuthProviderAdapter = {
  id: string;
  capabilities: AuthProviderCapability[];
  getCurrentSession(): Promise<AppSession | null>;
  signInWithPassword(input: SignInWithPasswordInput): Promise<AuthSessionResult>;
  signOut(): Promise<void>;
  onSessionChange(listener: (session: AppSession | null) => void): () => void;
  exchangeCodeForSession(code: string): Promise<{ error: AppAuthError | null }>;
  verifyEmailOtp(input: VerifyEmailOtpInput): Promise<{ error: AppAuthError | null }>;
};

