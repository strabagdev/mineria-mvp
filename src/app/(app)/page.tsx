"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { CatalogSheet } from "@/components/planning/catalog-sheet";
import { DeleteConfirmationDialog } from "@/components/planning/delete-confirmation-dialog";
import { GanttShiftSection } from "@/components/planning/gantt-shift-section";
import { HistoricalModeStrip } from "@/components/planning/historical-mode-strip";
import { OperationalHero } from "@/components/planning/operational-hero";
import { PlanningDetailDialog } from "@/components/planning/planning-detail-dialog";
import { PlanningSheet } from "@/components/planning/planning-sheet";
import { PlanningStatusStrip } from "@/components/planning/planning-status-strip";
import {
  fetchPlanningCatalog,
  fetchPlanningItems,
} from "@/modules/planning/application/planning-reads.client";
import {
  PlanningMutationRequestError,
  sendPlanningMutation as sendPlanningMutationRequest,
} from "@/modules/planning/application/planning-writes.client";
import {
  isBrowserOffline,
  isNetworkRequestError,
  subscribeNetworkStatus,
} from "@/lib/networkStatus";
import {
  readCatalogCache,
  readPlanningCache,
  saveCatalogCache,
  savePlanningCache,
} from "@/lib/localOfflineStore";
import {
  buildEventSubtitle,
  buildEventTitle,
  buildGanttBarLabel,
  buildGanttScale,
  buildPlanningItemAriaLabel,
  formatDateLabel,
  formatDateTitle,
  formatDuration,
  formatLocalDateIso,
  formatLocalDateTime,
  formatMonthTitle,
  getCalendarDays,
  getDefaultRealEventTimes,
  getDefaultShiftTimes,
  isSameCalendarMonth,
  positionMinutesInScale,
  SHIFT_CONFIG,
  toDisplayCategory,
  toTrackingTypeLabel,
  type GanttScale,
  type ShiftKey,
} from "@/modules/planning/presentation/planning-page-helpers";
import type {
  CatalogCategory,
  CatalogLevel,
  PlanningCatalog,
  PlanningGroup,
  PlanningItem,
  PlanningItemForm,
} from "@/modules/planning/presentation/planning-page-models";
import {
  findSegmentContinuation,
  groupPlanningItems,
  syncDetailAdminForm,
  syncPlanningForm,
  toInitialPlanningForm,
} from "@/modules/planning/presentation/planning-page-transformers";
import { usePlanningCatalogAdmin } from "@/modules/planning/presentation/use-planning-catalog-admin";
import { usePlanningRealtime } from "@/modules/planning/presentation/use-planning-realtime";
import {
  applyPendingPlanningMutations,
  discardConflictedPlanningMutations as discardConflictedPlanningMutationQueue,
  getRetryablePlanningMutations,
  makePendingPlanningMutation,
  replayPendingPlanningMutations,
  withClientMutationId,
} from "@/modules/planning/sync/planning-mutation-queue";
import {
  loadPendingPlanningMutations,
  persistPendingPlanningMutations,
} from "@/modules/planning/sync/planning-mutation-queue-store";
import {
  PENDING_SYNC_RETRY_INTERVAL_MS,
  type PendingPlanningMutation,
} from "@/modules/planning/sync/planning-sync-models";

type PlanningItemMutationPayload = PlanningItemForm & {
  id?: number;
  client_mutation_id?: string;
};

type EditingPlanningItem = {
  id: number;
};

type DeleteConfirmation = {
  id: number;
  label: string;
  trackingType: "programado" | "real";
} | null;

type ViewingPlanningItem = PlanningItem | null;

const AUTH_SYNC_ERROR_MESSAGE =
  "Los registros siguen guardados en este equipo. No pudimos sincronizarlos todavia; se reintentara automaticamente cuando la conexion este estable.";
const PLANNING_NETWORK_ERROR_MESSAGE =
  "No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; la planificacion local seguira disponible.";

function isInvalidSessionError(error: unknown) {
  return error instanceof Error && /invalid session/i.test(error.message);
}

function isPlanningConflictError(error: unknown) {
  return (
    error instanceof PlanningMutationRequestError &&
    (error.status === 409 || /solapa|conflicto|conflict/i.test(error.message))
  );
}

