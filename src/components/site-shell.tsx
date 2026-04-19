"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseAuth } from "@/lib/authClient";
import { useAuth } from "@/providers/auth-provider";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, session, user, profile } = useAuth();

  useEffect(() => {
    if (!loading && (!session || !profile)) {
      router.replace("/login");
    }
  }, [loading, profile, router, session]);

  async function signOut() {
    await supabaseAuth.auth.signOut();

    if (typeof window !== "undefined") {
      window.location.assign(`${window.location.origin}/login`);
      return;
    }

    router.replace("/login");
  }

  if (loading && (!session || !profile)) {
    return (
      <main className="app-background auth-layout">
        <section className="auth-card">
          <p className="eyebrow">Mineria MVP</p>
          <h1 className="hero-title" style={{ fontSize: "2.125rem" }}>Cargando</h1>
          <p className="body-copy" style={{ marginTop: 0 }}>
            Validando tu sesion.
          </p>
        </section>
      </main>
    );
  }

  if (!session || !profile) {
    return null;
  }

  return (
    <div className="app-background">
      <header className="app-header-shell">
        <div className="app-header-inner">
          <div className="app-header app-header-panel">
            <div className="header-stack">
              <div className="header-row">
                <div className="header-copy-block">
                  <div className="header-badge-row">
                    <span className="header-badge header-badge-strong">Mineria MVP</span>
                    <span className="header-badge">Operacion diaria</span>
                  </div>
                  <h1 className="header-title">Control Gantt Operacional</h1>
                  <p className="header-copy">
                    Seguimiento visual de actividades e interferencias por fecha, turno, nivel y frente para apoyar la coordinacion diaria de la operacion minera.
                  </p>
                </div>

                <div className="header-actions">
                  {!loading && session ? (
                    <span className="header-session-pill">{user?.email ?? "Sesion activa"}</span>
                  ) : (
                    <span className="header-session-pill">Sesion no iniciada</span>
                  )}
                  <Link href="/" className="button">
                    Inicio
                  </Link>
                  {!loading && profile?.role === "admin" ? (
                    <Link href="/admin/users" className="button">
                      Usuarios
                    </Link>
                  ) : null}
                  {!loading && session ? (
                    <button type="button" onClick={() => void signOut()} className="button">
                      Cerrar sesion
                    </button>
                  ) : (
                    <Link href="/login" className="button primary">
                      Login
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="app-frame">
        <main>{children}</main>
      </div>
    </div>
  );
}
