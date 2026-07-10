"use client";

import { useCallback, useEffect, useState } from "react";
import { CatalogAdminWorkspace } from "@/components/planning/catalog-admin-workspace";
import { OperationalHeaderAdminPanel } from "@/components/planning/operational-header-admin-panel";
import { PlanningAssignmentsAdminPanel } from "@/modules/planning-assignments/presentation/planning-assignments-admin-panel";
import { fetchOperationalHeaderConfig } from "@/modules/operational-header/application/operational-header.client";
import type { OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";
import { fetchPlanningCatalog } from "@/modules/planning/application/planning-reads.client";
import { usePlanningCatalogAdmin } from "@/modules/planning/presentation/use-planning-catalog-admin";
import { syncDetailAdminForm } from "@/modules/planning/presentation/planning-page-transformers";
import type {
  CatalogCategory,
  PlanningCatalog,
} from "@/modules/planning/presentation/planning-page-models";
import { useAuth } from "@/providers/auth-provider";
import { isNetworkRequestError } from "@/lib/networkStatus";
import { saveCatalogCache } from "@/lib/localOfflineStore";

type CatalogPageSection = "activities" | "operational-header" | "assignments" | "future";

const catalogSections: Array<{ id: CatalogPageSection; label: string; priority?: boolean }> = [
  { id: "operational-header", label: "Cabecera Operacional", priority: true },
  { id: "activities", label: "Actividades" },
  { id: "assignments", label: "Asignaciones" },
  { id: "future", label: "Futuros catalogos" },
];

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (isNetworkRequestError(error)) {
    return "No se pudo conectar con el servidor. Revisa la conexion e intenta nuevamente.";
  }

  return error instanceof Error ? error.message || fallback : fallback;
}

