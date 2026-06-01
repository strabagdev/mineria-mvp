"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { NETWORK_ERROR_MESSAGE, assertBrowserOnline, isNetworkRequestError } from "@/lib/networkStatus";
import {
  getCurrentAuthSession,
  signInWithPassword,
  signOut,
} from "@/modules/auth/application/auth-client";

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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setMessage(
        "Sin conexion: puedes continuar solo si ya habias iniciado sesion en este equipo. Para autenticar una cuenta nueva, vuelve a intentar cuando recuperes red."
      );
    }

    getCurrentAuthSession().then(async (session) => {
      if (!session?.access_token) {
        return;
      }

      const synced = await syncProfile(session.access_token).catch(() => false);
      if (synced) {
        router.replace("/");
      }
    }).catch((error: unknown) => {
      setMessage(
        isNetworkRequestError(error)
          ? NETWORK_ERROR_MESSAGE
          : error instanceof Error
            ? error.message
            : "No se pudo validar la sesion."
      );
    });
  }, [router]);

  async function syncProfile(token: string) {
    assertBrowserOnline();

    const res = await fetch("/api/profile/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      await signOut();
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
      assertBrowserOnline();

      const { session, error } = await signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!session?.access_token) {
        throw new Error("No se pudo iniciar sesion.");
      }

      await syncProfile(session.access_token);
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
      assertBrowserOnline();

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
        <p className="eyebrow">ZÜBLIN/STRABAG</p>
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