function shouldQueuePlanningMutation(error: unknown) {
  return (
    isBrowserOffline() ||
    isNetworkRequestError(error) ||
    isInvalidSessionError(error)
  );
}

function isRetryablePlanningSyncError(error: unknown) {
  return isNetworkRequestError(error) || isInvalidSessionError(error) || isBrowserOffline();
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (isNetworkRequestError(error)) {
    return PLANNING_NETWORK_ERROR_MESSAGE;
  }

  if (isInvalidSessionError(error)) {
    return AUTH_SYNC_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message || fallback : fallback;
}

function isTransientConnectivityMessage(message: string) {
  return (
    message === PLANNING_NETWORK_ERROR_MESSAGE ||
    /^Usando planificacion local guardada\./.test(message) ||
    /^Usando catalogo local guardado\./.test(message) ||
    /^Usando datos locales guardados\./.test(message)
  );
}

export default function Home() {
  const { session, profile } = useAuth();
  const canManageCatalog = profile?.role === "admin";
  const todayIso = formatLocalDateIso();
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [levels, setLevels] = useState<CatalogLevel[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [historicalEditingEnabled, setHistoricalEditingEnabled] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${todayIso}T00:00:00`));
  const [activeShift, setActiveShift] = useState<ShiftKey>("Dia");
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [pendingPlanningMutations, setPendingPlanningMutations] = useState<PendingPlanningMutation[]>([]);
  const syncPendingPlanningMutationsRef = useRef<() => void>(() => undefined);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [viewingPlanningItem, setViewingPlanningItem] = useState<ViewingPlanningItem>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingPlanningItem, setEditingPlanningItem] = useState<EditingPlanningItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null);
  const [formState, setFormState] = useState<PlanningItemForm>(toInitialPlanningForm([], [], "Dia", formatLocalDateIso()));

  function syncAdminCatalogRefresh(nextCatalog: PlanningCatalog) {
    setCatalog(nextCatalog.categories);
    setLevels(nextCatalog.levels);
    setFormState((current) => syncPlanningForm(current, nextCatalog.categories, nextCatalog.levels));
  }

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
    onRefresh: syncAdminCatalogRefresh,
    getRequestErrorMessage,
  });

  useEffect(() => {
    function openCatalogFromNavigation() {
      if (canManageCatalog) {
        setIsCatalogModalOpen(true);
      }
    }

    window.addEventListener("open-planning-catalog", openCatalogFromNavigation);
    return () => window.removeEventListener("open-planning-catalog", openCatalogFromNavigation);
  }, [canManageCatalog]);

  useEffect(() => {
    if (!canManageCatalog) {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get("catalog") !== "1") {
      return;
    }

    setIsCatalogModalOpen(true);
    params.delete("catalog");

    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [canManageCatalog]);

  useEffect(() => {
    const hasOverlayOpen = isModalOpen || isCatalogModalOpen || Boolean(viewingPlanningItem) || Boolean(deleteConfirmation);

    if (!hasOverlayOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (deleteConfirmation) {
        setDeleteConfirmation(null);
        return;
      }

      if (viewingPlanningItem) {
        setViewingPlanningItem(null);
        return;
      }

      if (isCatalogModalOpen) {
        setIsCatalogModalOpen(false);
        return;
      }

      if (isModalOpen) {
        setIsModalOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [deleteConfirmation, isCatalogModalOpen, isModalOpen, viewingPlanningItem]);

  const refreshPlanningItems = useCallback(async () => {
    const nextItems = await fetchPlanningItems(selectedDate, session?.access_token);
    setPlanningItems(nextItems);
    setItemsError((current) => (isTransientConnectivityMessage(current) ? "" : current));
    void savePlanningCache(selectedDate, nextItems);
  }, [selectedDate, session?.access_token]);

  const refreshPlanningItemsFromRealtime = useCallback(() => {
    void refreshPlanningItems().catch((error: unknown) => {
      setItemsError(getRequestErrorMessage(error, "No se pudo actualizar la planificacion."));
    });
  }, [refreshPlanningItems]);

  usePlanningRealtime({
    selectedDate,
    accessToken: session?.access_token,
    onInvalidate: refreshPlanningItemsFromRealtime,
  });

  useEffect(() => {
    function clearRecoveredConnectivityMessages() {
      if (isBrowserOffline()) {
        return;
      }

      setItemsError((current) => (isTransientConnectivityMessage(current) ? "" : current));
      setCatalogError((current) => (isTransientConnectivityMessage(current) ? "" : current));
      void refreshPlanningItems().catch((error: unknown) => {
        setItemsError(getRequestErrorMessage(error, "No se pudo actualizar la planificacion."));
      });
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(clearRecoveredConnectivityMessages);

    return () => {
      unsubscribeNetworkStatus();
    };
  }, [refreshPlanningItems]);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        setCatalogError("");
        const nextCatalog = await fetchPlanningCatalog(session?.access_token);

        if (!active) {
          return;
        }

        setCatalog(nextCatalog.categories);
        setLevels(nextCatalog.levels);
        setFormState((current) => syncPlanningForm(current, nextCatalog.categories, nextCatalog.levels));
        setDetailForm((current) => syncDetailAdminForm(current, nextCatalog.categories));
        void saveCatalogCache(nextCatalog);
      } catch (error: unknown) {
        const message = getRequestErrorMessage(
          error,
          "No se pudieron cargar los datos del dashboard."
        );

        if (active) {
          const cachedCatalog = await readCatalogCache<PlanningCatalog>().catch(() => null);

          if (cachedCatalog) {
            setCatalog(cachedCatalog.value.categories);
            setLevels(cachedCatalog.value.levels);
            setFormState((current) =>
              syncPlanningForm(current, cachedCatalog.value.categories, cachedCatalog.value.levels)
            );
            setDetailForm((current) => syncDetailAdminForm(current, cachedCatalog.value.categories));
            setCatalogError(`Usando catalogo local guardado. Ultima sincronizacion: ${formatLocalDateTime(cachedCatalog.updatedAt)}.`);
          } else {
            setCatalogError(message);
          }
        }
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      active = false;
    };
  }, [session?.access_token, setDetailForm]);

  useEffect(() => {
    let active = true;

    async function loadPlanningItems() {
      try {
        setItemsLoading(true);
        setItemsError("");
        const nextItems = await fetchPlanningItems(selectedDate, session?.access_token);

        if (!active) {
          return;
        }

        setPlanningItems(nextItems);
        void savePlanningCache(selectedDate, nextItems);
      } catch (error: unknown) {
        const message = getRequestErrorMessage(error, "No se pudo cargar la planificacion.");

        if (active) {
          const cachedPlanning = await readPlanningCache<PlanningItem[]>(selectedDate).catch(() => null);

          if (cachedPlanning) {
            setPlanningItems(cachedPlanning.items);
            setItemsError(
              `Usando planificacion local guardada. Ultima sincronizacion: ${formatLocalDateTime(cachedPlanning.updatedAt)}.`
            );
          } else {
            setItemsError(message);
          }
        }
      } finally {
        if (active) {
          setItemsLoading(false);
        }
      }
    }

    void loadPlanningItems();

    return () => {
      active = false;
    };
  }, [refreshPlanningItems, selectedDate, session?.access_token]);

  useEffect(() => {
    if (formState.tracking_type !== "programado" || formState.category === "actividad") {
      return;
    }

    const activityCategory = catalog.find((category) => category.slug === "actividad") ?? null;
    const nextType = activityCategory?.types[0] ?? null;
    const nextDetail = nextType?.details[0] ?? null;

    setFormState((current) => ({
      ...current,
      category: "actividad",
      item_type: nextType?.label ?? "",
      description: nextDetail?.label ?? "",
    }));
  }, [catalog, formState.category, formState.tracking_type]);

  useEffect(() => {
    setFormState((current) => ({ ...current, item_date: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    let active = true;

    async function loadPendingMutations() {
      const mutations = await loadPendingPlanningMutations();

      if (active) {
        setPendingPlanningMutations(mutations);
      }
    }

    void loadPendingMutations();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void persistPendingPlanningMutations(pendingPlanningMutations);
  }, [pendingPlanningMutations]);

  useEffect(() => {
    function syncWhenOnline() {
      syncPendingPlanningMutationsRef.current();
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(syncWhenOnline);
    const retryInterval = window.setInterval(syncWhenOnline, PENDING_SYNC_RETRY_INTERVAL_MS);

    return () => {
      unsubscribeNetworkStatus();
      window.clearInterval(retryInterval);
    };
  }, []);

  useEffect(() => {
    async function refreshWhenActive() {
      if (document.visibilityState === "hidden" || isBrowserOffline()) {
        return;
      }

      await refreshPlanningItems().catch((error: unknown) => {
        setItemsError(getRequestErrorMessage(error, "No se pudo actualizar la planificacion."));
      });
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(refreshWhenActive);

    return () => {
      unsubscribeNetworkStatus();
    };
  }, [refreshPlanningItems]);

  useEffect(() => {
    syncPendingPlanningMutationsRef.current();
  }, [pendingPlanningMutations, session?.access_token]);

  useEffect(() => {
    if (!isDatePickerOpen) {
      return;
    }

    function closeDatePickerOnOutsideClick(event: PointerEvent) {
      if (!datePickerRef.current?.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeDatePickerOnOutsideClick);

    return () => {
      window.removeEventListener("pointerdown", closeDatePickerOnOutsideClick);
    };
  }, [isDatePickerOpen]);

  function resetPlanningForm() {
    const nextForm = syncPlanningForm(toInitialPlanningForm(catalog, levels, activeShift, selectedDate), catalog, levels);
    setFormState({ ...nextForm, item_date: selectedDate, shift: activeShift });
    setFormError("");
    setEditingPlanningItem(null);
  }

  function openPlanningDetail(item: PlanningItem) {
    setViewingPlanningItem(item);
  }

  async function sendPlanningMutation(
    method: PendingPlanningMutation["method"],
    payload: Record<string, unknown>
  ) {
    return sendPlanningMutationRequest(method, payload, session?.access_token);
  }

  function enqueuePlanningMutation(
    method: PendingPlanningMutation["method"],
    payload: Record<string, unknown>
  ) {
    const pendingMutation = makePendingPlanningMutation(method, payload);
    setPendingPlanningMutations((current) => [...current, pendingMutation]);
    return pendingMutation;
  }

  async function syncPendingPlanningMutations() {
    const retryableMutations = getRetryablePlanningMutations(pendingPlanningMutations);

    if (!session?.access_token || queueSyncing || !retryableMutations.length) {
      return;
    }

    if (isBrowserOffline()) {
      return;
    }

    setQueueSyncing(true);

    const replayResult = await replayPendingPlanningMutations({
      mutations: pendingPlanningMutations,
      sendMutation: (mutation) => sendPlanningMutation(mutation.method, mutation.payload),
      getErrorMessage: (error) =>
        getRequestErrorMessage(error, "No se pudo sincronizar un registro pendiente."),
      isRetryableError: isRetryablePlanningSyncError,
    });

    if (replayResult.retryableError && !isNetworkRequestError(replayResult.retryableError)) {
      setItemsError(replayResult.retryableErrorMessage);
    }

    if (replayResult.foundConflict) {
      setItemsError(
        "Un registro pendiente no pudo sincronizarse porque entra en conflicto con la planificacion actual. Revisa el detalle y descartalo o vuelve a crearlo con otro horario."
      );
    }

    setPendingPlanningMutations(replayResult.nextQueue);
    setQueueSyncing(false);

    if (replayResult.syncedCount > 0 || replayResult.foundConflict) {
      await refreshPlanningItems().then(() => {
        if (replayResult.nextQueue.length === 0) {
          setItemsError("");
        }
      }).catch((error: unknown) => {
        setItemsError(getRequestErrorMessage(error, "No se pudo recargar la planificacion."));
      });
    }
  }

  syncPendingPlanningMutationsRef.current = () => {
    void syncPendingPlanningMutations();
  };

  function discardConflictedPlanningMutations() {
    setPendingPlanningMutations(discardConflictedPlanningMutationQueue);
  }

  async function handleCreateItem(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");

    const method = editingPlanningItem ? "PATCH" : "POST";
    const payload: PlanningItemMutationPayload = editingPlanningItem
      ? { id: editingPlanningItem.id, ...formState }
      : withClientMutationId({ ...formState }) as PlanningItemMutationPayload;

    if (!session?.access_token) {
      if (isBrowserOffline()) {
        enqueuePlanningMutation(method, payload);
        setItemsError(
          "Sin conexion: el registro quedo guardado en este equipo y se sincronizara automaticamente cuando vuelva la senal."
        );
        setIsModalOpen(false);
        resetPlanningForm();
        return;
      }

      setFormError("Necesitas iniciar sesion para registrar actividades.");
      return;
    }

    setFormBusy(true);

    try {
      await sendPlanningMutation(method, payload);
      await refreshPlanningItems();
      setIsModalOpen(false);
      resetPlanningForm();
    } catch (error: unknown) {
      if (shouldQueuePlanningMutation(error)) {
        enqueuePlanningMutation(method, payload);
        setItemsError(
          "Sin conexion: el registro quedo guardado en este equipo y se sincronizara automaticamente cuando vuelva la senal."
        );
        setIsModalOpen(false);
        resetPlanningForm();
        return;
      }

      if (isPlanningConflictError(error)) {
        await refreshPlanningItems().catch(() => undefined);
      }

      setFormError(getRequestErrorMessage(error, "No se pudo crear el registro."));
    } finally {
      setFormBusy(false);
    }
  }

  function openEditPlanningItem(item: PlanningItem) {
    if (selectedDate !== todayIso && !historicalEditingEnabled) {
      return;
    }

    const nextCategory =
      catalog.find((category) => category.slug === item.category) ?? null;
    const nextType = nextCategory?.types.find((type) => type.label === item.item_type) ?? nextCategory?.types[0] ?? null;
    const nextDetail = nextType?.details.find((detail) => detail.label === item.description) ?? nextType?.details[0] ?? null;

    setFormState({
      activity_group_id: item.activity_group_id,
      item_date: item.item_date,
      start_time: item.start,
      end_time: item.end,
      shift: item.shift,
      level: item.level,
      front: item.front,
      category: item.category,
      tracking_type: item.tracking_type,
      item_type: nextType?.label ?? item.item_type,
      description: nextDetail?.label ?? item.description,
      notes: item.notes ?? "",
    });
    setEditingPlanningItem({ id: item.id });
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);
  }

  async function handleDeletePlanningItem(id: number, trackingType: PlanningItem["tracking_type"]) {
    setFormError("");
    const payload = { id, tracking_type: trackingType };

    if (!session?.access_token) {
      if (isBrowserOffline()) {
        enqueuePlanningMutation("DELETE", payload);
        setItemsError(
          "Sin conexion: la eliminacion quedo pendiente y se sincronizara automaticamente cuando vuelva la senal."
        );
        setDeleteConfirmation(null);
        if (editingPlanningItem?.id === id) {
          resetPlanningForm();
          setIsModalOpen(false);
        }
        return;
      }

      setFormError("Necesitas iniciar sesion para eliminar registros.");
      return;
    }

    setFormBusy(true);

    try {
      await sendPlanningMutation("DELETE", payload);
      await refreshPlanningItems();
      setDeleteConfirmation(null);
      if (editingPlanningItem?.id === id) {
        resetPlanningForm();
        setIsModalOpen(false);
      }
    } catch (error: unknown) {
      if (shouldQueuePlanningMutation(error)) {
        enqueuePlanningMutation("DELETE", payload);
        setItemsError(
          "Sin conexion: la eliminacion quedo pendiente y se sincronizara automaticamente cuando vuelva la senal."
        );
        setDeleteConfirmation(null);
        if (editingPlanningItem?.id === id) {
          resetPlanningForm();
          setIsModalOpen(false);
        }
        return;
      }

      if (isPlanningConflictError(error)) {
        await refreshPlanningItems().catch(() => undefined);
      }

      setFormError(getRequestErrorMessage(error, "No se pudo eliminar el registro."));
    } finally {
      setFormBusy(false);
    }
  }

  function requestDeletePlanningItem() {
    if (!editingPlanningItem) {
      return;
    }

    setDeleteConfirmation({
      id: editingPlanningItem.id,
      label: formState.description,
      trackingType: formState.tracking_type,
    });
  }

  const isRealForm = formState.tracking_type === "real";
  const availableFormCategories = isRealForm
    ? catalog
    : catalog.filter((category) => category.slug === "actividad");
  const selectedCategory =
    availableFormCategories.find((category) => category.slug === formState.category) ??
    availableFormCategories[0] ??
    null;
  const availableTypes = selectedCategory?.types ?? [];
  const selectedType =
    availableTypes.find((type) => type.label === formState.item_type) ?? availableTypes[0] ?? null;
  const availableDescriptions = selectedType?.details ?? [];
  const conflictedPlanningMutations = pendingPlanningMutations.filter(
    (mutation) => mutation.status === "conflict"
  );
  const retryablePlanningMutations = getRetryablePlanningMutations(pendingPlanningMutations);
  const visiblePlanningItems = applyPendingPlanningMutations(
    planningItems,
    pendingPlanningMutations,
    selectedDate
  );
  const allPlanningGroups = groupPlanningItems(visiblePlanningItems);
  const planningGroupsByShift: Record<ShiftKey, PlanningGroup[]> = {
    Dia: allPlanningGroups.filter(
      (group) => group.programado?.shift === "Dia" || group.realSegments.some((segment) => segment.shift === "Dia")
    ),
    Noche: allPlanningGroups.filter(
      (group) => group.programado?.shift === "Noche" || group.realSegments.some((segment) => segment.shift === "Noche")
    ),
  };
  const ganttScales: Record<ShiftKey, GanttScale> = {
    Dia: buildGanttScale(
      SHIFT_CONFIG.Dia.start,
      SHIFT_CONFIG.Dia.end,
      SHIFT_CONFIG.Dia.wrapsMidnight
    ),
    Noche: buildGanttScale(
      SHIFT_CONFIG.Noche.start,
      SHIFT_CONFIG.Noche.end,
      SHIFT_CONFIG.Noche.wrapsMidnight
    ),
  };
  const isHistoricalView = selectedDate !== todayIso;
  const isHistoricalReadOnly = isHistoricalView && !historicalEditingEnabled;
  const todayDate = new Date(`${todayIso}T00:00:00`);
  const calendarDays = getCalendarDays(calendarMonth);
  const canGoNextMonth = !isSameCalendarMonth(calendarMonth, todayDate) && calendarMonth < todayDate;
  const formContextLabel = isRealForm ? "Evento real" : "Programacion";
  const planningModalTitle = editingPlanningItem
    ? `Editar ${isRealForm ? "evento real" : "programacion"}`
    : `Crear ${isRealForm ? "evento real" : "programacion"}`;
  const planningSubmitLabel = editingPlanningItem
    ? `Guardar ${isRealForm ? "evento real" : "programacion"}`
    : `Guardar ${isRealForm ? "evento real" : "programacion"}`;
  const planningDeleteLabel = `Eliminar ${isRealForm ? "evento real" : "programacion"}`;
  const viewingContinuation = findSegmentContinuation(viewingPlanningItem, allPlanningGroups);

  function renderGanttBar(item: PlanningItem | null, layer: "programado" | "real", scale: GanttScale) {
    if (!item) {
      return null;
    }

    const start = positionMinutesInScale(item.start, scale);
    let end = positionMinutesInScale(item.end, scale);

    if (end <= start) {
      end += 24 * 60;
    }

    const scaleSpan = scale.endMinutes - scale.startMinutes;
    const startOffset = ((start - scale.startMinutes) / scaleSpan) * 100;
    const width = ((end - start) / scaleSpan) * 100;
    const duration = formatDuration(item.start, item.end);
    const ariaLabel = buildPlanningItemAriaLabel(item, duration);
    const barLabel = buildGanttBarLabel(item, layer);
    const locationLabel = buildEventSubtitle(item) || "Sin ubicacion";

    return (
      <button
        type="button"
        className={`gantt-bar ${item.category === "interferencia" ? "warning" : "success"} ${layer} ${
          item.sync_status === "pending" ? "pending-sync" : ""
        }`}
        aria-label={ariaLabel}
        onClick={() => openPlanningDetail(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPlanningDetail(item);
          }
        }}
        style={{ left: `${startOffset}%`, width: `${width}%` }}
      >
        <span className="gantt-bar-content" aria-hidden="true">
          <span className={`gantt-bar-label ${layer}`}>{barLabel}</span>
          <span className="gantt-bar-subline">
            {item.start} - {item.end}
          </span>
        </span>
        {item.sync_status === "pending" ? <span className="gantt-bar-status-dot" aria-hidden="true" /> : null}
        <span className="gantt-bar-tooltip" role="tooltip">
          <span className="gantt-tooltip-content">
            <strong>{item.description}</strong>
            <span className="gantt-tooltip-muted">
              {item.start} - {item.end}
            </span>
            <span className="gantt-tooltip-line">
              Ubicacion: {locationLabel}
            </span>
            <span className="gantt-tooltip-badges">
              <span className={`gantt-tooltip-badge ${item.category === "interferencia" ? "warning" : "success"}`}>
                {toDisplayCategory(item.category)}
              </span>
              <span className="gantt-tooltip-badge">
                {toTrackingTypeLabel(item.tracking_type)}
              </span>
              {item.sync_status === "pending" ? (
                <span className="gantt-tooltip-badge pending">pendiente</span>
              ) : null}
            </span>
            {item.notes ? <span className="gantt-tooltip-muted">Notas: {item.notes}</span> : null}
          </span>
        </span>
      </button>
    );
  }

  function renderCreateRealButton(group: PlanningGroup) {
    if (isHistoricalReadOnly || !group.programado) {
      return null;
    }

    return (
      <button
        type="button"
        className="button gantt-meta-add-real"
        onClick={() => openCreatePlanningVariant(group, "real")}
        aria-label={`Agregar evento real a ${buildEventTitle(group)}`}
        title="Agregar evento real"
      >
        <span aria-hidden="true">+</span>
      </button>
    );
  }

  function selectOperationalDate(date: string) {
    setSelectedDate(date);
    setCalendarMonth(new Date(`${date}T00:00:00`));
    setHistoricalEditingEnabled(false);
    setIsDatePickerOpen(false);
  }

  function openCreatePlanningVariant(group: PlanningGroup, trackingType: "programado" | "real") {
    if (isHistoricalReadOnly) {
      return;
    }

    const lastRealSegment = group.realSegments[group.realSegments.length - 1] ?? null;
    const sourceItem =
      trackingType === "real"
        ? lastRealSegment ?? group.programado
        : group.programado ?? lastRealSegment;
    const nextCategory = catalog.find((category) => category.slug === group.category) ?? null;
    const nextType = nextCategory?.types.find((type) => type.label === group.item_type) ?? nextCategory?.types[0] ?? null;
    const nextDetail =
      nextType?.details.find((detail) => detail.label === group.description) ?? nextType?.details[0] ?? null;
    const defaultTimes =
      trackingType === "real"
        ? getDefaultRealEventTimes(group)
        : getDefaultShiftTimes(group.shift === "Noche" ? "Noche" : "Dia");

    setFormState({
      activity_group_id: group.activity_group_id,
      item_date: sourceItem?.item_date ?? group.item_date,
      start_time: trackingType === "real" ? defaultTimes.start_time : sourceItem?.start ?? defaultTimes.start_time,
      end_time: trackingType === "real" ? defaultTimes.end_time : sourceItem?.end ?? defaultTimes.end_time,
      shift: sourceItem?.shift ?? group.shift,
      level: sourceItem?.level ?? group.level,
      front: sourceItem?.front ?? group.front,
      category: group.category,
      tracking_type: trackingType,
      item_type: nextType?.label ?? group.item_type,
      description: nextDetail?.label ?? group.description,
      notes: trackingType === "real" ? "" : sourceItem?.notes ?? group.notes ?? "",
    });
    setEditingPlanningItem(null);
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);
  }

  return (
    <section className="home-grid">
      <OperationalHero
        activeShift={activeShift}
        setActiveShift={setActiveShift}
        shiftConfig={SHIFT_CONFIG}
        selectedDate={selectedDate}
        todayIso={todayIso}
        todayDate={todayDate}
        calendarMonth={calendarMonth}
        calendarDays={calendarDays}
        canGoNextMonth={canGoNextMonth}
        isDatePickerOpen={isDatePickerOpen}
        setIsDatePickerOpen={setIsDatePickerOpen}
        setCalendarMonth={setCalendarMonth}
        datePickerRef={datePickerRef}
        isHistoricalView={isHistoricalView}
        isCreateDisabled={!session || catalogLoading || !catalog.length || isHistoricalReadOnly}
        createTitle={isHistoricalReadOnly ? "Habilita la edicion historica para crear registros" : "Nueva programacion"}
        formatDateTitle={formatDateTitle}
        formatMonthTitle={formatMonthTitle}
        formatLocalDateIso={formatLocalDateIso}
        onSelectOperationalDate={selectOperationalDate}
        onCreatePlanning={() => {
          resetPlanningForm();
          setFormState((current) => ({ ...current, tracking_type: "programado" }));
          setIsModalOpen(true);
        }}
      />

      {isHistoricalView ? (
        <HistoricalModeStrip
          editingEnabled={historicalEditingEnabled}
          onToggleEditing={() => setHistoricalEditingEnabled((current) => !current)}
        />
      ) : null}

      <PlanningStatusStrip
        itemsError={itemsError}
        catalogError={catalogError}
        retryablePlanningMutations={retryablePlanningMutations}
        conflictedPlanningMutations={conflictedPlanningMutations}
        queueSyncing={queueSyncing}
        onDiscardConflicts={discardConflictedPlanningMutations}
      />

      <section className="gantt-stage">
        <div className="gantt-shell">
          <div className="gantt-body">
            {itemsLoading ? <p className="body-copy">Cargando planificacion...</p> : null}

            {!itemsLoading ? (
              <GanttShiftSection
                shift={activeShift}
                groups={planningGroupsByShift[activeShift]}
                scale={ganttScales[activeShift]}
                renderBar={renderGanttBar}
                renderCreateRealButton={renderCreateRealButton}
                toDisplayCategory={toDisplayCategory}
              />
            ) : null}
          </div>
        </div>
      </section>

      {isModalOpen ? (
        <PlanningSheet
          titleId="planning-modal-title"
          eyebrow={formContextLabel}
          title={planningModalTitle}
          isRealForm={isRealForm}
          formState={formState}
          setFormState={setFormState}
          catalog={catalog}
          availableFormCategories={availableFormCategories}
          availableTypes={availableTypes}
          availableDescriptions={availableDescriptions}
          levels={levels}
          error={formError}
          busy={formBusy}
          isEditing={Boolean(editingPlanningItem)}
          deleteLabel={planningDeleteLabel}
          submitLabel={planningSubmitLabel}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateItem}
          onRequestDelete={requestDeletePlanningItem}
        />
      ) : null}

      {viewingPlanningItem ? (
        <PlanningDetailDialog
          item={viewingPlanningItem}
          title={buildEventTitle(viewingPlanningItem)}
          continuation={viewingContinuation}
          readOnly={isHistoricalReadOnly}
          formatDateLabel={formatDateLabel}
          formatDuration={formatDuration}
          toDisplayCategory={toDisplayCategory}
          toTrackingTypeLabel={toTrackingTypeLabel}
          onClose={() => setViewingPlanningItem(null)}
          onEdit={() => openEditPlanningItem(viewingPlanningItem)}
        />
      ) : null}

      {deleteConfirmation ? (
        <DeleteConfirmationDialog
          title={`Eliminar ${deleteConfirmation.trackingType === "real" ? "real" : "programacion"}`}
          label={deleteConfirmation.label}
          error={formError}
          busy={formBusy}
          onCancel={() => setDeleteConfirmation(null)}
          onConfirm={() => void handleDeletePlanningItem(deleteConfirmation.id, deleteConfirmation.trackingType)}
        />
      ) : null}

      {isCatalogModalOpen ? (
        <CatalogSheet
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
          onClose={() => setIsCatalogModalOpen(false)}
          onCreateType={handleCreateType}
          onCreateLevel={handleCreateLevel}
          onCreateDetail={handleCreateDetail}
          onUpdateType={handleUpdateType}
          onUpdateLevel={handleUpdateLevel}
          onUpdateDetail={handleUpdateDetail}
          onDeleteType={(id) => void handleDeleteType(id)}
          onDeleteLevel={(id) => void handleDeleteLevel(id)}
          onDeleteDetail={(id) => void handleDeleteDetail(id)}
        />
      ) : null}
    </section>
  );
}
