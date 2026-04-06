"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseAuth } from "@/lib/authClient";
import { useAuth } from "@/providers/auth-provider";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session, user } = useAuth();
  const isAuthRoute = pathname === "/login" || pathname === "/auth/callback";

  async function signOut() {
    await supabaseAuth.auth.signOut();
    router.replace("/login");
  }

  if (isAuthRoute) {
    return <>{children}</>;
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
