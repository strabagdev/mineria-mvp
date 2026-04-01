"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabaseAuth } from "@/lib/authClient";

type AuthMode = "signin" | "signup";

function getPublicOrigin() {
  const envOrigin = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (envOrigin) {
    return envOrigin.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return "http://localhost:3000";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    supabaseAuth.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/");
      }
    });
  }, [router]);

  async function syncProfileAndContinue() {
    const { data } = await supabaseAuth.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      throw new Error("No se pudo validar la sesion.");
    }

    const res = await fetch("/api/profile/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const syncError = String(json.error ?? "No se pudo sincronizar el perfil.");

      // During the restructuring phase we allow auth to succeed even if
      // the business database schema is not ready yet.
      if (
        syncError.includes("profiles") ||
        syncError.includes("schema cache") ||
        syncError.includes("relation")
      ) {
        router.replace("/");
        return;
      }

      throw new Error(syncError);
    }

    router.replace("/");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setMessage("Ingresa email y password.");
      return;
    }

    if (mode === "signup" && password.length < 8) {
      setMessage("La password debe tener al menos 8 caracteres.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signin") {
        const { error } = await supabaseAuth.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          throw error;
        }

        await syncProfileAndContinue();
        return;
      }

      const { data, error } = await supabaseAuth.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${getPublicOrigin()}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        await syncProfileAndContinue();
        return;
      }

      setMessage("Usuario creado. Revisa tu correo para confirmar el acceso.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la autenticacion.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setMessage("Ingresa tu email primero.");
      return;
    }

    setBusy(true);

    try {
      const { error } = await supabaseAuth.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${getPublicOrigin()}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setMessage("Enlace enviado. Revisa tu correo.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar el magic link.");
    } finally {
      setBusy(false);
    }
  }

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
          maxWidth: 480,
          background: "rgba(255, 255, 255, 0.9)",
          border: "1px solid rgba(214, 211, 209, 0.8)",
          borderRadius: 32,
          padding: 28,
          boxShadow: "0 20px 50px rgba(120, 86, 45, 0.08)",
          backdropFilter: "blur(14px)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", color: "#b45309" }}>
          Base Lista
        </p>
        <h1 style={{ marginTop: 12, marginBottom: 8, fontSize: 34, lineHeight: 1.1, color: "#1c1917" }}>Acceso</h1>
        <p style={{ marginTop: 0, color: "#57534e", lineHeight: 1.6, fontSize: 14 }}>
          Esta base ya permite autenticacion, sesion y creacion de usuarios.
          Desde aqui construimos el producto sobre una pagina limpia.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, marginTop: 20 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: "#292524" }}>
            Email
            <input
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: 14,
                borderRadius: 18,
                border: "1px solid #d6d3d1",
                background: "#fafaf9",
                color: "#1c1917",
                fontSize: 14,
              }}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="equipo@empresa.com"
            />
          </label>

          <label style={{ fontSize: 14, fontWeight: 600, color: "#292524" }}>
            Password
            <input
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: 14,
                borderRadius: 18,
                border: "1px solid #d6d3d1",
                background: "#fafaf9",
                color: "#1c1917",
                fontSize: 14,
              }}
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo 8 caracteres"
            />
          </label>

          {message ? (
            <p style={{ margin: 0, padding: 14, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 18, color: "#92400e", fontSize: 14 }}>
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: 14,
              borderRadius: 20,
              border: "1px solid #fcd34d",
              background: "#fef3c7",
              color: "#92400e",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {busy ? "Procesando..." : mode === "signin" ? "Iniciar sesion" : "Crear usuario"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void sendMagicLink()}
            style={{
              padding: 14,
              borderRadius: 20,
              border: "1px solid #d6d3d1",
              background: "#fafaf9",
              color: "#44403c",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Enviar magic link
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 18, fontSize: 14 }}>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              color: "#92400e",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {mode === "signin" ? "Necesitas una cuenta?" : "Ya tienes cuenta?"}
          </button>
          <span style={{ color: "#78716c" }}>
            {mode === "signin" ? "Cambiar a registro" : "Cambiar a login"}
          </span>
        </div>
      </section>
    </main>
  );
}
