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
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top, #fff8e8, transparent 35%), linear-gradient(180deg, #fffaf1 0%, #f6efe1 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 32,
          border: "1px solid rgba(214, 211, 209, 0.8)",
          background: "rgba(255, 255, 255, 0.9)",
          boxShadow: "0 20px 50px rgba(120, 86, 45, 0.08)",
          backdropFilter: "blur(14px)",
          padding: 28,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#b45309" }}>
          Autenticacion
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: 30, lineHeight: 1.1, color: "#1c1917" }}>
          Terminando acceso
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#57534e" }}>{message}</p>
      </section>
    </main>
  );
}