export function OperationalCatalogPage() {
  const { loading: authLoading, session, profile } = useAuth();
  const canManageCatalog = profile?.role === "admin";
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [operationalHeaderConfig, setOperationalHeaderConfig] = useState<OperationalHeaderResponseDto | null>(null);
  const [operationalHeaderLoading, setOperationalHeaderLoading] = useState(false);
  const [operationalHeaderError, setOperationalHeaderError] = useState("");
  const [activeSection, setActiveSection] = useState<CatalogPageSection>("operational-header");

  const syncCatalogState = useCallback((nextCatalog: PlanningCatalog) => {
    setCatalog(nextCatalog.categories);
    setCatalogError("");
  }, []);

  const {
    catalogBusy,
    catalogFormError,
    typeForm,
    setTypeForm,
    detailForm,
    setDetailForm,
    editingType,
    setEditingType,
    editingDetail,
    setEditingDetail,
    handleCreateType,
    handleCreateDetail,
    handleUpdateType,
    handleUpdateDetail,
    handleDeleteType,
    handleDeleteDetail,
  } = usePlanningCatalogAdmin({
    accessToken: session?.access_token,
    onRefresh: syncCatalogState,
    getRequestErrorMessage,
  });

  const loadOperationalHeaderConfig = useCallback(async (activeRef?: { active: boolean }) => {
    if (!session?.access_token) {
      setOperationalHeaderError("Necesitas iniciar sesion para ver la cabecera operacional.");
      setOperationalHeaderLoading(false);
      return;
    }

    setOperationalHeaderLoading(true);
    setOperationalHeaderError("");

    try {
      const config = await fetchOperationalHeaderConfig(session.access_token, { activeOnly: false });

      if (activeRef && !activeRef.active) {
        return;
      }

      setOperationalHeaderConfig(config);
    } catch (error: unknown) {
      if (activeRef && !activeRef.active) {
        return;
      }

      setOperationalHeaderError(getRequestErrorMessage(error, "No se pudo cargar la cabecera operacional."));
    } finally {
      if (!activeRef || activeRef.active) {
        setOperationalHeaderLoading(false);
      }
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (authLoading || !canManageCatalog) {
      setCatalogLoading(false);
      return;
    }

    if (!session?.access_token) {
      setCatalogError("Necesitas iniciar sesion para administrar el catalogo.");
      setCatalogLoading(false);
      return;
    }

    let active = true;
    setCatalogLoading(true);
    setCatalogError("");

    fetchPlanningCatalog(session.access_token)
      .then((nextCatalog) => {
        if (!active) {
          return;
        }

        syncCatalogState(nextCatalog);
        void saveCatalogCache(nextCatalog);
        setDetailForm((current) => syncDetailAdminForm(current, nextCatalog.categories));
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setCatalogError(getRequestErrorMessage(error, "No se pudo cargar el catalogo."));
      })
      .finally(() => {
        if (active) {
          setCatalogLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, canManageCatalog, session?.access_token, setDetailForm, syncCatalogState]);

  useEffect(() => {
    if (
      authLoading ||
      !canManageCatalog ||
      activeSection !== "operational-header"
    ) {
      return;
    }

    const activeRef = { active: true };
    void loadOperationalHeaderConfig(activeRef);

    return () => {
      activeRef.active = false;
    };
  }, [activeSection, authLoading, canManageCatalog, loadOperationalHeaderConfig]);

  if (!authLoading && !canManageCatalog) {
    return (
      <section className="catalog-page">
        <div className="surface-card padded">
          <p className="eyebrow">Catalogo operacional</p>
          <h1 className="section-title">Acceso restringido</h1>
          <p className="body-copy">
            Puedes seguir usando la operación, pero la administración del catálogo está restringida a administradores.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="catalog-page">
      <header className="catalog-page-header">
        <div>
          <p className="eyebrow">Administracion</p>
          <h1 className="section-title">Catalogo operacional</h1>
          <p className="body-copy">
            Mantiene las listas maestras que alimentan la planificacion: actividades, Cabecera Operacional y asignaciones.
          </p>
        </div>
      </header>

      <nav className="catalog-page-nav" aria-label="Secciones del catalogo">
        {catalogSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={[
              activeSection === section.id ? "active" : "",
              section.priority ? "catalog-page-nav-priority" : "",
            ].filter(Boolean).join(" ")}
            aria-pressed={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      {catalogError ? <p className="feedback">{catalogError}</p> : null}

      {activeSection === "future" ? (
        <article className="catalog-future-card">
          <p className="eyebrow">Futuros catalogos</p>
          <h2 className="card-title">Espacio preparado</h2>
          <p className="body-copy">
            Esta pagina queda como punto unico para sumar nuevos catalogos sin volver a crecer el modal de planificacion.
          </p>
        </article>
      ) : activeSection === "assignments" ? (
        <PlanningAssignmentsAdminPanel accessToken={session?.access_token} />
      ) : activeSection === "operational-header" ? (
        <OperationalHeaderAdminPanel
          accessToken={session?.access_token}
          config={operationalHeaderConfig}
          loading={operationalHeaderLoading}
          error={operationalHeaderError}
          onRefresh={() => void loadOperationalHeaderConfig()}
        />
      ) : (
        <CatalogAdminWorkspace
          catalog={catalog}
          catalogLoading={catalogLoading}
          catalogBusy={catalogBusy}
          catalogFormError={catalogFormError}
          typeForm={typeForm}
          setTypeForm={setTypeForm}
          detailForm={detailForm}
          setDetailForm={setDetailForm}
          editingType={editingType}
          setEditingType={setEditingType}
          editingDetail={editingDetail}
          setEditingDetail={setEditingDetail}
          syncDetailAdminForm={syncDetailAdminForm}
          onCreateType={handleCreateType}
          onCreateDetail={handleCreateDetail}
          onUpdateType={handleUpdateType}
          onUpdateDetail={handleUpdateDetail}
          onDeleteType={(id) => void handleDeleteType(id)}
          onDeleteDetail={(id) => void handleDeleteDetail(id)}
          activeSection={activeSection}
          showCounts={false}
        />
      )}
    </section>
  );
}
