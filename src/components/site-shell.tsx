"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseAuth } from "@/lib/authClient";
import { useAuth } from "@/providers/auth-provider";

type ShellIconName = "home" | "reports" | "users" | "logout" | "login" | "user";

function ShellIcon({ name }: { name: ShellIconName }) {
  if (name === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="m3 10.8 9-7 9 7" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    );
  }

  if (name === "reports") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-7" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M16 19c0-2.2-1.8-4-4-4s-4 1.8-4 4" />
        <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M20 18c0-1.7-1.1-3.1-2.6-3.7" />
        <path d="M17 5.3a2.8 2.8 0 0 1 0 5.4" />
      </svg>
    );
  }

  if (name === "logout") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M10 6H6v12h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </svg>
    );
  }

  if (name === "login") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M14 6h4v12h-4" />
        <path d="m10 8 4 4-4 4" />
        <path d="M14 12H5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
          <p className="eyebrow">ZÜBLIN/STRABAG</p>
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

  const navItems = [
    { href: "/", label: "Inicio", icon: "home" as const },
    { href: "/reports", label: "Reportes", icon: "reports" as const },
    ...(profile.role === "admin"
      ? [{ href: "/admin/users", label: "Usuarios", icon: "users" as const }]
      : []),
  ];

  return (
    <div className="app-background">
      <header className="app-header-shell">
        <div className="app-header-inner">
          <div className="app-header app-header-panel">
            <div className="header-stack">
              <div className="header-row">
                <div className="header-copy-block">
                  <div className="app-brand-mark" aria-hidden="true">ZS</div>
                  <div className="app-brand-copy">
                    <div className="header-badge-row">
                      <span className="header-badge header-badge-strong">ZÜBLIN/STRABAG</span>
                      <span className="header-badge">CC-2010</span>
                    </div>
                    <h1 className="header-title">Control Gantt Operacional</h1>
                  </div>
                </div>

                <nav className="app-nav" aria-label="Navegacion principal">
                  {navItems.map((item) => {
                    const isActive =
                      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`app-nav-item ${isActive ? "active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        title={item.label}
                      >
                        <ShellIcon name={item.icon} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="header-actions">
                  {!loading && session ? (
                    <span className="header-session-pill" title={user?.email ?? "Sesion activa"}>
                      <ShellIcon name="user" />
                      <span>{user?.email ?? "Sesion activa"}</span>
                    </span>
                  ) : (
                    <span className="header-session-pill">Sesion no iniciada</span>
                  )}
                  {!loading && session ? (
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      className="app-icon-button"
                      aria-label="Cerrar sesion"
                      title="Cerrar sesion"
                    >
                      <ShellIcon name="logout" />
                    </button>
                  ) : (
                    <Link href="/login" className="app-nav-item app-nav-item-strong">
                      <ShellIcon name="login" />
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
