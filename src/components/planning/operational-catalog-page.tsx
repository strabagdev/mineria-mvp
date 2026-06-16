"use client";

import { useCallback, useEffect, useState } from "react";
import { CatalogAdminWorkspace } from "@/components/planning/catalog-admin-workspace";
import { PlanningAssignmentsAdminPanel } from "@/modules/planning-assignments/presentation/planning-assignments-admin-panel";
import { PlanningCustomFieldsAdminPanel } from "@/modules/planning-custom-fields/presentation/planning-custom-fields-admin-panel";
import { fetchPlanningCatalog } from "@/modules/planning/application/planning-reads.client";
import { usePlanningCatalogAdmin } from "@/modules/planning/presentation/use-planning-catalog-admin";
import { syncDetailAdminForm } from "@/modules/planning/presentation/planning-page-transformers";
import type {
  CatalogCategory,
  CatalogLevel,
  PlanningCatalog,
} from "@/modules/planning/presentation/planning-page-models";
import { useAuth } from "@/providers/auth-provider";
import { isNetworkRequestError } from "@/lib/networkStatus";
import { saveCatalogCache } from "@/lib/localOfflineStore";

type CatalogPageSection = "activities" | "levels" | "custom-fields" | "assignments" | "future";

const catalogSections: Array<{ id: CatalogPageSection; label: string }> = [
  { id: "activities", label: "Actividades" },
  { id: "levels", label: "Niveles" },
  { id: "custom-fields", label: "Campos configurables" },
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
  const [levels, setLevels] = useState<CatalogLevel[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [activeSection, setActiveSection] = useState<CatalogPageSection>("activities");

  const syncCatalogState = useCallback((nextCatalog: PlanningCatalog) => {
    setCatalog(nextCatalog.categories);
    setLevels(nextCatalog.levels);
    setCatalogError("");
  }, []);

  const {
    catalogBusy,
    catalogFormError,
    typeForm,
    setTypeForm,
    levelForm,
    setLevelForm,
    detailForm,
    setDetailForm,
    editingType,
    setEditingType,
    editingLevel,
    setEditingLevel,
    editingDetail,
    setEditingDetail,
    handleCreateType,
    handleCreateDetail,
    handleCreateLevel,
    handleUpdateType,
    handleUpdateDetail,
    handleUpdateLevel,
    handleDeleteType,
    handleDeleteLevel,
    handleDeleteDetail,
  } = usePlanningCatalogAdmin({
    accessToken: session?.access_token,
    onRefresh: syncCatalogState,
    getRequestErrorMessage,
  });

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
            Mantiene las listas maestras que alimentan la planificacion: actividades, niveles, campos configurables y asignaciones.
          </p>
        </div>
      </header>

      <nav className="catalog-page-nav" aria-label="Secciones del catalogo">
        {catalogSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? "active" : ""}
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
      ) : (
        <CatalogAdminWorkspace
          catalog={catalog}
          levels={levels}
          catalogLoading={catalogLoading}
          catalogBusy={catalogBusy}
          catalogFormError={catalogFormError}
          typeForm={typeForm}
          setTypeForm={setTypeForm}
          levelForm={levelForm}
          setLevelForm={setLevelForm}
          detailForm={detailForm}
          setDetailForm={setDetailForm}
          editingType={editingType}
          setEditingType={setEditingType}
          editingLevel={editingLevel}
          setEditingLevel={setEditingLevel}
          editingDetail={editingDetail}
          setEditingDetail={setEditingDetail}
          syncDetailAdminForm={syncDetailAdminForm}
          onCreateType={handleCreateType}
          onCreateLevel={handleCreateLevel}
          onCreateDetail={handleCreateDetail}
          onUpdateType={handleUpdateType}
          onUpdateLevel={handleUpdateLevel}
          onUpdateDetail={handleUpdateDetail}
          onDeleteType={(id) => void handleDeleteType(id)}
          onDeleteLevel={(id) => void handleDeleteLevel(id)}
          onDeleteDetail={(id) => void handleDeleteDetail(id)}
          activeSection={activeSection}
          showCounts={false}
          customFieldsAdminSlot={
            <PlanningCustomFieldsAdminPanel
              accessToken={session?.access_token}
            />
          }
        />
      )}
    </section>
  );
}
