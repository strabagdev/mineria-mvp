"use client";

import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Home, LayoutDashboard, LogOut, Settings, User, Users, Wifi, WifiOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type MouseEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getNetworkStatusSnapshot, isBrowserOffline, isNetworkRequestError, subscribeNetworkStatus } from "@/lib/networkStatus";
import { recordOperationalEvent } from "@/lib/observability/logger";
import { buildOperationalState } from "@/lib/operationalState";
import { OfflineRouteContent } from "@/components/offline-route-content";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut as signOutAuthSession } from "@/modules/auth/application/auth-client";

type ShellIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
type OfflineView = null | "home" | "dashboard" | "reports" | "users" | "catalog";
type NavItem = {
  href: string;
  label: string;
  icon: ShellIcon;
  offlineView: Exclude<OfflineView, null>;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session, user, profile } = useAuth();
  const hasOfflineProfile = Boolean(profile && !session);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [offlineView, setOfflineView] = useState<OfflineView>(null);
  const operationalStatus = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkStatusSnapshot,
    () => "offline" as const
  );
  const isOffline = operationalStatus === "offline";
  const shellOperationalState = buildOperationalState({
    network: operationalStatus,
    hasSession: Boolean(session),
    hasOfflineProfile,
  });
  const previousOperationalStatusRef = useRef(operationalStatus);

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
    if (operationalStatus === "online") {
      setOfflineView(null);
    }
  }, [operationalStatus, pathname]);

  useEffect(() => {
    if (previousOperationalStatusRef.current === operationalStatus) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[SiteShell connectivity-pill]", {
        previousStatus: previousOperationalStatusRef.current,
        nextStatus: operationalStatus,
        component: "SiteShell",
      });
    }

    previousOperationalStatusRef.current = operationalStatus;
  }, [operationalStatus]);

  useEffect(() => {
    function handleHistoryNavigation() {
      setOfflineView(null);
    }

    window.addEventListener("popstate", handleHistoryNavigation);

    return () => {
      window.removeEventListener("popstate", handleHistoryNavigation);
    };
  }, []);

  async function signOut() {
    try {
      await signOutAuthSession();
    } catch (error: unknown) {
      const isNetworkError = isNetworkRequestError(error);
      recordOperationalEvent({
        level: isNetworkError ? "warn" : "error",
        name: isNetworkError ? "auth.network_fallback" : "auth.session_recovery_failed",
        source: "SiteShell",
        metadata: {
          reason: isNetworkError ? "sign-out-network-error" : "sign-out-error",
        },
      });
      return;
    }

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
    if (isBrowserOffline()) {
      event.preventDefault();
      setOfflineView("catalog");
      return;
    }
  }

  const adminNavItems: NavItem[] =
    effectiveProfile.role === "admin"
      ? [
          { href: "/catalog", label: "Catalogo", icon: Settings, offlineView: "catalog", onClick: openCatalog },
          { href: "/admin/users", label: "Usuarios", icon: Users, offlineView: "users" },
        ]
      : [];

  const navItems: NavItem[] = [
    { href: "/", label: "Inicio", icon: Home, offlineView: "home" },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, offlineView: "dashboard" },
    { href: "/reports", label: "Reportes", icon: BarChart3, offlineView: "reports" },
    ...adminNavItems,
  ];
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
              event.preventDefault();
              if (item.onClick) {
                item.onClick(event);
                return;
              }
              setOfflineView(item.offlineView);
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
            data-operational-state={shellOperationalState.primary}
            data-operational-severity={shellOperationalState.severity}
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
          <main>
            {offlineView && (offlineView !== "home" || pathname !== "/") ? (
              <OfflineRouteContent view={offlineView} />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
