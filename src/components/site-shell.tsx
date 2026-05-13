"use client";

import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Home, LayoutDashboard, LogOut, Settings, User, Users, Wifi, WifiOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type MouseEvent, useEffect, useState } from "react";
import { supabaseAuth } from "@/lib/authClient";
import { useAuth } from "@/providers/auth-provider";
import { isBrowserOffline } from "@/lib/networkStatus";
import { OfflineRouteContent } from "@/components/offline-route-content";
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
  const hasOfflineProfile = Boolean(profile && !session);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [offlinePath, setOfflinePath] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(() => isBrowserOffline());

  useEffect(() => {
    if (!loading && !session && !profile) {
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

  useEffect(() => {
    if (!isBrowserOffline()) {
      setOfflinePath(null);
    }
  }, [pathname]);

  useEffect(() => {
    function syncConnectivityState() {
      const nextIsOffline = isBrowserOffline();
      setIsOffline(nextIsOffline);
      if (!nextIsOffline) {
        setOfflinePath(null);
      }
    }

    syncConnectivityState();
    window.addEventListener("online", syncConnectivityState);
    window.addEventListener("offline", syncConnectivityState);
    window.addEventListener("focus", syncConnectivityState);

    return () => {
      window.removeEventListener("online", syncConnectivityState);
      window.removeEventListener("offline", syncConnectivityState);
      window.removeEventListener("focus", syncConnectivityState);
    };
  }, []);

  async function signOut() {
    await supabaseAuth.auth.signOut();

    if (typeof window !== "undefined") {
      window.location.assign(`${window.location.origin}/login`);
      return;
    }

    router.replace("/login");
  }

  if (loading && !session && !profile) {
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

  if (!session && !profile) {
    return null;
  }

  const effectiveProfile = profile ?? {
    user_id: session?.user.id ?? "offline-user",
    email: session?.user.email ?? "",
    full_name: null,
    role: "viewer" as const,
    active: true,
    approval_status: "approved" as const,
  };

  function openCatalog(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/") {
      return;
    }

    event.preventDefault();
    window.dispatchEvent(new CustomEvent("open-planning-catalog"));
  }

  const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/reports", label: "Reportes", icon: BarChart3 },
    ...(effectiveProfile.role === "admin"
      ? [
          { href: "/?catalog=1", label: "Catalogo", icon: Settings, onClick: openCatalog },
          { href: "/admin/users", label: "Usuarios", icon: Users },
        ]
      : []),
  ] satisfies NavItem[];
  const sessionDisplayName = effectiveProfile.full_name?.trim() || effectiveProfile.email || user?.email || "Sesion activa";

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
          onClick={(event) => {
            if (isBrowserOffline()) {
              const nextPath = item.href.split("?")[0] || "/";
              event.preventDefault();
              setOfflinePath(nextPath);
              window.history.pushState(null, "", item.href);
              item.onClick?.(event);
              return;
            }

            item.onClick?.(event);
          }}
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
          <span
            className={`session-pill connectivity-pill ${isOffline ? "offline" : "online"}`}
            title={isOffline ? "Trabajando con datos locales" : "Conexion disponible"}
          >
            {isOffline ? <WifiOff aria-hidden className="app-nav-icon" /> : <Wifi aria-hidden className="app-nav-icon" />}
            <span>{isOffline ? "Modo offline" : "Online"}</span>
          </span>
          <span className="session-pill" title={effectiveProfile.email || user?.email || sessionDisplayName}>
            <User aria-hidden className="app-nav-icon" />
            <span>{sessionDisplayName}</span>
          </span>
          {hasOfflineProfile ? (
            <span className="session-pill" title="Sesion local disponible sin conexion">
              Offline
            </span>
          ) : null}
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
          <main>{offlinePath && offlinePath !== "/" ? <OfflineRouteContent path={offlinePath} /> : children}</main>
        </div>
      </div>
    </div>
  );
}
