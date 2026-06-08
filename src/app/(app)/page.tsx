"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CirclePlus, Tag } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { CatalogSheet } from "@/components/planning/catalog-sheet";
import { DeleteConfirmationDialog } from "@/components/planning/delete-confirmation-dialog";
import { GanttTooltipPortal } from "@/components/planning/gantt-tooltip-portal";
import { GanttShiftSection } from "@/components/planning/gantt-shift-section";
import { HistoricalModeStrip } from "@/components/planning/historical-mode-strip";
import { OperationalHero } from "@/components/planning/operational-hero";
import { PlanningDetailDialog } from "@/components/planning/planning-detail-dialog";
import { PlanningSheet } from "@/components/planning/planning-sheet";
import { PlanningStatusStrip } from "@/components/planning/planning-status-strip";
import { PlanningAuditTimeline } from "@/modules/audit/presentation/planning-audit-timeline";
import {
  fetchPlanningCatalog,
  fetchPlanningItems,
} from "@/modules/planning/application/planning-reads.client";
import {
  fetchPlanningCustomFields,
  fetchPlanningCustomFieldValues,
  fetchPlanningCustomFieldValuesForItems,
  savePlanningCustomFieldValues,
} from "@/modules/planning-custom-fields/application/planning-custom-fields.client";
import type {
  PlanningCustomFieldDto,
  PlanningCustomFieldValueInputDto,
  PlanningCustomFieldValueDto,
} from "@/modules/planning-custom-fields/contracts/planning-custom-fields";
import { PlanningCustomFieldsAdminPanel } from "@/modules/planning-custom-fields/presentation/planning-custom-fields-admin-panel";
import { PlanningCustomFieldsForm } from "@/modules/planning-custom-fields/presentation/planning-custom-fields-form";
import {
  buildCustomFieldFormState,
  fieldAppliesTo,
  getCustomFieldDisplayEntries,
  toCustomFieldValueInputs,
  toDisplayCustomFieldValues,
  type PlanningCustomFieldFormState,
} from "@/modules/planning-custom-fields/presentation/planning-custom-fields-form-model";
import { getPlanningCustomFieldIcon } from "@/modules/planning-custom-fields/presentation/planning-custom-field-icons";
import { PlanningCustomFieldsSummary } from "@/modules/planning-custom-fields/presentation/planning-custom-fields-summary";
import {
  fetchAssignmentTypes,
  fetchPlanningAssignments,
  fetchPlanningAssignmentsForItems,
  replacePlanningAssignments,
} from "@/modules/planning-assignments/application/planning-assignments.client";
import type {
  AssignmentTypeDto,
  PlanningAssignmentInputDto,
  PlanningAssignmentDto,
} from "@/modules/planning-assignments/contracts/planning-assignments";
import { PlanningAssignmentsForm } from "@/modules/planning-assignments/presentation/planning-assignments-form";
import {
  buildPlanningAssignmentsFormState,
  getPlanningAssignmentTypeSummaries,
  toDisplayPlanningAssignments,
  toOperationalAssignmentTypes,
  toPlanningAssignmentInputs,
  type PlanningAssignmentsFormState,
} from "@/modules/planning-assignments/presentation/planning-assignments-form-model";
import { PlanningAssignmentsSummary } from "@/modules/planning-assignments/presentation/planning-assignments-summary";
import { getAssignmentTypeIcon } from "@/modules/planning-assignments/presentation/planning-assignment-type-icons";
import {
  readAssignmentTypesCache,
  readPlanningAssignmentsCache,
  saveAssignmentTypesCache,
  savePlanningAssignmentsCache,
} from "@/modules/planning-assignments/offline/planning-assignments-offline";
import {
  PlanningMutationRequestError,
  sendPlanningMutation as sendPlanningMutationRequest,
} from "@/modules/planning/application/planning-writes.client";
import {
  isBrowserOffline,
  isNetworkRequestError,
  getNetworkStatusSnapshot,
  probeNetworkRestored,
  subscribeNetworkStatus,
} from "@/lib/networkStatus";
import {
  readCatalogCache,
  readKeyValueCache,
  readPlanningCustomFieldsCache,
  readPlanningCache,
  saveCatalogCache,
  saveKeyValueCache,
  savePlanningCustomFieldsCache,
  savePlanningCache,
  OFFLINE_KEYS,
} from "@/lib/localOfflineStore";
import { recordOperationalEvent } from "../../lib/observability/logger";
import {
  buildEventSubtitle,
  buildEventTitle,
  buildGanttCurrentTimeMarker,
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
  getShiftForCurrentTime,
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
  toOptimisticPlanningItem,
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

function buildCustomFieldValuesCacheKey(planningItemId: number) {
  return `${OFFLINE_KEYS.planningCustomFieldValuesPrefix}:${planningItemId}`;
}

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
    /^Usando campos configurables locales\./.test(message) ||
    /^Usando datos locales guardados\./.test(message)
  );
}

function extractLastSyncLabel(...messages: string[]) {
  const source = messages.find((message) => /Ultima sincronizacion:/i.test(message));

  if (!source) {
    return "";
  }

  return source.replace(/^.*Ultima sincronizacion:\s*/i, "").replace(/\.$/, "").trim();
}

