"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { readProfileCache, saveProfileCache } from "@/lib/localOfflineStore";
import { isBrowserOffline, isNetworkRequestError, subscribeNetworkStatus } from "@/lib/networkStatus";
import {
  getCurrentAuthSession,
  onAuthSessionChange,
  signOut,
} from "@/modules/auth/application/auth-client";
import type {
  AppAuthProfile,
  AppSession,
  AppUser,
} from "@/modules/auth/application/auth-types";

type AuthContextValue = {
  session: AppSession | null;
  user: AppUser | null;
  profile: AppAuthProfile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<AuthContextValue["profile"]>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<AppSession | null>(null);
  const profileRef = useRef<AuthContextValue["profile"]>(null);
  const recoverSessionRef = useRef<() => void>(() => undefined);

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

    async function syncProfile(nextSession: AppSession | null): Promise<AuthContextValue["profile"]> {
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

      if (isBrowserOffline()) {
        return null;
      }

      try {
        const response = await fetch("/api/profile/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${nextSession.access_token}` },
        });
        const json = await response.json().catch(() => ({}));

        if (!response.ok) {
          await signOut();
          return null;
        }

        const nextProfile = json.profile ?? null;

        if (nextProfile) {
          void saveProfileCache(nextProfile);
        }

        return nextProfile;
      } catch (error: unknown) {
        isNetworkRequestError(error);
        return null;
      }
    }

    async function applySession(nextSession: AppSession | null, options?: { keepLoading?: boolean }) {
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

        const sessionTimeout = Symbol("session-timeout");
        const sessionPromise = getCurrentAuthSession();
        const timeoutPromise = new Promise<typeof sessionTimeout>((resolve) => {
          window.setTimeout(() => resolve(sessionTimeout), 1200);
        });
        const result = await Promise.race([sessionPromise, timeoutPromise]);

        if (result === sessionTimeout) {
          setLoading(false);
          return;
        }

        await applySession(result, { keepLoading: !sessionRef.current });
      } catch (error: unknown) {
        if (!mounted) {
          return;
        }

        if (!isNetworkRequestError(error)) {
          setLoading(false);
          return;
        }
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

    const unsubscribeAuthSessionChange = onAuthSessionChange((nextSession) => {
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
      unsubscribeAuthSessionChange();
    };
  }, []);

  useEffect(() => {
    let recoverTimer: number | null = null;

    function scheduleRecoverSession() {
      if (document.visibilityState === "hidden" || isBrowserOffline()) {
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

    const unsubscribeNetworkStatus = subscribeNetworkStatus(scheduleRecoverSession);

    return () => {
      if (recoverTimer !== null) {
        window.clearTimeout(recoverTimer);
      }

      unsubscribeNetworkStatus();
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
