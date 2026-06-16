"use client";

import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Home, LayoutDashboard, LogOut, ScrollText, Settings, User, Users, Wifi, WifiOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type MouseEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/providers/auth-provider";
import { getNetworkStatusSnapshot, isBrowserOffline, isNetworkRequestError, subscribeNetworkStatus } from "@/lib/networkStatus";
import { recordOperationalEvent } from "@/lib/observability/logger";
import { buildOperationalState } from "@/lib/operationalState";
import { OfflineRouteContent } from "@/components/offline-route-content";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut as signOutAuthSession } from "@/modules/auth/application/auth-client";
import { loadPendingPlanningMutations } from "@/modules/planning/sync/planning-mutation-queue-store";

type ShellIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
type OfflineView = null | "home" | "dashboard" | "reports" | "users" | "catalog" | "audit";
type NavItem = {
  href: string;
  label: string;
  icon: ShellIcon;
  offlineView: Exclude<OfflineView, null>;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

type PlanningSyncStatusDetail = {
  pendingCount?: number;
  conflictCount?: number;
  syncing?: boolean;
  lastSyncLabel?: string;
  errorMessage?: string;
};

type PlanningSyncSummary = Required<PlanningSyncStatusDetail>;

const EMPTY_SYNC_SUMMARY: PlanningSyncSummary = {
  pendingCount: 0,
  conflictCount: 0,
  syncing: false,
  lastSyncLabel: "",
  errorMessage: "",
};

function normalizeSyncSummary(detail: PlanningSyncStatusDetail): PlanningSyncSummary {
  return {
    pendingCount: Number(detail.pendingCount ?? 0),
    conflictCount: Number(detail.conflictCount ?? 0),
    syncing: Boolean(detail.syncing),
    lastSyncLabel: String(detail.lastSyncLabel ?? ""),
    errorMessage: String(detail.errorMessage ?? ""),
  };
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session, user, profile } = useAuth();
  const hasOfflineProfile = Boolean(profile && !session);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [offlineView, setOfflineView] = useState<OfflineView>(null);
  const [connectivityPopoverOpen, setConnectivityPopoverOpen] = useState(false);
  const [planningSyncSummary, setPlanningSyncSummary] = useState<PlanningSyncSummary>(EMPTY_SYNC_SUMMARY);
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
    pendingSyncCount: planningSyncSummary.pendingCount,
    conflictCount: planningSyncSummary.conflictCount,
    syncing: planningSyncSummary.syncing,
    refreshFailed: Boolean(planningSyncSummary.errorMessage),
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
    let active = true;

    async function loadQueueSummary() {
      const mutations = await loadPendingPlanningMutations().catch(() => []);

      if (!active) {
        return;
      }

      setPlanningSyncSummary((current) => ({
        ...current,
        pendingCount: mutations.filter((mutation) => mutation.status !== "conflict").length,
        conflictCount: mutations.filter((mutation) => mutation.status === "conflict").length,
        errorMessage: current.errorMessage || mutations.find((mutation) => mutation.lastError)?.lastError || "",
      }));
    }

    function handlePlanningSyncStatus(event: Event) {
      const detail = (event as CustomEvent<PlanningSyncStatusDetail>).detail ?? {};
      setPlanningSyncSummary(normalizeSyncSummary(detail));
    }

    void loadQueueSummary();
    window.addEventListener("planning-sync-status", handlePlanningSyncStatus);

    return () => {
      active = false;
      window.removeEventListener("planning-sync-status", handlePlanningSyncStatus);
    };
  }, []);

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
          <p className="eyebrow">OPSAHEAD</p>
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
          { href: "/admin/audit", label: "Auditoria", icon: ScrollText, offlineView: "audit" },
        ]
      : [];

  const navItems: NavItem[] = [
    { href: "/", label: "Operaciones", icon: Home, offlineView: "home" },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, offlineView: "dashboard" },
    { href: "/reports", label: "Reportes", icon: BarChart3, offlineView: "reports" },
    ...adminNavItems,
  ];
  const sessionDisplayName = effectiveProfile.full_name?.trim() || effectiveProfile.email || user?.email || "Sesion activa";
  const connectivityLabel = planningSyncSummary.conflictCount
    ? "Cambios pendientes"
    : planningSyncSummary.syncing
      ? "Sincronizando"
      : planningSyncSummary.pendingCount
        ? "Cambios pendientes"
        : isOffline
          ? "Offline"
          : "Online";
  const connectivityDescription = planningSyncSummary.conflictCount
    ? "Hay cambios con conflicto que requieren revision."
    : planningSyncSummary.syncing
      ? "Enviando cambios locales al servidor."
      : planningSyncSummary.pendingCount
        ? "Hay cambios operacionales esperando sincronizacion."
        : isOffline
          ? "Operando con informacion local."
          : "Conexion disponible.";
  const connectivityTitle = [
    connectivityLabel,
    planningSyncSummary.pendingCount ? `${planningSyncSummary.pendingCount} cambio(s) pendiente(s)` : "",
    planningSyncSummary.conflictCount ? `${planningSyncSummary.conflictCount} conflicto(s)` : "",
    planningSyncSummary.lastSyncLabel ? `Ultima sincronizacion: ${planningSyncSummary.lastSyncLabel}` : "",
    planningSyncSummary.errorMessage,
  ].filter(Boolean).join(" · ");

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
          <div className="app-brand-mark" aria-hidden="true">OA</div>
          <div className="app-sidebar-brand-copy">
            <span>OPSAHEAD</span>
            <strong>MINERÍA</strong>
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
          <div className={`connectivity-control ${connectivityPopoverOpen ? "open" : ""}`}>
            <button
              type="button"
              className={`session-pill connectivity-pill ${isOffline ? "offline" : "online"}`}
              data-operational-state={shellOperationalState.primary}
              data-operational-severity={shellOperationalState.severity}
              aria-expanded={connectivityPopoverOpen}
              aria-label={`Estado de conexion: ${connectivityLabel}`}
              title={connectivityTitle || connectivityDescription}
              onClick={() => setConnectivityPopoverOpen((current) => !current)}
              onBlur={(event) => {
                if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
                  setConnectivityPopoverOpen(false);
                }
              }}
            >
              {isOffline ? <WifiOff aria-hidden className="app-nav-icon" /> : <Wifi aria-hidden className="app-nav-icon" />}
              <span>{connectivityLabel}</span>
              {planningSyncSummary.pendingCount || planningSyncSummary.conflictCount ? (
                <span className="connectivity-count-badge" aria-label={`${planningSyncSummary.pendingCount + planningSyncSummary.conflictCount} cambios pendientes`}>
                  {planningSyncSummary.pendingCount + planningSyncSummary.conflictCount}
                </span>
              ) : null}
            </button>
            <div className="connectivity-popover" role="status">
              <strong>{connectivityLabel}</strong>
              <span>{connectivityDescription}</span>
              <dl>
                <div>
                  <dt>Cambios pendientes</dt>
                  <dd>{planningSyncSummary.pendingCount}</dd>
                </div>
                {planningSyncSummary.conflictCount ? (
                  <div>
                    <dt>Conflictos</dt>
                    <dd>{planningSyncSummary.conflictCount}</dd>
                  </div>
                ) : null}
                {planningSyncSummary.lastSyncLabel ? (
                  <div>
                    <dt>Ultima sincronizacion</dt>
                    <dd>{planningSyncSummary.lastSyncLabel}</dd>
                  </div>
                ) : null}
                {planningSyncSummary.errorMessage ? (
                  <div>
                    <dt>Estado</dt>
                    <dd>{planningSyncSummary.errorMessage}</dd>
                  </div>
                ) : null}
                {isOffline ? (
                  <div>
                    <dt>Modo offline</dt>
                    <dd>Operando con informacion local</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
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
