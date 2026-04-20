"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseAuth } from "@/lib/authClient";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: {
    user_id: string;
    email: string;
    full_name: string | null;
    role: "admin" | "viewer";
    active: boolean;
    approval_status: "pending" | "approved" | "rejected";
  } | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextValue["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<AuthContextValue["profile"]>(null);

  useEffect(() => {
    let mounted = true;

    async function syncProfile(nextSession: Session | null): Promise<AuthContextValue["profile"]> {
      if (!nextSession?.access_token) {
        return null;
      }

      try {
        const response = await fetch("/api/profile/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${nextSession.access_token}` },
        });
        const json = await response.json().catch(() => ({}));

        if (!response.ok) {
          await supabaseAuth.auth.signOut();
          return null;
        }

        return json.profile ?? null;
      } catch {
        return profileRef.current;
      }
    }

    supabaseAuth.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      sessionRef.current = data.session ?? null;
      const nextProfile = await syncProfile(data.session ?? null);
      if (!mounted) {
        return;
      }
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      setLoading(false);
    });

    const { data } = supabaseAuth.auth.onAuthStateChange((_event, nextSession) => {
      const previousSession = sessionRef.current;
      const hasResolvedSession = Boolean(sessionRef.current && profileRef.current);

      if (!hasResolvedSession) {
        setLoading(true);
      }

      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      sessionRef.current = nextSession ?? null;

      if (hasResolvedSession && nextSession?.user.id === previousSession?.user.id) {
        setLoading(false);
        return;
      }

      void syncProfile(nextSession ?? null).then((nextProfile) => {
        if (!mounted) {
          return;
        }

        profileRef.current = nextProfile;
        setProfile(nextProfile);
        setLoading(false);
      });
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
