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
    <main className="app-background auth-layout">
      <section className="auth-card">
        <p className="eyebrow">Base lista</p>
        <h1 className="hero-title" style={{ fontSize: "2.125rem" }}>Acceso</h1>
        <p className="body-copy" style={{ marginTop: 0 }}>
          Esta base ya permite autenticacion, sesion y creacion de usuarios.
          Desde aqui construimos el producto sobre una pagina limpia.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            Email
            <input
              className="field-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="equipo@empresa.com"
            />
          </label>

          <label className="field">
            Password
            <input
              className="field-input"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo 8 caracteres"
            />
          </label>

          {message ? <p className="feedback">{message}</p> : null}

          <button type="submit" disabled={busy} className="button primary">
            {busy ? "Procesando..." : mode === "signin" ? "Iniciar sesion" : "Crear usuario"}
          </button>

          <button type="button" disabled={busy} onClick={() => void sendMagicLink()} className="button">
            Enviar magic link
          </button>
        </form>

        <div className="split-note">
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="button linklike">
            {mode === "signin" ? "Necesitas una cuenta?" : "Ya tienes cuenta?"}
          </button>
          <span className="muted-inline">
            {mode === "signin" ? "Cambiar a registro" : "Cambiar a login"}
          </span>
        </div>
      </section>
    </main>
  );
}
