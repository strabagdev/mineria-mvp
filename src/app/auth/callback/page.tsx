"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseAuth } from "@/lib/authClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Terminando autenticacion...");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type") as EmailOtpType | null;

      if (code) {
        const { error } = await supabaseAuth.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      } else if (tokenHash && type) {
        const { error } = await supabaseAuth.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      const { data } = await supabaseAuth.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/profile/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const syncError = String(json.error ?? "No se pudo sincronizar el perfil.");

        if (
          syncError.includes("profiles") ||
          syncError.includes("schema cache") ||
          syncError.includes("relation")
        ) {
          router.replace("/");
          return;
        }

        setMessage(syncError);
        return;
      }

      router.replace("/");
    })();
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <p>{message}</p>
    </main>
  );
}
