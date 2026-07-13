"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CirclePlus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { CatalogSheet } from "@/components/planning/catalog-sheet";
import { DeleteConfirmationDialog } from "@/components/planning/delete-confirmation-dialog";
import { GanttTooltipPortal } from "@/components/planning/gantt-tooltip-portal";
import { GanttShiftSection, type GanttHierarchyViewControls } from "@/components/planning/gantt-shift-section";
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
import { fetchOperationalHeaderConfig } from "@/modules/operational-header/application/operational-header.client";
import type { OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";
import {
  fetchAssignmentTypes,
  fetchPlanningAssignmentsForTarget,
  fetchPlanningAssignmentsForItems,
  savePlanningAssignmentsForTarget,
} from "@/modules/planning-assignments/application/planning-assignments.client";
import type {
  AssignmentTarget,
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
  readAssignmentsCacheForTarget,
  readAssignmentTypesCache,
  saveAssignmentTypesCache,
  saveAssignmentsCacheForTarget,
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
  readPlanningCache,
  saveCatalogCache,
  savePlanningCache,
} from "@/lib/localOfflineStore";
import { recordOperationalEvent } from "../../lib/observability/logger";
import {
  buildEventSubtitle,
  buildEventTitle,
  buildGanttBarPlacement,
  buildGanttCurrentTimeMarker,
  buildGanttBarLabel,
  buildGanttScale,
  buildPlanningItemAriaLabel,
  doesPlanningItemIntersectShiftWindow,
  formatDateLabel,
  formatDateTitle,
  formatDuration,
  formatLocalDateIso,
  formatLocalDateTime,
  formatMonthTitle,
  getCalendarDays,
  getCurrentOperationalDate,
  getDefaultRealEventTimes,
  getDefaultShiftTimes,
  getGanttGroupingFields,
  getInitialOperationalView,
  isSameCalendarMonth,
  SHIFT_CONFIG,
  toDisplayCategory,
  toTrackingTypeLabel,
  type GanttScale,
  type ShiftKey,
} from "@/modules/planning/presentation/planning-page-helpers";
import type {
  CatalogCategory,
  PlanningCatalog,
  PlanningGroup,
  PlanningItem,
  PlanningItemForm,
} from "@/modules/planning/presentation/planning-page-models";
import {
  findSegmentContinuation,
  getProgrammablePlanningCategories,
  getProgrammablePlanningTypes,
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
  operational_header_values?: PlanningItem["operational_header_values"];
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
const disabledGanttHierarchyViewControls: GanttHierarchyViewControls = {
  canExpandAll: false,
  canCollapseAll: false,
  expandAll: () => undefined,
  collapseAll: () => undefined,
};

function toPlanningItemAssignmentTarget(planningItemId: number): AssignmentTarget {
  return { target_kind: "planning_item", target_id: planningItemId };
}

function getAssignmentTargetForItem(item: PlanningItem): AssignmentTarget {
  return item.tracking_type === "programado"
    ? { target_kind: "planning_item", target_id: item.id }
    : { target_kind: "execution_segment", target_id: item.id };
}

function getAssignmentTargetKey(target: AssignmentTarget) {
  return `${target.target_kind}:${target.target_id}`;
}

function getAssignmentTitleForItem(item: Pick<PlanningItem, "tracking_type" | "category">) {
  if (item.tracking_type === "programado") {
    return "Asignaciones planificadas";
  }

  return item.category === "interferencia" ? "Recursos involucrados" : "Asignaciones reales";
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

function toOperationalHeaderValueInputs(
  config: OperationalHeaderResponseDto | null,
  values: Record<number, string>
) {
  if (!config) {
    return [];
  }

  return config.fields
    .filter((field) => field.active)
    .map((field) => ({
      field_id: field.id,
      value: values[field.id] ?? "",
    }));
}

function toOperationalHeaderFormState(item: Pick<PlanningItem, "operational_header_values">) {
  return (item.operational_header_values ?? []).reduce<Record<number, string>>((accumulator, value) => {
    accumulator[value.field_id] = value.value;
    return accumulator;
  }, {});
}

export default function Home() {
  const { session, profile } = useAuth();
  const networkStatus = useSyncExternalStore(
    subscribeNetworkStatus,
    getNetworkStatusSnapshot,
    () => "offline" as const
  );
  const canManageCatalog = profile?.role === "admin";
  const canOperatePlanning = profile?.role === "admin" || profile?.role === "operator";
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const todayIso = getCurrentOperationalDate(currentTime);
  const initialOperationalView = getInitialOperationalView(currentTime);
  const [planningItems, setPlanningItems] = useState<PlanningItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialOperationalView.selectedDate);
  const [historicalEditingEnabled, setHistoricalEditingEnabled] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(`${todayIso}T00:00:00`));
  const [activeShift, setActiveShift] = useState<ShiftKey>(initialOperationalView.activeShift);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [pendingPlanningMutations, setPendingPlanningMutations] = useState<PendingPlanningMutation[]>([]);
  const syncPendingPlanningMutationsRef = useRef<() => void>(() => undefined);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [operationalHeaderConfig, setOperationalHeaderConfig] = useState<OperationalHeaderResponseDto | null>(null);
  const [formAssignmentTypes, setFormAssignmentTypes] = useState<AssignmentTypeDto[]>([]);
  const [planningAssignmentsFormState, setPlanningAssignmentsFormState] = useState<PlanningAssignmentsFormState>({});
  const [formAssignmentsLoading, setFormAssignmentsLoading] = useState(false);
  const [formAssignmentsError, setFormAssignmentsError] = useState("");
  const [formAssignmentsReady, setFormAssignmentsReady] = useState(false);
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeDto[]>([]);
  const [planningAssignmentsByTargetKey, setPlanningAssignmentsByTargetKey] = useState<Record<string, PlanningAssignmentDto[]>>({});
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
  const [ganttHierarchyViewControls, setGanttHierarchyViewControls] = useState<GanttHierarchyViewControls>(
    disabledGanttHierarchyViewControls
  );
  const [formState, setFormState] = useState<PlanningItemForm>(toInitialPlanningForm([], "Dia", formatLocalDateIso()));
  const [dynamicHeaderFormState, setDynamicHeaderFormState] = useState<Record<number, string>>({});
  const resumeRefreshInFlightRef = useRef(false);

  const selectActiveShift = useCallback((shift: ShiftKey) => {
    setActiveShift(shift);
  }, []);

  useEffect(() => {
    const now = new Date();
    const operationalView = getInitialOperationalView(now);
    setActiveShift(operationalView.activeShift);
    setSelectedDate(operationalView.selectedDate);
    setCurrentTime(now);
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  function syncAdminCatalogRefresh(nextCatalog: PlanningCatalog) {
    setCatalog(nextCatalog.categories);
    setFormState((current) => syncPlanningForm(current, nextCatalog.categories));
  }

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
    onRefresh: syncAdminCatalogRefresh,
    getRequestErrorMessage,
  });

  const preloadPlanningAssignmentsForItems = useCallback(async (items: PlanningItem[]) => {
    const planningItemIds = items
      .filter((item) => item.tracking_type === "programado" && item.id > 0)
      .map((item) => item.id);
    const executionSegmentTargets = items
      .filter((item) => item.tracking_type === "real" && item.id > 0)
      .map(getAssignmentTargetForItem);
    const visibleTargets = [
      ...planningItemIds.map(toPlanningItemAssignmentTarget),
      ...executionSegmentTargets,
    ];

    async function loadCachedAssignments() {
      const [cachedTypes, cachedEntries] = await Promise.all([
        readAssignmentTypesCache().catch(() => null),
        Promise.all(
          visibleTargets.map(async (target) => [
            getAssignmentTargetKey(target),
            await readAssignmentsCacheForTarget(target).catch(() => null),
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
      setPlanningAssignmentsByTargetKey((current) => ({
        ...current,
        ...Object.fromEntries(cachedEntries.map(([key, assignments]) => [key, assignments ?? []])),
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
      const executionSegmentAssignments = await Promise.all(
        executionSegmentTargets.map(async (target) => [
          target,
          await fetchPlanningAssignmentsForTarget(target, session.access_token),
        ] as const)
      );
      const nextAssignmentsByTargetKey = Object.fromEntries(
        visibleTargets.map((target) => [getAssignmentTargetKey(target), [] as PlanningAssignmentDto[]])
      );
      for (const assignment of assignments) {
        if (!assignment.planning_item_id) {
          continue;
        }
        const key = getAssignmentTargetKey(toPlanningItemAssignmentTarget(assignment.planning_item_id));
        nextAssignmentsByTargetKey[key] = [
          ...(nextAssignmentsByTargetKey[key] ?? []),
          assignment,
        ];
      }
      for (const [target, targetAssignments] of executionSegmentAssignments) {
        nextAssignmentsByTargetKey[getAssignmentTargetKey(target)] = targetAssignments;
      }
      setAssignmentTypes(types);
      setPlanningAssignmentsByTargetKey((current) => ({ ...current, ...nextAssignmentsByTargetKey }));
      void saveAssignmentTypesCache(types);
      void Promise.all(
        Object.entries(nextAssignmentsByTargetKey).map(([key, itemAssignments]) => {
          const target = visibleTargets.find((entry) => getAssignmentTargetKey(entry) === key);
          return target ? saveAssignmentsCacheForTarget(target, itemAssignments).catch(() => undefined) : Promise.resolve();
        })
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
    void preloadPlanningAssignmentsForItems(nextItems);
  }, [preloadPlanningAssignmentsForItems, selectedDate, session?.access_token]);

  const refreshCatalog = useCallback(async () => {
    const nextCatalog = await fetchPlanningCatalog(session?.access_token);
    setCatalog(nextCatalog.categories);
    setFormState((current) => syncPlanningForm(current, nextCatalog.categories));
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
        ]);
        const failed = results.filter((result) => result.status === "rejected");

        if (failed.length === 0) {
          setItemsError((current) => (isTransientConnectivityMessage(current) ? "" : current));
          setCatalogError((current) => (isTransientConnectivityMessage(current) ? "" : current));
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
  }, [refreshCatalog, refreshPlanningItems, selectedDate]);

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
            setFormState((current) =>
              syncPlanningForm(current, cachedCatalog.value.categories)
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
      setOperationalHeaderConfig(null);
      return;
    }

    let active = true;

    fetchOperationalHeaderConfig(session.access_token)
      .then((config) => {
        if (active) {
          setOperationalHeaderConfig(config);
        }
      })
      .catch(() => {
        if (active) {
          setOperationalHeaderConfig(null);
        }
      });

    return () => {
      active = false;
    };
  }, [session?.access_token]);

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
  }, [preloadPlanningAssignmentsForItems, selectedDate, session?.access_token]);

  useEffect(() => {
    if (formState.tracking_type !== "programado") {
      return;
    }

    const programmableCategories = getProgrammablePlanningCategories(catalog);

    if (programmableCategories.some((category) => category.slug === formState.category)) {
      return;
    }

    const nextCategory = programmableCategories[0] ?? null;
    const nextType = getProgrammablePlanningTypes(nextCategory)[0] ?? null;
    const nextDetail = nextType?.details[0] ?? null;

    setFormState((current) => ({
      ...current,
      category: nextCategory?.slug ?? "actividad",
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

  function findPendingPlanningMutationForItemId(planningItemId: number) {
    return pendingPlanningMutations.find((mutation) => {
      const payloadId = Number(mutation.payload.id);
      if (Number.isFinite(payloadId) && payloadId === planningItemId) {
        return true;
      }

      return toOptimisticPlanningItem(mutation)?.id === planningItemId;
    });
  }

  function getPendingAssignmentsForItem(item: PlanningItem) {
    if (item.tracking_type !== "programado") {
      return null;
    }

    const pendingMutation = findPendingPlanningMutationForItemId(item.id);
    return pendingMutation?.assignmentPayload !== undefined
      ? toDisplayPlanningAssignments(pendingMutation.assignmentPayload, item.id)
      : null;
  }

  function getAssignmentsForItem(item: PlanningItem) {
    return getPendingAssignmentsForItem(item) ?? planningAssignmentsByTargetKey[getAssignmentTargetKey(getAssignmentTargetForItem(item))] ?? [];
  }

  function resetPlanningForm() {
    const nextForm = syncPlanningForm(toInitialPlanningForm(catalog, activeShift, selectedDate), catalog);
    setFormState({ ...nextForm, item_date: selectedDate, shift: activeShift });
    setDynamicHeaderFormState({});
    setFormAssignmentTypes([]);
    setPlanningAssignmentsFormState({});
    setFormAssignmentsLoading(false);
    setFormAssignmentsError("");
    setFormAssignmentsReady(false);
    setFormError("");
    setEditingPlanningItem(null);
  }

  function openPlanningDetail(item: PlanningItem) {
    const assignmentTarget = getAssignmentTargetForItem(item);
    const assignmentTargetKey = getAssignmentTargetKey(assignmentTarget);
    setViewingPlanningItem(item);
    setViewingAssignmentTypes(assignmentTypes);
    setViewingPlanningAssignments(getAssignmentsForItem(item));
    setViewingAssignmentsError("");

    if (item.id <= 0) {
      setViewingAssignmentsLoading(false);
      return;
    }

    if (!session?.access_token) {
      setViewingAssignmentsLoading(false);
      if (!getPendingAssignmentsForItem(item)) {
        void Promise.all([
          readAssignmentTypesCache().catch(() => null),
          readAssignmentsCacheForTarget(assignmentTarget).catch(() => null),
        ]).then(([types, assignments]) => {
          if (types) setViewingAssignmentTypes(types);
          if (assignments) setViewingPlanningAssignments(assignments);
        });
      }
      return;
    }

    setViewingAssignmentsLoading(!isBrowserOffline());

    if (isBrowserOffline()) {
      if (!getPendingAssignmentsForItem(item)) {
        void Promise.all([
          readAssignmentTypesCache().catch(() => null),
          readAssignmentsCacheForTarget(assignmentTarget).catch(() => null),
        ]).then(([types, assignments]) => {
          if (types) {
            setAssignmentTypes(types);
            setViewingAssignmentTypes(types);
          }
          if (assignments) {
            setViewingPlanningAssignments(assignments);
            setPlanningAssignmentsByTargetKey((current) => ({ ...current, [assignmentTargetKey]: assignments }));
          }
        });
      }
      setViewingAssignmentsError("");
    } else {
      void Promise.all([
        fetchAssignmentTypes(session.access_token, { activeOnly: false }),
        fetchPlanningAssignmentsForTarget(assignmentTarget, session.access_token),
      ])
        .then(([types, assignments]) => {
          setViewingAssignmentTypes(types);
          setViewingPlanningAssignments(assignments);
          setAssignmentTypes(types);
          setPlanningAssignmentsByTargetKey((current) => ({ ...current, [assignmentTargetKey]: assignments }));
          void saveAssignmentTypesCache(types);
          void saveAssignmentsCacheForTarget(assignmentTarget, assignments);
          setViewingAssignmentsError("");
        })
        .catch((error: unknown) => {
          recordOperationalEvent({
            level: "warn",
            name: "planning_assignments.load_failed",
            source: "planningPage",
            metadata: { targetKind: assignmentTarget.target_kind, targetId: assignmentTarget.target_id, mode: "detail" },
          });
          setViewingAssignmentsError(getRequestErrorMessage(error, "No se pudieron cargar las asignaciones."));
        })
        .finally(() => setViewingAssignmentsLoading(false));
    }
  }

  async function loadAssignmentTypesForCreate(input: { targetKind?: AssignmentTarget["target_kind"] } = {}) {
    if (!canOperatePlanning) {
      setFormAssignmentTypes([]);
      setPlanningAssignmentsFormState({});
      setFormAssignmentsReady(false);
      setFormAssignmentsError("");
      setFormAssignmentsLoading(false);
      return;
    }

    if (input.targetKind === "execution_segment" && (!session?.access_token || isBrowserOffline())) {
      setFormAssignmentTypes([]);
      setPlanningAssignmentsFormState({});
      setFormAssignmentsReady(false);
      setFormAssignmentsError("Las asignaciones reales requieren conexión por ahora.");
      setFormAssignmentsLoading(false);
      return;
    }

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

  async function loadAssignmentsForEdit(item: PlanningItem) {
    if (!canOperatePlanning) {
      setFormAssignmentTypes([]);
      setPlanningAssignmentsFormState({});
      setFormAssignmentsReady(false);
      setFormAssignmentsError("");
      setFormAssignmentsLoading(false);
      return;
    }

    const target = getAssignmentTargetForItem(item);
    const isExecutionSegmentTarget = target.target_kind === "execution_segment";
    const pendingMutation = item.tracking_type === "programado" ? findPendingPlanningMutationForItemId(item.id) : null;
    const pendingAssignments = pendingMutation?.assignmentPayload !== undefined
      ? toDisplayPlanningAssignments(pendingMutation.assignmentPayload, item.id)
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
    if (isExecutionSegmentTarget && (!session?.access_token || isBrowserOffline())) {
      setFormAssignmentTypes([]);
      setAssignmentTypes(assignmentTypes);
      setPlanningAssignmentsFormState({});
      setFormAssignmentsReady(false);
      setFormAssignmentsError("Las asignaciones reales requieren conexión por ahora.");
      setFormAssignmentsLoading(false);
      return;
    }

    if (!session?.access_token || isBrowserOffline() || item.id <= 0) {
      const [cachedTypes, cachedAssignments] = await Promise.all([
        readAssignmentTypesCache().catch(() => null),
        item.id > 0 ? readAssignmentsCacheForTarget(target).catch(() => null) : Promise.resolve(null),
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
        fetchPlanningAssignmentsForTarget(target, session.access_token),
      ]);
      setFormAssignmentTypes(toOperationalAssignmentTypes(types));
      setAssignmentTypes(types);
      setPlanningAssignmentsFormState(buildPlanningAssignmentsFormState(assignments));
      setFormAssignmentsReady(true);
      void saveAssignmentTypesCache(types);
      void saveAssignmentsCacheForTarget(target, assignments);
    } catch (error: unknown) {
      const [cachedTypes, cachedAssignments] = await Promise.all([
        readAssignmentTypesCache().catch(() => null),
        readAssignmentsCacheForTarget(target).catch(() => null),
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
      assignmentPayload?: PlanningAssignmentInputDto[];
      syncedPlanningItemId?: number;
    } = {}
  ) {
    if (!canOperatePlanning) {
      throw new Error("Solo los usuarios operativos pueden modificar la planificacion.");
    }

    const pendingMutation = makePendingPlanningMutation(method, payload, input);
    setPendingPlanningMutations((current) => [...current, pendingMutation]);
    return pendingMutation;
  }

  async function syncPendingPlanningMutations() {
    if (!canOperatePlanning) {
      return;
    }

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

        const savedAssignments = await savePlanningAssignmentsForTarget(
          toPlanningItemAssignmentTarget(planningItemId),
          mutation.assignmentPayload,
          session.access_token
        );
        const assignmentTarget = toPlanningItemAssignmentTarget(planningItemId);
        setPlanningAssignmentsByTargetKey((current) => ({ ...current, [getAssignmentTargetKey(assignmentTarget)]: savedAssignments }));
        void saveAssignmentsCacheForTarget(assignmentTarget, savedAssignments);
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

    if (!canOperatePlanning) {
      setFormError("Solo los usuarios operativos pueden modificar la planificacion.");
      return;
    }

    const method = editingPlanningItem ? "PATCH" : "POST";
    const operationalHeaderValues = toOperationalHeaderValueInputs(operationalHeaderConfig, dynamicHeaderFormState);
    const mutationPayload = {
      ...formState,
      operational_header_values: operationalHeaderValues,
    };
    const payload: PlanningItemMutationPayload = editingPlanningItem
      ? { id: editingPlanningItem.id, ...mutationPayload }
      : withClientMutationId(mutationPayload) as PlanningItemMutationPayload;

    if (!session?.access_token) {
      if (isBrowserOffline()) {
        if (formState.tracking_type === "real" && formAssignmentsReady) {
          setFormAssignmentsError("Las asignaciones reales requieren conexión por ahora.");
          setFormError("Las asignaciones reales requieren conexión por ahora.");
          return;
        }

        enqueuePlanningMutation(method, payload, {
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

      if (formAssignmentsReady && Number.isFinite(savedItemId) && savedItemId > 0) {
        const assignmentPayload = toPlanningAssignmentInputs(formAssignmentTypes, planningAssignmentsFormState);
        const assignmentTarget = formState.tracking_type === "programado"
          ? toPlanningItemAssignmentTarget(savedItemId)
          : ({ target_kind: "execution_segment", target_id: savedItemId } satisfies AssignmentTarget);

        if (isBrowserOffline()) {
          if (assignmentTarget.target_kind === "execution_segment") {
            setFormAssignmentsError("Las asignaciones reales requieren conexión por ahora.");
            setFormError("Las asignaciones reales requieren conexión por ahora.");
            return;
          }

          enqueuePlanningMutation(method, payload, { assignmentPayload, syncedPlanningItemId: savedItemId });
          setItemsError("Sin conexion: la programacion se guardo y sus asignaciones quedaron pendientes de sincronizacion.");
          setIsModalOpen(false);
          resetPlanningForm();
          return;
        }

        try {
          const savedAssignments = await savePlanningAssignmentsForTarget(
            assignmentTarget,
            assignmentPayload,
            session.access_token
          );
          setPlanningAssignmentsByTargetKey((current) => ({ ...current, [getAssignmentTargetKey(assignmentTarget)]: savedAssignments }));
          void saveAssignmentsCacheForTarget(assignmentTarget, savedAssignments);
        } catch (error: unknown) {
          if (assignmentTarget.target_kind === "planning_item" && shouldQueuePlanningMutation(error)) {
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
            metadata: { targetKind: assignmentTarget.target_kind, targetId: assignmentTarget.target_id },
          });
          setEditingPlanningItem({ id: savedItemId });
          setFormAssignmentsError(getRequestErrorMessage(error, "El registro se guardo, pero no se pudieron guardar sus asignaciones. Reintenta guardar para completarlas."));
          await refreshPlanningItems().catch(() => undefined);
          return;
        }
      }

      await refreshPlanningItems();
      setIsModalOpen(false);
      resetPlanningForm();
    } catch (error: unknown) {
      if (shouldQueuePlanningMutation(error)) {
        enqueuePlanningMutation(method, payload, {
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
    if (!canOperatePlanning) {
      return;
    }

    if (selectedDate !== todayIso && !historicalEditingEnabled) {
      return;
    }

    const nextCategory =
      catalog.find((category) => category.slug === item.category) ?? null;
    const nextAvailableTypes =
      item.tracking_type === "programado"
        ? getProgrammablePlanningTypes(nextCategory)
        : nextCategory?.types ?? [];
    const nextType = nextAvailableTypes.find((type) => type.label === item.item_type) ?? nextAvailableTypes[0] ?? null;
    const nextDetail = nextType?.details.find((detail) => detail.label === item.description) ?? nextType?.details[0] ?? null;

    setFormState({
      activity_group_id: item.activity_group_id,
      item_date: item.item_date,
      start_time: item.start,
      end_time: item.end,
      shift: item.shift,
      category: item.category,
      tracking_type: item.tracking_type,
      item_type: nextType?.label ?? item.item_type,
      description: nextDetail?.label ?? item.description,
      notes: item.notes ?? "",
    });
    setDynamicHeaderFormState(toOperationalHeaderFormState(item));
    setEditingPlanningItem({ id: item.id });
    setFormAssignmentTypes([]);
    setPlanningAssignmentsFormState({});
    setFormAssignmentsError("");
    setFormAssignmentsReady(false);
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);

    void loadAssignmentsForEdit(item);
  }

  async function handleDeletePlanningItem(id: number, trackingType: PlanningItem["tracking_type"]) {
    setFormError("");

    if (!canOperatePlanning) {
      setFormError("Solo los usuarios operativos pueden eliminar registros.");
      return;
    }

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
    if (!canOperatePlanning) {
      return;
    }

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
    : getProgrammablePlanningCategories(catalog).map((category) => ({
        ...category,
        types: getProgrammablePlanningTypes(category),
      }));
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
  const ganttGroupingFields = useMemo(
    () => (operationalHeaderConfig ? getGanttGroupingFields(operationalHeaderConfig) : []),
    [operationalHeaderConfig]
  );
  const allPlanningGroups = groupPlanningItems(visiblePlanningItems, ganttGroupingFields);
  const planningGroupsByShift: Record<ShiftKey, PlanningGroup[]> = {
    Dia: allPlanningGroups.filter(
      (group) =>
        (group.programado ? doesPlanningItemIntersectShiftWindow(group.programado, "Dia") : false) ||
        group.realSegments.some((segment) => segment.shift === "Dia")
    ),
    Noche: allPlanningGroups.filter(
      (group) =>
        (group.programado ? doesPlanningItemIntersectShiftWindow(group.programado, "Noche") : false) ||
        group.realSegments.some((segment) => segment.shift === "Noche")
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

  function renderGanttAssignmentIndicators(item: PlanningItem | null) {
    if (!item) {
      return null;
    }

    const assignmentSummaries = getPlanningAssignmentTypeSummaries(
      assignmentTypes,
      getAssignmentsForItem(item)
    );

    if (!assignmentSummaries.length) {
      return null;
    }

    return (
      <div className="gantt-meta-assignments" aria-label="Asignaciones operacionales">
        {assignmentSummaries.map(({ type }) => {
          const TypeIcon = getAssignmentTypeIcon(type.icon_key);

          return (
            <span key={type.id} className="gantt-tooltip-custom-field assignment" aria-hidden="true">
              <TypeIcon aria-hidden="true" />
            </span>
          );
        })}
      </div>
    );
  }

  function renderGanttBar(item: PlanningItem | null, layer: "programado" | "real", scale: GanttScale) {
    if (!item) {
      return null;
    }

    const visualStart = item.gantt_projection?.start ?? item.start;
    const visualEnd = item.gantt_projection?.end ?? item.end;
    const placement = buildGanttBarPlacement(visualStart, visualEnd, scale);

    if (!placement) {
      return null;
    }

    const duration = formatDuration(item.start, item.end);
    const ariaLabel = buildPlanningItemAriaLabel(item, duration);
    const barLabel = buildGanttBarLabel(item, layer);
    const locationLabel = buildEventSubtitle() || "Sin ubicacion";
    const assignmentBadges = getPlanningAssignmentTypeSummaries(
      assignmentTypes,
      getAssignmentsForItem(item)
    );
    const visibleAssignmentBadges = assignmentBadges.slice(0, 5);
    const hiddenAssignmentBadges = assignmentBadges.slice(5);

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
        style={{ left: `${placement.leftPercent}%`, width: `${placement.widthPercent}%` }}
      >
        <span className="gantt-bar-content" aria-hidden="true">
          <span className={`gantt-bar-label ${layer}`}>{barLabel}</span>
          <span className="gantt-bar-subline">
            {visualStart} - {visualEnd}
          </span>
        </span>
        {item.sync_status === "pending" ? <span className="gantt-bar-status-dot" aria-hidden="true" /> : null}
        <GanttTooltipPortal>
          <span className="gantt-tooltip-content">
            <strong>{item.description}</strong>
            <span className="gantt-tooltip-muted">
              {item.start} - {item.end}
            </span>
            <span className="gantt-tooltip-muted">
              Duracion: {duration}
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
          </span>
        </GanttTooltipPortal>
      </button>
    );
  }

  function renderCreateRealButton(group: PlanningGroup) {
    if (!canOperatePlanning || isHistoricalReadOnly || !group.programado) {
      return null;
    }

    return (
      <button
        type="button"
        className="button gantt-meta-add-real"
        onClick={() => openCreatePlanningVariant(group, "real")}
        aria-label={`Registrar actividad o interferencia asociada a ${buildEventTitle(group)}`}
        title="Registrar actividad o interferencia"
      >
        <CirclePlus aria-hidden="true" />
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
    if (!canOperatePlanning) {
      return;
    }

    if (isHistoricalReadOnly) {
      return;
    }

    const lastRealSegment = group.realSegments[group.realSegments.length - 1] ?? null;
    const sourceItem =
      trackingType === "real"
        ? lastRealSegment ?? group.programado
        : group.programado ?? lastRealSegment;
    const nextCategory = catalog.find((category) => category.slug === group.category) ?? null;
    const nextAvailableTypes =
      trackingType === "programado"
        ? getProgrammablePlanningTypes(nextCategory)
        : nextCategory?.types ?? [];
    const nextType = nextAvailableTypes.find((type) => type.label === group.item_type) ?? nextAvailableTypes[0] ?? null;
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
      category: group.category,
      tracking_type: trackingType,
      item_type: nextType?.label ?? group.item_type,
      description: nextDetail?.label ?? group.description,
      notes: trackingType === "real" ? "" : sourceItem?.notes ?? group.notes ?? "",
    });
    setDynamicHeaderFormState(
      sourceItem
        ? toOperationalHeaderFormState(sourceItem)
        : {}
    );
    setEditingPlanningItem(null);
    setFormAssignmentTypes([]);
    setPlanningAssignmentsFormState({});
    setFormAssignmentsError("");
    setFormAssignmentsReady(false);
    setFormError("");
    setViewingPlanningItem(null);
    setIsModalOpen(true);
    void loadAssignmentTypesForCreate({
      targetKind: trackingType === "programado" ? "planning_item" : "execution_segment",
    });
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
        isCreateDisabled={!canOperatePlanning || !session || catalogLoading || !catalog.length || isHistoricalReadOnly}
        createTitle={
          !canOperatePlanning
            ? "Solo lectura: no puedes crear registros"
            : isHistoricalReadOnly
              ? "Habilita la edicion historica para crear registros"
              : "Nueva programacion"
        }
        canExpandGanttHierarchy={ganttHierarchyViewControls.canExpandAll}
        canCollapseGanttHierarchy={ganttHierarchyViewControls.canCollapseAll}
        formatDateTitle={formatDateTitle}
        formatMonthTitle={formatMonthTitle}
        formatLocalDateIso={formatLocalDateIso}
        onSelectOperationalDate={selectOperationalDate}
        onExpandGanttHierarchy={ganttHierarchyViewControls.expandAll}
        onCollapseGanttHierarchy={ganttHierarchyViewControls.collapseAll}
        onCreatePlanning={() => {
          if (!canOperatePlanning) {
            return;
          }

          resetPlanningForm();
          setFormState((current) => ({ ...current, tracking_type: "programado" }));
          setFormAssignmentsError("");
          setIsModalOpen(true);
          void loadAssignmentTypesForCreate();
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
                groupingFields={ganttGroupingFields}
                currentTimeMarker={currentTimeMarker}
                renderBar={renderGanttBar}
                renderAssignmentIndicators={renderGanttAssignmentIndicators}
                renderCreateRealButton={renderCreateRealButton}
                onHierarchyViewControlsChange={setGanttHierarchyViewControls}
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
          formState={formState}
          setFormState={setFormState}
          availableFormCategories={availableFormCategories}
          availableTypes={availableTypes}
          availableDescriptions={availableDescriptions}
          operationalHeaderConfig={operationalHeaderConfig}
          dynamicHeaderValues={dynamicHeaderFormState}
          onDynamicHeaderValuesChange={setDynamicHeaderFormState}
          error={formError}
          busy={formBusy}
          isEditing={Boolean(editingPlanningItem)}
          deleteLabel={planningDeleteLabel}
          submitLabel={planningSubmitLabel}
          assignmentsSlot={
            <PlanningAssignmentsForm
              title={getAssignmentTitleForItem(formState)}
              types={formAssignmentTypes}
              value={planningAssignmentsFormState}
              onChange={setPlanningAssignmentsFormState}
              online={networkStatus === "online" && !isBrowserOffline()}
              disabled={formBusy || (formState.tracking_type === "real" && (!session?.access_token || isBrowserOffline()))}
              loading={formAssignmentsLoading}
              error={formAssignmentsError}
            />
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
          readOnly={isHistoricalReadOnly || !canOperatePlanning}
          formatDateLabel={formatDateLabel}
          formatDuration={formatDuration}
          toDisplayCategory={toDisplayCategory}
          toTrackingTypeLabel={toTrackingTypeLabel}
          operationalHeaderConfig={operationalHeaderConfig}
          assignmentsSlot={
            <PlanningAssignmentsSummary
              title={getAssignmentTitleForItem(viewingPlanningItem)}
              types={viewingAssignmentTypes}
              assignments={viewingPlanningAssignments}
              loading={viewingAssignmentsLoading}
              error={viewingAssignmentsError}
            />
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
          onClose={() => setIsCatalogModalOpen(false)}
          onCreateType={handleCreateType}
          onCreateDetail={handleCreateDetail}
          onUpdateType={handleUpdateType}
          onUpdateDetail={handleUpdateDetail}
          onDeleteType={(id) => void handleDeleteType(id)}
          onDeleteDetail={(id) => void handleDeleteDetail(id)}
        />
      ) : null}
    </section>
  );
}
