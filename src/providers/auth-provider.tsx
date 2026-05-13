"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseAuth } from "@/lib/authClient";
import { readProfileCache, saveProfileCache } from "@/lib/localOfflineStore";
import { isBrowserOffline, isNetworkRequestError } from "@/lib/networkStatus";

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
  const recoverSessionRef = useRef<() => void>(() => undefined);
  const authNetworkDegradedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const loadingGuardTimer = window.setTimeout(() => {
      if (!mounted) {
        return;
      }

      void readProfileCache<AuthContextValue["profile"]>().then((cachedProfile) => {
        if (!mounted) {
          return;
        }

        if (cachedProfile?.value && !profileRef.current) {
          profileRef.current = cachedProfile.value;
          setProfile(cachedProfile.value);
        }

        setLoading(false);
      }).catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    }, 1800);

    async function syncProfile(nextSession: Session | null): Promise<AuthContextValue["profile"]> {
      if (!nextSession?.access_token) {
        return null;
      }

      // Preferimos cache local para evitar intentos de sync agresivos en redes inestables.
      if (profileRef.current) {
        return profileRef.current;
      }

      const cachedProfile = await readProfileCache<AuthContextValue["profile"]>().catch(() => null);
      if (cachedProfile?.value) {
        return cachedProfile.value;
      }

      if (isBrowserOffline() || authNetworkDegradedRef.current) {
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

        const nextProfile = json.profile ?? null;

        if (nextProfile) {
          void saveProfileCache(nextProfile);
        }

        return nextProfile;
      } catch (error: unknown) {
        if (isNetworkRequestError(error)) {
          authNetworkDegradedRef.current = true;
        }
        return null;
      }
    }

    async function applySession(nextSession: Session | null, options?: { keepLoading?: boolean }) {
      if (!mounted) {
        return;
      }

      if (options?.keepLoading !== false) {
        setLoading(true);
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      sessionRef.current = nextSession;

      const nextProfile = await syncProfile(nextSession);
      if (!mounted) {
        return;
      }

      profileRef.current = nextProfile;
      setProfile(nextProfile);
      setLoading(false);
    }

    async function recoverSession() {
      try {
        const cachedProfile = await readProfileCache<AuthContextValue["profile"]>().catch(() => null);
        if (cachedProfile?.value && mounted) {
          profileRef.current = cachedProfile.value;
          setProfile(cachedProfile.value);
        }

        const sessionPromise = supabaseAuth.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) => {
          window.setTimeout(() => resolve(null), 1200);
        });
        const result = await Promise.race([sessionPromise, timeoutPromise]);

        if (result === null) {
          setLoading(false);
          return;
        }

        const { data } = result;
        await applySession(data.session ?? null, { keepLoading: !sessionRef.current });
      } catch (error: unknown) {
        if (!mounted) {
          return;
        }

        if (!isNetworkRequestError(error)) {
          setLoading(false);
          return;
        }
        authNetworkDegradedRef.current = true;

        const cachedProfile = await readProfileCache<AuthContextValue["profile"]>().catch(() => null);
        if (!mounted) {
          return;
        }

        if (cachedProfile?.value) {
          profileRef.current = cachedProfile.value;
          setProfile(cachedProfile.value);
        }

        setLoading(false);
      }
    }

    recoverSessionRef.current = () => {
      void recoverSession();
    };

    void recoverSession();

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
      window.clearTimeout(loadingGuardTimer);
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let recoverTimer: number | null = null;

    function scheduleRecoverSession() {
      if (!isBrowserOffline()) {
        authNetworkDegradedRef.current = false;
      }
      if (document.visibilityState === "hidden") {
        return;
      }

      if (recoverTimer !== null) {
        window.clearTimeout(recoverTimer);
      }

      recoverTimer = window.setTimeout(() => {
        recoverTimer = null;
        recoverSessionRef.current();
      }, 250);
    }

    window.addEventListener("online", scheduleRecoverSession);
    window.addEventListener("focus", scheduleRecoverSession);
    document.addEventListener("visibilitychange", scheduleRecoverSession);

    return () => {
      if (recoverTimer !== null) {
        window.clearTimeout(recoverTimer);
      }

      window.removeEventListener("online", scheduleRecoverSession);
      window.removeEventListener("focus", scheduleRecoverSession);
      document.removeEventListener("visibilitychange", scheduleRecoverSession);
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
