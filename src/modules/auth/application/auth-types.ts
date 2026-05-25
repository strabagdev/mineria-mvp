export type AppUser = {
  id: string;
  email?: string;
  provider?: string;
};

export type AppSession = {
  access_token: string;
  provider?: string;
  user: AppUser;
};

export type AppAuthProfile = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "viewer";
  active: boolean;
  approval_status: "pending" | "approved" | "rejected";
};

export type AppAuthError = {
  message: string;
};

export type AppEmailOtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";
