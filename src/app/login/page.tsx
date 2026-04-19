"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { supabaseAuth } from "@/lib/authClient";

type AuthMode = "signin" | "request";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<AuthMode>("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    supabaseAuth.auth.getSession().then(async ({ data }) => {
      if (!data.session?.access_token) {
        return;
      }

      const synced = await syncProfile(data.session.access_token).catch(() => false);
      if (synced) {
        router.replace("/");
      }
    });
  }, [router]);

  async function syncProfile(token: string) {
    const res = await fetch("/api/profile/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      await supabaseAuth.auth.signOut();
      throw new Error(String(json.error ?? "No se pudo validar tu acceso."));
    }

    return true;
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setMessage("Ingresa correo y contrasena para continuar.");
      return;
    }

    setBusy(true);

    try {
      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.session?.access_token) {
        throw error ?? new Error("No se pudo iniciar sesion.");
      }

      await syncProfile(data.session.access_token);
      router.replace("/");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestAccess(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    setBusy(true);

    try {
      const response = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          confirmPassword,
        }),
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(String(json.error ?? "No se pudo registrar la solicitud."));
      }

      setMessage(String(json.message ?? "Solicitud enviada."));
      setMode("signin");
      setPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-background auth-layout">
      <section className="auth-card">
        <p className="eyebrow">Mineria MVP</p>
        <h1 className="hero-title" style={{ fontSize: "2.125rem" }}>Acceso</h1>
        <p className="body-copy" style={{ marginTop: 0 }}>
          Ingresa con tu cuenta aprobada o solicita acceso para que un administrador habilite tu perfil.
        </p>

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="auth-form">
            <label className="field">
              Correo
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
              Contrasena
              <input
                className="field-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contrasena"
              />
            </label>

            {message ? <p className="feedback">{message}</p> : null}

            <button type="submit" disabled={busy} className="button primary">
              {busy ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestAccess} className="auth-form">
            <label className="field">
              Nombre
              <input
                className="field-input"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre completo"
              />
            </label>

            <label className="field">
              Correo
              <input
                className="field-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
              />
            </label>

            <label className="field">
              Contrasena
              <input
                className="field-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 8 caracteres"
              />
            </label>

            <label className="field">
              Confirmar contrasena
              <input
                className="field-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repite la contrasena"
              />
            </label>

            {message ? <p className="feedback">{message}</p> : null}

            <button type="submit" disabled={busy} className="button primary">
              {busy ? "Enviando..." : "Solicitar acceso"}
            </button>
          </form>
        )}

        <div className="split-note">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "request" : "signin");
              setMessage("");
            }}
            className="button linklike"
          >
            {mode === "signin" ? "Solicitar acceso" : "Volver al login"}
          </button>
          <span className="muted-inline">
            {mode === "signin" ? "Tu cuenta debe estar aprobada" : "La solicitud queda pendiente"}
          </span>
        </div>
      </section>
    </main>
  );
}
