"use client";

import { useState, type FormEvent } from "react";
import { fetchPlanningCatalog } from "@/modules/planning/application/planning-reads.client";
import { mutatePlanningCatalog } from "@/modules/planning/application/planning-writes.client";
import { saveCatalogCache } from "@/lib/localOfflineStore";
import type {
  DetailAdminForm,
  EditDetailForm,
  EditLevelForm,
  EditTypeForm,
  LevelAdminForm,
  PlanningCatalog,
  TypeAdminForm,
} from "./planning-page-models";
import { syncDetailAdminForm } from "./planning-page-transformers";

type UsePlanningCatalogAdminArgs = {
  accessToken?: string;
  onRefresh: (catalog: PlanningCatalog) => void;
  getRequestErrorMessage: (error: unknown, fallback: string) => string;
};

export function usePlanningCatalogAdmin({
  accessToken,
  onRefresh,
  getRequestErrorMessage,
}: UsePlanningCatalogAdminArgs) {
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogFormError, setCatalogFormError] = useState("");
  const [typeForm, setTypeForm] = useState<TypeAdminForm>({
    category: "actividad",
    label: "",
  });
  const [levelForm, setLevelForm] = useState<LevelAdminForm>({ label: "" });
  const [detailForm, setDetailForm] = useState<DetailAdminForm>({
    category: "actividad",
    typeId: "",
    label: "",
  });
  const [editingType, setEditingType] = useState<EditTypeForm | null>(null);
  const [editingLevel, setEditingLevel] = useState<EditLevelForm | null>(null);
  const [editingDetail, setEditingDetail] = useState<EditDetailForm | null>(null);

  async function refreshCatalog() {
    const nextCatalog = await fetchPlanningCatalog(accessToken);
    void saveCatalogCache(nextCatalog);
    setDetailForm((current) => syncDetailAdminForm(current, nextCatalog.categories));
    setEditingDetail((current) =>
      current ? { ...current, ...syncDetailAdminForm(current, nextCatalog.categories) } : null
    );
    setEditingLevel((current) =>
      current && nextCatalog.levels.some((level) => level.id === current.id) ? current : null
    );
    onRefresh(nextCatalog);
  }

  async function mutateCatalog(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) {
    await mutatePlanningCatalog(method, payload, accessToken);
    await refreshCatalog();
  }

  async function handleCreateType(event: FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!accessToken) {
      setCatalogFormError("Necesitas iniciar sesion para administrar el catalogo.");
      return;
    }

    setCatalogBusy(true);

    try {
      await mutateCatalog("POST", {
        entity: "type",
        category: typeForm.category,
        label: typeForm.label,
      });
      setTypeForm((current) => ({ ...current, label: "" }));
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo crear el tipo."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleCreateDetail(event: FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!accessToken) {
      setCatalogFormError("Necesitas iniciar sesion para administrar el catalogo.");
      return;
    }

    setCatalogBusy(true);

    try {
      await mutateCatalog("POST", {
        entity: "detail",
        type_id: Number(detailForm.typeId),
        label: detailForm.label,
      });
      setDetailForm((current) => ({ ...current, label: "" }));
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo crear el detalle."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleCreateLevel(event: FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!accessToken) {
      setCatalogFormError("Necesitas iniciar sesion para administrar el catalogo.");
      return;
    }

    setCatalogBusy(true);

    try {
      await mutateCatalog("POST", {
        entity: "level",
        label: levelForm.label,
      });
      setLevelForm({ label: "" });
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo crear el nivel."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleUpdateType(event: FormEvent) {
    event.preventDefault();
    if (!editingType) {
      return;
    }

    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("PATCH", {
        entity: "type",
        id: editingType.id,
        category: editingType.category,
        label: editingType.label,
      });
      setEditingType(null);
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo editar el tipo."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleUpdateDetail(event: FormEvent) {
    event.preventDefault();
    if (!editingDetail) {
      return;
    }

    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("PATCH", {
        entity: "detail",
        id: editingDetail.id,
        type_id: Number(editingDetail.typeId),
        label: editingDetail.label,
      });
      setEditingDetail(null);
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo editar el detalle."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleUpdateLevel(event: FormEvent) {
    event.preventDefault();
    if (!editingLevel) {
      return;
    }

    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("PATCH", {
        entity: "level",
        id: editingLevel.id,
        label: editingLevel.label,
      });
      setEditingLevel(null);
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo editar el nivel."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleDeleteType(id: number) {
    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("DELETE", {
        entity: "type",
        id,
      });
      if (editingType?.id === id) {
        setEditingType(null);
      }
      if (editingDetail) {
        setEditingDetail(null);
      }
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo eliminar el tipo."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleDeleteLevel(id: number) {
    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("DELETE", {
        entity: "level",
        id,
      });
      if (editingLevel?.id === id) {
        setEditingLevel(null);
      }
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo eliminar el nivel."));
    } finally {
      setCatalogBusy(false);
    }
  }

  async function handleDeleteDetail(id: number) {
    setCatalogFormError("");
    setCatalogBusy(true);

    try {
      await mutateCatalog("DELETE", {
        entity: "detail",
        id,
      });
      if (editingDetail?.id === id) {
        setEditingDetail(null);
      }
    } catch (error: unknown) {
      setCatalogFormError(getRequestErrorMessage(error, "No se pudo eliminar el detalle."));
    } finally {
      setCatalogBusy(false);
    }
  }

  return {
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
  };
}
