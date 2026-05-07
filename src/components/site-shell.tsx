"use client";

import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Home, LogOut, Settings, User, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type MouseEvent, useEffect, useState } from "react";
import { supabaseAuth } from "@/lib/authClient";
import { useAuth } from "@/providers/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";

type ShellIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
type NavItem = {
  href: string;
  label: string;
  icon: ShellIcon;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session, user, profile } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && (!session || !profile)) {
      router.replace("/login");
    }
  }, [loading, profile, router, session]);

  useEffect(() => {
    function syncSidebarWithViewport() {
      setSidebarCollapsed(window.innerWidth <= 720);
    }

    syncSidebarWithViewport();
    window.addEventListener("resize", syncSidebarWithViewport);
    return () => window.removeEventListener("resize", syncSidebarWithViewport);
  }, []);

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

  function openCatalog(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") {
      return;
    }

    event.preventDefault();
    window.dispatchEvent(new CustomEvent("open-planning-catalog"));
  }

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/reports", label: "Reportes", icon: BarChart3 },
    ...(profile.role === "admin"
      ? [
          { href: "/?catalog=1", label: "Catalogo", icon: Settings, onClick: openCatalog },
          { href: "/admin/users", label: "Usuarios", icon: Users },
        ]
      : []),
  ] satisfies NavItem[];
  const sessionDisplayName = profile.full_name?.trim() || profile.email || user?.email || "Sesion activa";

  const renderNavItems = () =>
    navItems.map((item) => {
      const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      const Icon = item.icon;

      return (
        <Link
          key={item.href}
          href={item.href}
          className={`app-nav-item ${isActive ? "active" : ""}`}
          aria-current={isActive ? "page" : undefined}
          title={item.label}
          onClick={item.onClick}
        >
          <Icon aria-hidden className="app-nav-icon" />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <div className={`app-background app-shell-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="app-sidebar" aria-label="Navegacion principal">
        <div className="app-sidebar-brand">
          <div className="app-brand-mark" aria-hidden="true">ZS</div>
          <div className="app-sidebar-brand-copy">
            <span>ZÜBLIN/STRABAG</span>
            <strong>Control Gantt</strong>
          </div>
          <button
            type="button"
            className="app-icon-button app-sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Contraer menu"}
            title={sidebarCollapsed ? "Expandir menu" : "Contraer menu"}
          >
            {sidebarCollapsed ? <ChevronRight aria-hidden /> : <ChevronLeft aria-hidden />}
          </button>
        </div>

        <nav className="app-sidebar-nav">{renderNavItems()}</nav>

        <div className="app-sidebar-footer">
          <ThemeToggle />
          <span className="session-pill" title={profile.email || user?.email || sessionDisplayName}>
            <User aria-hidden className="app-nav-icon" />
            <span>{sessionDisplayName}</span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="app-nav-item app-sidebar-logout"
            aria-label="Cerrar sesion"
            title="Cerrar sesion"
          >
            <LogOut aria-hidden className="app-nav-icon" />
            <span>Cerrar sesion</span>
          </button>
        </div>
      </aside>

      <div className="app-shell-main">
        <div className="app-frame">
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