export default function Home() {
  const { session, profile } = useAuth();
  const networkStatus = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkStatusSnapshot,
    () => "offline" as const
  );
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
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [pendingPlanningMutations, setPendingPlanningMutations] = useState<PendingPlanningMutation[]>([]);
  const syncPendingPlanningMutationsRef = useRef<() => void>(() => undefined);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true);
  const [customFieldsError, setCustomFieldsError] = useState("");
  const [customFields, setCustomFields] = useState<PlanningCustomFieldDto[]>([]);
  const [customFieldFormState, setCustomFieldFormState] = useState<PlanningCustomFieldFormState>({});
  const [formCustomFieldsLoading, setFormCustomFieldsLoading] = useState(false);
  const [formCustomFieldsError, setFormCustomFieldsError] = useState("");
  const [viewingCustomFieldValues, setViewingCustomFieldValues] = useState<PlanningCustomFieldValueDto[]>([]);
  const [customFieldValuesByItemId, setCustomFieldValuesByItemId] = useState<Record<number, PlanningCustomFieldValueDto[]>>({});
  const [viewingCustomFieldsLoading, setViewingCustomFieldsLoading] = useState(false);
  const [viewingCustomFieldsError, setViewingCustomFieldsError] = useState("");
  const [formAssignmentTypes, setFormAssignmentTypes] = useState<AssignmentTypeDto[]>([]);
  const [planningAssignmentsFormState, setPlanningAssignmentsFormState] = useState<PlanningAssignmentsFormState>({});
  const [formAssignmentsLoading, setFormAssignmentsLoading] = useState(false);
  const [formAssignmentsError, setFormAssignmentsError] = useState("");
  const [formAssignmentsReady, setFormAssignmentsReady] = useState(false);
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeDto[]>([]);
  const [planningAssignmentsByItemId, setPlanningAssignmentsByItemId] = useState<Record<number, PlanningAssignmentDto[]>>({});
  const [viewingAssignmentTypes, setViewingAssignmentTypes] = useState<AssignmentTypeDto[]>([]);
  const [viewingPlanningAssignments, setViewingPlanningAssignments] = useState<PlanningAssignmentDto[]>([]);
  const [viewingAssignmentsLoading, setViewingAssignmentsLoading] = useState(false);
  const [viewingAssignmentsError, setViewingAssignmentsError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [viewingPlanningItem, setViewingPlanningItem] = useState<ViewingPlanningItem>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingPlanningItem, setEditingPlanningItem] = useState<EditingPlanningItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null);
  const [formState, setFormState] = useState<PlanningItemForm>(toInitialPlanningForm([], [], "Dia", formatLocalDateIso()));
  const resumeRefreshInFlightRef = useRef(false);

  const selectActiveShift = useCallback((shift: ShiftKey) => {
    setActiveShift(shift);
  }, []);

  useEffect(() => {
    const now = new Date();
    setActiveShift(getShiftForCurrentTime(now));
    setCurrentTime(now);
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

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

  const refreshCustomFields = useCallback(async (options: { allowCacheFallback?: boolean } = {}) => {
    const allowCacheFallback = options.allowCacheFallback ?? true;

    if (!session?.access_token) {
      setCustomFields([]);
      setCustomFieldsError("");
      return [];
    }

    try {
      const nextFields = await fetchPlanningCustomFields(session.access_token, { activeOnly: false });
      setCustomFields(nextFields);
      setCustomFieldsError("");
      setCatalogError((current) => (isTransientConnectivityMessage(current) ? "" : current));
      void savePlanningCustomFieldsCache(nextFields);
      return nextFields;
    } catch (error: unknown) {
      if (!allowCacheFallback) {
        const message = getRequestErrorMessage(error, "No se pudieron cargar los campos configurables.");
        setCustomFieldsError(message);
        throw error;
      }

      const cachedFields = await readPlanningCustomFieldsCache<PlanningCustomFieldDto[]>().catch(() => null);

      if (cachedFields?.value) {
        recordOperationalEvent({
          name: "offline.cache_used",
          source: "planningPage",
          metadata: { dataset: "planning-custom-fields" },
        });
        setCustomFields(cachedFields.value);
        setCustomFieldsError("");
        setCatalogError(`Usando campos configurables locales. Ultima sincronizacion: ${formatLocalDateTime(cachedFields.updatedAt)}.`);
        return cachedFields.value;
      }

      setCustomFieldsError(getRequestErrorMessage(error, "No se pudieron cargar los campos configurables."));
      throw error;
    }
  }, [session?.access_token]);

  const preloadCustomFieldValuesForItems = useCallback(async (items: PlanningItem[]) => {
    if (!session?.access_token) {
      return;
    }

    const planningItemIds = items
      .filter((item) => item.tracking_type === "programado" && item.id > 0)
      .map((item) => item.id);

    if (!planningItemIds.length) {
      return;
    }

    let values: PlanningCustomFieldValueDto[];

    try {
      values = await fetchPlanningCustomFieldValuesForItems(planningItemIds, session.access_token);
    } catch {
      recordOperationalEvent({
        level: "warn",
        name: "planning_custom_field_values.load_failed",
        source: "planningPage",
        metadata: { selectedDate, mode: "batch" },
      });

      const cachedEntries = await Promise.all(
        planningItemIds.map(async (planningItemId) => {
          const cachedValues = await readKeyValueCache<PlanningCustomFieldValueDto[]>(
            buildCustomFieldValuesCacheKey(planningItemId)
          ).catch(() => null);
          return [planningItemId, cachedValues?.value ?? []] as const;
        })
      );

      setCustomFieldValuesByItemId((current) => ({
        ...current,
        ...Object.fromEntries(cachedEntries),
      }));
      return;
    }

    const nextValuesByItemId = Object.fromEntries(planningItemIds.map((id) => [id, [] as PlanningCustomFieldValueDto[]]));

    for (const value of values) {
      if (!value.planning_item_id) {
        continue;
      }

      nextValuesByItemId[value.planning_item_id] = [
        ...(nextValuesByItemId[value.planning_item_id] ?? []),
        value,
      ];
    }

    setCustomFieldValuesByItemId((current) => ({
      ...current,
      ...nextValuesByItemId,
    }));

    await Promise.all(
      Object.entries(nextValuesByItemId).map(([planningItemId, itemValues]) =>
        saveKeyValueCache(buildCustomFieldValuesCacheKey(Number(planningItemId)), itemValues).catch(() => undefined)
      )
    );
  }, [selectedDate, session?.access_token]);

  const preloadPlanningAssignmentsForItems = useCallback(async (items: PlanningItem[]) => {
    const planningItemIds = items
      .filter((item) => item.tracking_type === "programado" && item.id > 0)
      .map((item) => item.id);

    async function loadCachedAssignments() {
      const [cachedTypes, cachedEntries] = await Promise.all([
        readAssignmentTypesCache().catch(() => null),
        Promise.all(
          planningItemIds.map(async (planningItemId) => [
            planningItemId,
            await readPlanningAssignmentsCache(planningItemId).catch(() => null),
          ] as const)
        ),
      ]);
      if (cachedTypes || cachedEntries.some(([, assignments]) => assignments !== null)) {
        recordOperationalEvent({
          name: "offline.cache_used",
          source: "planningPage",
          metadata: { dataset: "planning-assignments" },
        });
      }
      if (cachedTypes) setAssignmentTypes(cachedTypes);
      setPlanningAssignmentsByItemId((current) => ({
        ...current,
        ...Object.fromEntries(cachedEntries.map(([id, assignments]) => [id, assignments ?? []])),
      }));
    }

    if (!session?.access_token || isBrowserOffline()) {
      await loadCachedAssignments();
      return;
    }

    try {
      const [types, assignments] = await Promise.all([
        fetchAssignmentTypes(session.access_token, { activeOnly: false }),
        planningItemIds.length
          ? fetchPlanningAssignmentsForItems(planningItemIds, session.access_token)
          : Promise.resolve([]),
      ]);
      const nextAssignmentsByItemId = Object.fromEntries(
        planningItemIds.map((id) => [id, [] as PlanningAssignmentDto[]])
      );
      for (const assignment of assignments) {
        nextAssignmentsByItemId[assignment.planning_item_id] = [
          ...(nextAssignmentsByItemId[assignment.planning_item_id] ?? []),
          assignment,
        ];
      }
      setAssignmentTypes(types);
      setPlanningAssignmentsByItemId((current) => ({ ...current, ...nextAssignmentsByItemId }));
      void saveAssignmentTypesCache(types);
      void Promise.all(
        Object.entries(nextAssignmentsByItemId).map(([planningItemId, itemAssignments]) =>
          savePlanningAssignmentsCache(Number(planningItemId), itemAssignments).catch(() => undefined)
        )
      );
    } catch {
      recordOperationalEvent({
        level: "warn",
        name: "planning_assignments.load_failed",
        source: "planningPage",
        metadata: { selectedDate, mode: "batch" },
      });
      await loadCachedAssignments();
    }
  }, [selectedDate, session?.access_token]);

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
    void preloadCustomFieldValuesForItems(nextItems);
    void preloadPlanningAssignmentsForItems(nextItems);
  }, [preloadCustomFieldValuesForItems, preloadPlanningAssignmentsForItems, selectedDate, session?.access_token]);

  const refreshCatalog = useCallback(async () => {
    const nextCatalog = await fetchPlanningCatalog(session?.access_token);
    setCatalog(nextCatalog.categories);
    setLevels(nextCatalog.levels);
    setFormState((current) => syncPlanningForm(current, nextCatalog.categories, nextCatalog.levels));
    setDetailForm((current) => syncDetailAdminForm(current, nextCatalog.categories));
    setCatalogError((current) => (isTransientConnectivityMessage(current) ? "" : current));
    void saveCatalogCache(nextCatalog);
    return nextCatalog;
  }, [session?.access_token, setDetailForm]);

  const refreshPlanningItemsFromRealtime = useCallback(() => {
    void refreshPlanningItems().catch((error: unknown) => {
      recordOperationalEvent({
        level: "warn",
        name: "realtime.refresh_failed",
        source: "planningPage",
        metadata: { selectedDate },
      });
      setItemsError(getRequestErrorMessage(error, "No se pudo actualizar la planificacion."));
    });
  }, [refreshPlanningItems, selectedDate]);

  usePlanningRealtime({
    selectedDate,
    accessToken: session?.access_token,
    networkStatus,
    onInvalidate: refreshPlanningItemsFromRealtime,
  });

  useEffect(() => {
    async function recoverOnlineData(reason: string) {
      if (document.visibilityState === "hidden" || resumeRefreshInFlightRef.current) {
        return;
      }

      resumeRefreshInFlightRef.current = true;

      try {
        const backendReachable = await probeNetworkRestored();

        if (!backendReachable || isBrowserOffline()) {
          return;
        }

        syncPendingPlanningMutationsRef.current();

        const results = await Promise.allSettled([
          refreshPlanningItems(),
          refreshCatalog(),
          refreshCustomFields({ allowCacheFallback: false }),
        ]);
        const failed = results.filter((result) => result.status === "rejected");

        if (failed.length === 0) {
          setItemsError((current) => (isTransientConnectivityMessage(current) ? "" : current));
          setCatalogError((current) => (isTransientConnectivityMessage(current) ? "" : current));
          setCustomFieldsError((current) => (isTransientConnectivityMessage(current) ? "" : current));
          return;
        }

        recordOperationalEvent({
          level: "warn",
          name: "refresh.failed",
          source: "planningPage",
          metadata: { selectedDate, reason, target: "resume-online-data", failedCount: failed.length },
        });
      } finally {
        resumeRefreshInFlightRef.current = false;
      }
    }

    function recoverFromNetworkStatus() {
      void recoverOnlineData("network-status");
    }

    function recoverFromFocus() {
      void recoverOnlineData("focus");
    }

    function recoverFromVisibility() {
      if (document.visibilityState !== "visible") {
        return;
      }

      void recoverOnlineData("visibility-visible");
    }

    const unsubscribeNetworkStatus = subscribeNetworkStatus(recoverFromNetworkStatus);
    window.addEventListener("focus", recoverFromFocus);
    window.addEventListener("online", recoverFromNetworkStatus);
    document.addEventListener("visibilitychange", recoverFromVisibility);

    return () => {
      unsubscribeNetworkStatus();
      window.removeEventListener("focus", recoverFromFocus);
      window.removeEventListener("online", recoverFromNetworkStatus);
      document.removeEventListener("visibilitychange", recoverFromVisibility);
    };
  }, [refreshCatalog, refreshCustomFields, refreshPlanningItems, selectedDate]);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        setCatalogError("");
        await refreshCatalog();

        if (!active) {
          return;
        }

        setCatalogError("");
      } catch (error: unknown) {
        const message = getRequestErrorMessage(
          error,
          "No se pudieron cargar los datos del dashboard."
        );

        if (active) {
          const cachedCatalog = await readCatalogCache<PlanningCatalog>().catch(() => null);

          if (cachedCatalog) {
            recordOperationalEvent({
              name: "offline.cache_used",
              source: "planningPage",
              metadata: { dataset: "planning-catalog" },
            });
            setCatalog(cachedCatalog.value.categories);
            setLevels(cachedCatalog.value.levels);
            setFormState((current) =>
              syncPlanningForm(current, cachedCatalog.value.categories, cachedCatalog.value.levels)
            );
            setDetailForm((current) => syncDetailAdminForm(current, cachedCatalog.value.categories));
            setCatalogError(`Usando catalogo local guardado. Ultima sincronizacion: ${formatLocalDateTime(cachedCatalog.updatedAt)}.`);
          } else {
            recordOperationalEvent({
              level: "warn",
              name: "offline.cache_miss",
              source: "planningPage",
              metadata: { dataset: "planning-catalog" },
            });
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
  }, [refreshCatalog, setDetailForm]);

  useEffect(() => {
    if (!session?.access_token) {
      setCustomFields([]);
      setCustomFieldsLoading(false);
      setCustomFieldsError("");
      return;
    }

    let active = true;
    setCustomFieldsLoading(true);
    setCustomFieldsError("");

    refreshCustomFields()
      .then((nextFields) => {
        if (active) {
          setCustomFields(nextFields);
          setCustomFieldsError("");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          recordOperationalEvent({
            level: "warn",
            name: "planning_custom_fields.load_failed",
            source: "planningPage",
          });
          const message = getRequestErrorMessage(error, "No se pudieron cargar los campos configurables.");
          setCustomFieldsError(message);
          setCatalogError(message);
        }
      })
      .finally(() => {
        if (active) {
          setCustomFieldsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshCustomFields, session?.access_token]);

  useEffect(() => {
    let active = true;

    void readAssignmentTypesCache()
      .then((types) => {
        if (active && types) {
          setAssignmentTypes(types);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

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
        void preloadCustomFieldValuesForItems(nextItems);
        void preloadPlanningAssignmentsForItems(nextItems);
      } catch (error: unknown) {
        const message = getRequestErrorMessage(error, "No se pudo cargar la planificacion.");

        if (active) {
          const cachedPlanning = await readPlanningCache<PlanningItem[]>(selectedDate).catch(() => null);

          if (cachedPlanning) {
            recordOperationalEvent({
              name: "offline.cache_used",
              source: "planningPage",
              metadata: { dataset: "planning-by-date", selectedDate },
            });
            setPlanningItems(cachedPlanning.items);
            void preloadCustomFieldValuesForItems(cachedPlanning.items);
            void preloadPlanningAssignmentsForItems(cachedPlanning.items);
            setItemsError(
              `Usando planificacion local guardada. Ultima sincronizacion: ${formatLocalDateTime(cachedPlanning.updatedAt)}.`
            );
          } else {
            recordOperationalEvent({
              level: "warn",
              name: "offline.cache_miss",
              source: "planningPage",
              metadata: { dataset: "planning-by-date", selectedDate },
            });
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
  }, [preloadCustomFieldValuesForItems, preloadPlanningAssignmentsForItems, selectedDate, session?.access_token]);

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

  async function cacheCustomFieldValues(planningItemId: number, values: PlanningCustomFieldValueDto[]) {
    if (planningItemId <= 0) {
      return;
    }

    setCustomFieldValuesByItemId((current) => ({
      ...current,
      [planningItemId]: values,
    }));
    await saveKeyValueCache(buildCustomFieldValuesCacheKey(planningItemId), values).catch(() => undefined);
  }

  async function readCachedCustomFieldValues(planningItemId: number) {
    if (planningItemId <= 0) {
      return null;
    }

    const cachedValues = await readKeyValueCache<PlanningCustomFieldValueDto[]>(
      buildCustomFieldValuesCacheKey(planningItemId)
    ).catch(() => null);

    return cachedValues?.value && Array.isArray(cachedValues.value) ? cachedValues.value : null;
  }

  function findPendingPlanningMutationForItemId(planningItemId: number) {
    return pendingPlanningMutations.find((mutation) => {
      const payloadId = Number(mutation.payload.id);
      if (Number.isFinite(payloadId) && payloadId === planningItemId) {
        return true;
      }

      return toOptimisticPlanningItem(mutation)?.id === planningItemId;
    });
  }

  function getPendingCustomFieldValuesForItem(item: PlanningItem) {
    const pendingMutation = findPendingPlanningMutationForItemId(item.id);

    return pendingMutation?.customFieldValues
      ? toDisplayCustomFieldValues(pendingMutation.customFieldValues, { planningItemId: item.id })
      : null;
  }

  function getPendingAssignmentsForItem(item: PlanningItem) {
    const pendingMutation = findPendingPlanningMutationForItemId(item.id);
    return pendingMutation?.assignmentPayload !== undefined
      ? toDisplayPlanningAssignments(pendingMutation.assignmentPayload, item.id)
      : null;
  }

  function getAssignmentsForItem(item: PlanningItem) {
    return getPendingAssignmentsForItem(item) ?? planningAssignmentsByItemId[item.id] ?? [];
  }

  function getCustomFieldValuesForGanttPopover(item: PlanningItem) {
    return getPendingCustomFieldValuesForItem(item) ?? customFieldValuesByItemId[item.id] ?? [];
  }

  function resetPlanningForm() {
    const nextForm = syncPlanningForm(toInitialPlanningForm(catalog, levels, activeShift, selectedDate), catalog, levels);
    setFormState({ ...nextForm, item_date: selectedDate, shift: activeShift });
    setCustomFieldFormState({});
    setFormCustomFieldsError("");
    setFormAssignmentTypes([]);
    setPlanningAssignmentsFormState({});
    setFormAssignmentsLoading(false);
    setFormAssignmentsError("");
    setFormAssignmentsReady(false);
    setFormError("");
    setEditingPlanningItem(null);
  }

  function openPlanningDetail(item: PlanningItem) {
    setViewingPlanningItem(item);
    setViewingCustomFieldValues(getPendingCustomFieldValuesForItem(item) ?? []);
    setViewingCustomFieldsError("");
    setViewingAssignmentTypes(assignmentTypes);
    setViewingPlanningAssignments(getAssignmentsForItem(item));
    setViewingAssignmentsError("");

    if (item.tracking_type !== "programado") {
      setViewingCustomFieldsLoading(false);
      setViewingAssignmentsLoading(false);
      return;
    }

    if (item.id <= 0) {
      setViewingCustomFieldsLoading(false);
      setViewingAssignmentsLoading(false);
      return;
    }

    if (!session?.access_token) {
      setViewingCustomFieldsLoading(false);
      setViewingAssignmentsLoading(false);
      if (!getPendingAssignmentsForItem(item)) {
        void Promise.all([
          readAssignmentTypesCache().catch(() => null),
          readPlanningAssignmentsCache(item.id).catch(() => null),
        ]).then(([types, assignments]) => {
          if (types) setViewingAssignmentTypes(types);
          if (assignments) setViewingPlanningAssignments(assignments);
        });
      }
      return;
    }

    setViewingCustomFieldsLoading(true);
    setViewingAssignmentsLoading(!isBrowserOffline());
    void fetchPlanningCustomFieldValues({ planningItemId: item.id }, session.access_token)
      .then((values) => {
        setViewingCustomFieldValues(values);
        setViewingCustomFieldsError("");
        void cacheCustomFieldValues(item.id, values);
      })
      .catch(async (error: unknown) => {
        const cachedValues = await readCachedCustomFieldValues(item.id);
        if (cachedValues) {
          setViewingCustomFieldValues(cachedValues);
          setViewingCustomFieldsError("");
          return;
        }

        recordOperationalEvent({
          level: "warn",
          name: "planning_custom_field_values.load_failed",
          source: "planningPage",
          metadata: { planningItemId: item.id },
        });
        const message = getRequestErrorMessage(error, "No se pudieron cargar los campos configurables.");
        setViewingCustomFieldsError(message);
        setItemsError(message);
      })
      .finally(() => {
        setViewingCustomFieldsLoading(false);
      });

    if (isBrowserOffline()) {
      if (!getPendingAssignmentsForItem(item)) {
        void Promise.all([
          readAssignmentTypesCache().catch(() => null),
          readPlanningAssignmentsCache(item.id).catch(() => null),
        ]).then(([types, assignments]) => {
          if (types) {
            setAssignmentTypes(types);
            setViewingAssignmentTypes(types);
          }
          if (assignments) {
            setViewingPlanningAssignments(assignments);
            setPlanningAssignmentsByItemId((current) => ({ ...current, [item.id]: assignments }));
          }
        });
      }
      setViewingAssignmentsError("");
    } else {
      void Promise.all([
        fetchAssignmentTypes(session.access_token, { activeOnly: false }),
        fetchPlanningAssignments(item.id, session.access_token),
      ])
        .then(([types, assignments]) => {
          setViewingAssignmentTypes(types);
          setViewingPlanningAssignments(assignments);
          setAssignmentTypes(types);
          setPlanningAssignmentsByItemId((current) => ({ ...current, [item.id]: assignments }));
          void saveAssignmentTypesCache(types);
          void savePlanningAssignmentsCache(item.id, assignments);
          setViewingAssignmentsError("");
        })
        .catch((error: unknown) => {
          recordOperationalEvent({
            level: "warn",
            name: "planning_assignments.load_failed",
            source: "planningPage",
            metadata: { planningItemId: item.id, mode: "detail" },
          });
          setViewingAssignmentsError(getRequestErrorMessage(error, "No se pudieron cargar las asignaciones."));
        })
        .finally(() => setViewingAssignmentsLoading(false));
    }
  }

  async function loadAssignmentTypesForCreate() {
    if (!session?.access_token || isBrowserOffline()) {
      const cachedTypes = await readAssignmentTypesCache().catch(() => null);
      const operationalTypes = toOperationalAssignmentTypes(cachedTypes ?? []);
      setAssignmentTypes(cachedTypes ?? []);
      setFormAssignmentTypes(operationalTypes);
      setPlanningAssignmentsFormState({});
      setFormAssignmentsReady(Boolean(cachedTypes?.length));
      setFormAssignmentsError(cachedTypes?.length ? "" : "Sin conexion. No hay definiciones locales de asignaciones disponibles.");
      setFormAssignmentsLoading(false);
      return;
    }

    setFormAssignmentsLoading(true);
    setFormAssignmentsError("");
    try {
      const types = await fetchAssignmentTypes(session.access_token, { activeOnly: false });
      setFormAssignmentTypes(toOperationalAssignmentTypes(types));
      setAssignmentTypes(types);
      void saveAssignmentTypesCache(types);
      setPlanningAssignmentsFormState({});
      setFormAssignmentsReady(true);
    } catch (error: unknown) {
      const cachedTypes = await readAssignmentTypesCache().catch(() => null);
      setAssignmentTypes(cachedTypes ?? []);
      setFormAssignmentTypes(toOperationalAssignmentTypes(cachedTypes ?? []));
      setFormAssignmentsReady(Boolean(cachedTypes?.length));
      setFormAssignmentsError(cachedTypes?.length ? "" : getRequestErrorMessage(error, "No se pudieron cargar las asignaciones."));
    } finally {
      setFormAssignmentsLoading(false);
    }
  }

  async function loadAssignmentsForEdit(planningItemId: number) {
    const pendingMutation = findPendingPlanningMutationForItemId(planningItemId);
    const pendingAssignments = pendingMutation?.assignmentPayload !== undefined
      ? toDisplayPlanningAssignments(pendingMutation.assignmentPayload, planningItemId)
      : null;
    if (pendingAssignments) {
      const cachedTypes = assignmentTypes.length
        ? assignmentTypes
        : (await readAssignmentTypesCache().catch(() => null)) ?? [];
      setFormAssignmentTypes(toOperationalAssignmentTypes(cachedTypes));
      setAssignmentTypes(cachedTypes);
      setPlanningAssignmentsFormState(buildPlanningAssignmentsFormState(pendingAssignments));
      setFormAssignmentsReady(Boolean(cachedTypes.length));
      setFormAssignmentsError(cachedTypes.length ? "" : "No hay definiciones locales de asignaciones disponibles.");
      setFormAssignmentsLoading(false);
      return;
    }
    if (!session?.access_token || isBrowserOffline() || planningItemId <= 0) {
      const [cachedTypes, cachedAssignments] = await Promise.all([
        readAssignmentTypesCache().catch(() => null),
        planningItemId > 0 ? readPlanningAssignmentsCache(planningItemId).catch(() => null) : Promise.resolve(null),
      ]);
      setFormAssignmentTypes(toOperationalAssignmentTypes(cachedTypes ?? []));
      setAssignmentTypes(cachedTypes ?? []);
      setPlanningAssignmentsFormState(buildPlanningAssignmentsFormState(pendingAssignments ?? cachedAssignments ?? []));
      setFormAssignmentsReady(Boolean(cachedTypes?.length));
      setFormAssignmentsError(cachedTypes?.length ? "" : "Sin conexion. No hay definiciones locales de asignaciones disponibles.");
      setFormAssignmentsLoading(false);
      return;
    }

    setFormAssignmentsLoading(true);
    setFormAssignmentsError("");
    try {
      const [types, assignments] = await Promise.all([
        fetchAssignmentTypes(session.access_token, { activeOnly: false }),
        fetchPlanningAssignments(planningItemId, session.access_token),
      ]);
      setFormAssignmentTypes(toOperationalAssignmentTypes(types));
      setAssignmentTypes(types);
      setPlanningAssignmentsFormState(buildPlanningAssignmentsFormState(assignments));
      setFormAssignmentsReady(true);
      void saveAssignmentTypesCache(types);
      void savePlanningAssignmentsCache(planningItemId, assignments);
    } catch (error: unknown) {
      const [cachedTypes, cachedAssignments] = await Promise.all([
        readAssignmentTypesCache().catch(() => null),
        readPlanningAssignmentsCache(planningItemId).catch(() => null),
      ]);
      setFormAssignmentTypes(toOperationalAssignmentTypes(cachedTypes ?? []));
      setAssignmentTypes(cachedTypes ?? []);
      setPlanningAssignmentsFormState(buildPlanningAssignmentsFormState(cachedAssignments ?? []));
      setFormAssignmentsReady(Boolean(cachedTypes?.length));
      setFormAssignmentsError(cachedTypes?.length ? "" : getRequestErrorMessage(error, "No se pudieron cargar las asignaciones."));
    } finally {
      setFormAssignmentsLoading(false);
    }
  }

  async function sendPlanningMutation(
    method: PendingPlanningMutation["method"],
    payload: Record<string, unknown>
  ) {
    return sendPlanningMutationRequest(method, payload, session?.access_token);
  }

  function getPlannedCustomFieldValuesForQueue(): PlanningCustomFieldValueInputDto[] | undefined {
    if (formState.tracking_type !== "programado") {
      return undefined;
    }

    if (editingPlanningItem && Object.keys(customFieldFormState).length === 0) {
      return undefined;
    }

    const values = toCustomFieldValueInputs(
      customFields.filter((field) => fieldAppliesTo(field, "planned")),
      customFieldFormState
    );

    return values.length ? values : undefined;
  }

  function getPlannedAssignmentsForQueue(): PlanningAssignmentInputDto[] | undefined {
    if (formState.tracking_type !== "programado" || !formAssignmentsReady) {
      return undefined;
    }

    return toPlanningAssignmentInputs(formAssignmentTypes, planningAssignmentsFormState);
  }

  function enqueuePlanningMutation(
    method: PendingPlanningMutation["method"],
    payload: Record<string, unknown>,
    input: {
      customFieldValues?: PlanningCustomFieldValueInputDto[];
      assignmentPayload?: PlanningAssignmentInputDto[];
      syncedPlanningItemId?: number;
    } = {}
  ) {
    const pendingMutation = makePendingPlanningMutation(method, payload, input);
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
      replayCustomFieldValues: async (mutation, response) => {
        if (mutation.method === "DELETE" || !mutation.customFieldValues?.length) {
          return;
        }

        const responseItemId = Number((response as { item?: { id?: unknown } })?.item?.id);
        const payloadItemId = Number(mutation.payload.id);
        const planningItemId =
          Number.isFinite(responseItemId) && responseItemId > 0
            ? responseItemId
            : Number.isFinite(payloadItemId) && payloadItemId > 0
              ? payloadItemId
              : null;

        if (!planningItemId) {
          throw new Error("No se pudo asociar los campos configurables al programado sincronizado.");
        }

        const savedCustomFieldValues = await savePlanningCustomFieldValues(
          {
            planning_item_id: planningItemId,
            values: mutation.customFieldValues,
          },
          session.access_token
        );
        void cacheCustomFieldValues(planningItemId, savedCustomFieldValues);
      },
      replayAssignmentPayload: async (mutation, response) => {
        if (mutation.method === "DELETE" || mutation.assignmentPayload === undefined) {
          return;
        }

        const responseItemId = Number((response as { item?: { id?: unknown } })?.item?.id);
        const payloadItemId = Number(mutation.payload.id);
        const planningItemId =
          Number.isFinite(responseItemId) && responseItemId > 0
            ? responseItemId
            : Number.isFinite(payloadItemId) && payloadItemId > 0
              ? payloadItemId
              : null;

        if (!planningItemId) {
          throw new Error("No se pudo asociar las asignaciones al programado sincronizado.");
        }

        const savedAssignments = await replacePlanningAssignments({
          planning_item_id: planningItemId,
          assignments: mutation.assignmentPayload,
        }, session.access_token);
        setPlanningAssignmentsByItemId((current) => ({ ...current, [planningItemId]: savedAssignments }));
        void savePlanningAssignmentsCache(planningItemId, savedAssignments);
      },
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
        enqueuePlanningMutation(method, payload, {
          customFieldValues: getPlannedCustomFieldValuesForQueue(),
          assignmentPayload: getPlannedAssignmentsForQueue(),
        });
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
      const mutationResult = await sendPlanningMutation(method, payload);
      const savedItemId = Number(
        (mutationResult as { item?: { id?: unknown } }).item?.id ?? editingPlanningItem?.id
      );

      if (formState.tracking_type === "programado" && Number.isFinite(savedItemId) && savedItemId > 0) {
        try {
          const savedCustomFieldValues = await savePlanningCustomFieldValues(
            {
              planning_item_id: savedItemId,
              values: toCustomFieldValueInputs(
                customFields.filter((field) => fieldAppliesTo(field, "planned")),
                customFieldFormState
              ),
            },
            session.access_token
          );
          void cacheCustomFieldValues(savedItemId, savedCustomFieldValues);
        } catch (error: unknown) {
          recordOperationalEvent({
            level: "warn",
            name: "planning_custom_field_values.save_failed",
            source: "planningPage",
            metadata: { planningItemId: savedItemId },
          });
          setEditingPlanningItem({ id: savedItemId });
          setFormError(getRequestErrorMessage(error, "La programacion se guardo, pero no se pudieron guardar sus campos configurables. Reintenta guardar para completar los campos."));
          await refreshPlanningItems().catch(() => undefined);
          return;
        }

        if (formAssignmentsReady) {
          const assignmentPayload = toPlanningAssignmentInputs(formAssignmentTypes, planningAssignmentsFormState);
          if (isBrowserOffline()) {
            enqueuePlanningMutation(method, payload, { assignmentPayload, syncedPlanningItemId: savedItemId });
            setItemsError("Sin conexion: la programacion se guardo y sus asignaciones quedaron pendientes de sincronizacion.");
            setIsModalOpen(false);
            resetPlanningForm();
            return;
          }

          try {
            const savedAssignments = await replacePlanningAssignments({
              planning_item_id: savedItemId,
              assignments: assignmentPayload,
            }, session.access_token);
            setPlanningAssignmentsByItemId((current) => ({ ...current, [savedItemId]: savedAssignments }));
            void savePlanningAssignmentsCache(savedItemId, savedAssignments);
          } catch (error: unknown) {
            if (shouldQueuePlanningMutation(error)) {
              enqueuePlanningMutation(method, payload, { assignmentPayload, syncedPlanningItemId: savedItemId });
              setItemsError("Sin conexion: la programacion se guardo y sus asignaciones quedaron pendientes de sincronizacion.");
              setIsModalOpen(false);
              resetPlanningForm();
              return;
            }
            recordOperationalEvent({
              level: "warn",
              name: "planning_assignments.save_failed",
              source: "planningPage",
              metadata: { planningItemId: savedItemId },
            });
            setEditingPlanningItem({ id: savedItemId });
            setFormAssignmentsError(getRequestErrorMessage(error, "La programacion se guardo, pero no se pudieron guardar sus asignaciones. Reintenta guardar para completarlas."));
            await refreshPlanningItems().catch(() => undefined);
            return;
          }
        }
      }

      await refreshPlanningItems();
      setIsModalOpen(false);
      resetPlanningForm();
    } catch (error: unknown) {
      if (shouldQueuePlanningMutation(error)) {
        enqueuePlanningMutation(method, payload, {
          customFieldValues: getPlannedCustomFieldValuesForQueue(),
          assignmentPayload: getPlannedAssignmentsForQueue(),
        });
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
    setCustomFieldFormState({});
    setFormCustomFieldsError("");
    setFormAssignmentTypes([]);
    setPlanningAssignmentsFormState({});
    setFormAssignmentsError("");
    setFormAssignmentsReady(false);
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);

    if (item.tracking_type === "programado") {
      void loadAssignmentsForEdit(item.id);
    }

    if (item.tracking_type === "programado" && session?.access_token) {
      const pendingValues = getPendingCustomFieldValuesForItem(item);
      if (pendingValues) {
        setCustomFieldFormState(buildCustomFieldFormState(pendingValues));
      }

      if (item.id <= 0) {
        setFormCustomFieldsLoading(false);
        return;
      }

      setFormCustomFieldsLoading(true);
      void fetchPlanningCustomFieldValues({ planningItemId: item.id }, session.access_token)
        .then((values) => {
          setCustomFieldFormState(buildCustomFieldFormState(values));
          setFormCustomFieldsError("");
          void cacheCustomFieldValues(item.id, values);
        })
        .catch(async (error: unknown) => {
          const cachedValues = await readCachedCustomFieldValues(item.id);
          if (cachedValues) {
            setCustomFieldFormState(buildCustomFieldFormState(cachedValues));
            setFormCustomFieldsError("");
            return;
          }

          recordOperationalEvent({
            level: "warn",
            name: "planning_custom_field_values.load_failed",
            source: "planningPage",
            metadata: { planningItemId: item.id, mode: "edit" },
          });
          const message = getRequestErrorMessage(error, "No se pudieron cargar los campos configurables.");
          setFormCustomFieldsError(message);
          setFormError(message);
        })
        .finally(() => {
          setFormCustomFieldsLoading(false);
        });
    } else {
      setFormCustomFieldsLoading(false);
      setFormAssignmentsLoading(false);
    }
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
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("planning-sync-status", {
      detail: {
        pendingCount: retryablePlanningMutations.length,
        conflictCount: conflictedPlanningMutations.length,
        syncing: queueSyncing,
        lastSyncLabel: extractLastSyncLabel(itemsError, catalogError),
        errorMessage: [itemsError, catalogError].find((message) => message && !isTransientConnectivityMessage(message)) ?? "",
      },
    }));
  }, [
    catalogError,
    conflictedPlanningMutations.length,
    itemsError,
    queueSyncing,
    retryablePlanningMutations.length,
  ]);
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
  const currentTimeMarker = currentTime
    ? buildGanttCurrentTimeMarker(selectedDate, ganttScales[activeShift], currentTime)
    : null;
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
    const customFieldBadges = getCustomFieldDisplayEntries(
      customFields,
      item.tracking_type === "programado" ? getCustomFieldValuesForGanttPopover(item) : []
    );
    const assignmentBadges = getPlanningAssignmentTypeSummaries(
      assignmentTypes,
      item.tracking_type === "programado" ? getAssignmentsForItem(item) : []
    );
    const visibleAssignmentBadges = assignmentBadges.slice(0, 5);
    const hiddenAssignmentBadges = assignmentBadges.slice(5);
    const visibleCustomFieldBadges = customFieldBadges.slice(0, 4);
    const hiddenCustomFieldBadges = customFieldBadges.slice(4);

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
        <GanttTooltipPortal>
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
            {assignmentBadges.length ? (
              <span className="gantt-tooltip-custom-fields assignments" aria-label="Asignaciones operacionales">
                {visibleAssignmentBadges.map(({ type, count }) => {
                  const TypeIcon = getAssignmentTypeIcon(type.icon_key);
                  const tooltip = `${type.label}: ${count} ${count === 1 ? "asignada" : "asignadas"}`;

                  return (
                    <span
                      key={type.id}
                      className="gantt-tooltip-custom-field assignment"
                      data-tooltip={tooltip}
                      title={tooltip}
                      aria-label={tooltip}
                    >
                      <TypeIcon aria-hidden="true" />
                    </span>
                  );
                })}
                {hiddenAssignmentBadges.length ? (
                  <span
                    className="gantt-tooltip-custom-field assignment more"
                    data-tooltip={hiddenAssignmentBadges.map(({ type, count }) => `${type.label}: ${count}`).join(" · ")}
                    title={hiddenAssignmentBadges.map(({ type, count }) => `${type.label}: ${count}`).join(" · ")}
                    aria-label={`${hiddenAssignmentBadges.length} tipos de asignacion adicionales`}
                  >
                    +{hiddenAssignmentBadges.length}
                  </span>
                ) : null}
              </span>
            ) : null}
            {customFieldBadges.length ? (
              <span className="gantt-tooltip-custom-fields" aria-label="Campos configurables">
                {visibleCustomFieldBadges.map(({ field, value }) => {
                  const FieldIcon = getPlanningCustomFieldIcon(field.icon_key) ?? Tag;

                  return (
                    <span
                      key={field.id}
                      className="gantt-tooltip-custom-field"
                      data-tooltip={`${field.label}: ${value}`}
                      title={`${field.label}: ${value}`}
                      aria-label={`${field.label}: ${value}`}
                    >
                      <FieldIcon aria-hidden="true" />
                    </span>
                  );
                })}
                {hiddenCustomFieldBadges.length ? (
                  <span
                    className="gantt-tooltip-custom-field more"
                    data-tooltip={hiddenCustomFieldBadges.map(({ field, value }) => `${field.label}: ${value}`).join(" · ")}
                    title={hiddenCustomFieldBadges.map(({ field, value }) => `${field.label}: ${value}`).join(" · ")}
                    aria-label={`${hiddenCustomFieldBadges.length} campos configurables adicionales`}
                  >
                    +{hiddenCustomFieldBadges.length}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </GanttTooltipPortal>
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
        aria-label={`Agregar actividad asociada a ${buildEventTitle(group)}`}
        title="Agregar actividad"
      >
        <CirclePlus aria-hidden="true" />
        <span>Actividad</span>
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
    setCustomFieldFormState({});
    setFormCustomFieldsLoading(false);
    setFormCustomFieldsError("");
    setFormAssignmentTypes([]);
    setPlanningAssignmentsFormState({});
    setFormAssignmentsError("");
    setFormAssignmentsReady(false);
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);
    if (trackingType === "programado") {
      void loadAssignmentTypesForCreate();
    } else {
      setFormAssignmentsLoading(false);
    }
  }

  return (
    <section className="home-grid">
      <OperationalHero
        activeShift={activeShift}
        onSelectShift={selectActiveShift}
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
          setFormCustomFieldsLoading(true);
          setFormCustomFieldsError("");
          setFormAssignmentsError("");
          setIsModalOpen(true);
          void loadAssignmentTypesForCreate();
          void refreshCustomFields().catch((error: unknown) => {
            recordOperationalEvent({
              level: "warn",
              name: "planning_custom_fields.load_failed",
              source: "planningPage",
              metadata: { target: "open-planning-modal" },
            });
            const message = getRequestErrorMessage(error, "No se pudieron cargar los campos configurables.");
            setFormCustomFieldsError(message);
            setCatalogError(message);
          }).finally(() => {
            setFormCustomFieldsLoading(false);
          });
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
        networkStatus={networkStatus}
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
                currentTimeMarker={currentTimeMarker}
                renderBar={renderGanttBar}
                renderCreateRealButton={renderCreateRealButton}
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
          customFieldsSlot={
            formState.tracking_type === "programado" ? (
              <PlanningCustomFieldsForm
                fields={customFields}
                phase="planned"
                value={customFieldFormState}
                onChange={setCustomFieldFormState}
                disabled={formBusy}
                loading={customFieldsLoading || formCustomFieldsLoading}
                error={formCustomFieldsError || customFieldsError}
              />
            ) : null
          }
          assignmentsSlot={
            formState.tracking_type === "programado" ? (
              <PlanningAssignmentsForm
                types={formAssignmentTypes}
                value={planningAssignmentsFormState}
                onChange={setPlanningAssignmentsFormState}
                online={networkStatus === "online" && !isBrowserOffline()}
                disabled={formBusy}
                loading={formAssignmentsLoading}
                error={formAssignmentsError}
              />
            ) : null
          }
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
          customFieldsSlot={
            viewingPlanningItem.tracking_type === "programado" ? (
              <PlanningCustomFieldsSummary
                fields={customFields}
                values={viewingCustomFieldValues}
                loading={customFieldsLoading || viewingCustomFieldsLoading}
                error={viewingCustomFieldsError || customFieldsError}
              />
            ) : null
          }
          assignmentsSlot={
            viewingPlanningItem.tracking_type === "programado" ? (
              <PlanningAssignmentsSummary
                types={viewingAssignmentTypes}
                assignments={viewingPlanningAssignments}
                loading={viewingAssignmentsLoading}
                error={viewingAssignmentsError}
              />
            ) : null
          }
          historySlot={
            viewingPlanningItem.tracking_type === "programado" && canManageCatalog ? (
              <PlanningAuditTimeline
                planningItemId={viewingPlanningItem.id}
                accessToken={session?.access_token}
                enabled={Boolean(session?.access_token)}
              />
            ) : null
          }
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
          onClose={() => {
            void refreshCustomFields()
              .catch(() => undefined)
              .finally(() => setIsCatalogModalOpen(false));
          }}
          onCreateType={handleCreateType}
          onCreateLevel={handleCreateLevel}
          onCreateDetail={handleCreateDetail}
          onUpdateType={handleUpdateType}
          onUpdateLevel={handleUpdateLevel}
          onUpdateDetail={handleUpdateDetail}
          onDeleteType={(id) => void handleDeleteType(id)}
          onDeleteLevel={(id) => void handleDeleteLevel(id)}
          onDeleteDetail={(id) => void handleDeleteDetail(id)}
          customFieldsAdminSlot={
            <PlanningCustomFieldsAdminPanel
              accessToken={session?.access_token}
              onFieldsChange={setCustomFields}
            />
          }
        />
      ) : null}
    </section>
  );
}
