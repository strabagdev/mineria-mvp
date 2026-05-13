"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { supabaseAuth } from "@/lib/authClient";
import { CatalogSheet } from "@/components/planning/catalog-sheet";
import { DeleteConfirmationDialog } from "@/components/planning/delete-confirmation-dialog";
import { GanttShiftSection } from "@/components/planning/gantt-shift-section";
import { HistoricalModeStrip } from "@/components/planning/historical-mode-strip";
import { OperationalHero } from "@/components/planning/operational-hero";
import { PlanningDetailDialog } from "@/components/planning/planning-detail-dialog";
import { PlanningSheet } from "@/components/planning/planning-sheet";
import { PlanningStatusStrip } from "@/components/planning/planning-status-strip";
import {
  NETWORK_ERROR_MESSAGE,
  assertBrowserOnline,
  isBrowserOffline,
  isNetworkRequestError,
} from "@/lib/networkStatus";
import {
  readCatalogCache,
  readPendingPlanningMutations as readPendingPlanningMutationsCache,
  readPlanningCache,
  saveCatalogCache,
  savePendingPlanningMutations,
  savePlanningCache,
} from "@/lib/localOfflineStore";

type PlanningItem = {
  id: number;
  activity_group_id: string;
  description: string;
  item_date: string;
  start: string;
  end: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  notes?: string | null;
  sync_status?: "pending";
};

type PlanningItemApi = {
  id: number;
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  description: string;
  notes?: string | null;
};

type CatalogDetail = {
  id: number;
  label: string;
};

type CatalogType = {
  id: number;
  slug: string;
  label: string;
  details: CatalogDetail[];
};

type CatalogCategory = {
  slug: "actividad" | "interferencia";
  label: string;
  types: CatalogType[];
};

type CatalogLevel = {
  id: number;
  slug: string;
  label: string;
};

type PlanningCatalog = {
  categories: CatalogCategory[];
  levels: CatalogLevel[];
};

type PlanningItemForm = {
  activity_group_id: string;
  item_date: string;
  start_time: string;
  end_time: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  tracking_type: "programado" | "real";
  item_type: string;
  description: string;
  notes: string;
};

type PlanningItemMutationPayload = PlanningItemForm & {
  id?: number;
  client_mutation_id?: string;
};

type TypeAdminForm = {
  category: "actividad" | "interferencia";
  label: string;
};

type DetailAdminForm = {
  category: "actividad" | "interferencia";
  typeId: string;
  label: string;
};

type LevelAdminForm = {
  label: string;
};

type EditTypeForm = {
  id: number;
  category: "actividad" | "interferencia";
  label: string;
};

type EditDetailForm = {
  id: number;
  category: "actividad" | "interferencia";
  typeId: string;
  label: string;
};

type EditLevelForm = {
  id: number;
  label: string;
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

type PlanningGroup = {
  key: string;
  activity_group_id: string;
  item_date: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes?: string | null;
  programado: PlanningItem | null;
  realSegments: PlanningItem[];
};

type PendingPlanningMutation = {
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  createdAt: string;
  status?: "pending" | "conflict";
  lastError?: string;
  lastTriedAt?: string;
};

const AUTH_SYNC_ERROR_MESSAGE =
  "Los registros siguen guardados en este equipo. No pudimos sincronizarlos todavia; se reintentara automaticamente cuando la conexion este estable.";
const LEGACY_PLANNING_MUTATION_QUEUE_KEY = "mineria.pendingPlanningMutations.v1";
const PENDING_SYNC_RETRY_INTERVAL_MS = 30_000;

class PlanningMutationRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlanningMutationRequestError";
    this.status = status;
  }
}

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
    return NETWORK_ERROR_MESSAGE;
  }

  if (isInvalidSessionError(error)) {
    return AUTH_SYNC_ERROR_MESSAGE;
  }

  return error instanceof Error ? error.message || fallback : fallback;
}

async function readApiErrorMessage(response: Response, fallback: string) {
  const rawText = await response.text().catch(() => "");

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as { error?: unknown; message?: unknown };
      const parsedMessage = parsed.error ?? parsed.message;

      if (typeof parsedMessage === "string" && parsedMessage.trim()) {
        return parsedMessage.trim();
      }
    } catch {
      const plainText = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      if (/invalid session/i.test(plainText)) {
        return "Invalid session";
      }

      if (plainText) {
        return plainText.slice(0, 240);
      }
    }
  }

  return `${fallback} (${response.status} ${response.statusText || "HTTP error"})`;
}

function makePendingPlanningMutation(
  method: PendingPlanningMutation["method"],
  payload: Record<string, unknown>
): PendingPlanningMutation {
  const id = crypto.randomUUID();

  return {
    id,
    method,
    payload: withClientMutationId(payload, id),
    createdAt: new Date().toISOString(),
  };
}

function withClientMutationId(payload: Record<string, unknown>, fallbackId = crypto.randomUUID()) {
  if (payload.client_mutation_id) {
    return payload;
  }

  return {
    ...payload,
    client_mutation_id: fallbackId,
  };
}

function getPendingItemId(mutation: PendingPlanningMutation) {
  const explicitId = Number(mutation.payload.id);
  if (Number.isFinite(explicitId) && explicitId > 0) {
    return explicitId;
  }

  let hash = 0;
  for (const char of mutation.id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return -Math.max(1, hash);
}

function toOptimisticPlanningItem(mutation: PendingPlanningMutation): PlanningItem | null {
  if (mutation.status === "conflict") {
    return null;
  }

  if (mutation.method === "DELETE") {
    return null;
  }

  const payload = mutation.payload;
  const itemDate = String(payload.item_date ?? "").trim();
  const startTime = String(payload.start_time ?? "").trim();
  const endTime = String(payload.end_time ?? "").trim();
  const activityGroupId = String(payload.activity_group_id ?? "").trim();
  const category = String(payload.category ?? "").trim();
  const trackingType = String(payload.tracking_type ?? "").trim();

  if (
    !itemDate ||
    !startTime ||
    !endTime ||
    !activityGroupId ||
    !["actividad", "interferencia"].includes(category) ||
    !["programado", "real"].includes(trackingType)
  ) {
    return null;
  }

  return {
    id: getPendingItemId(mutation),
    activity_group_id: activityGroupId,
    item_date: itemDate,
    start: startTime.slice(0, 5),
    end: endTime.slice(0, 5),
    shift: String(payload.shift ?? ""),
    level: String(payload.level ?? ""),
    front: String(payload.front ?? ""),
    category: category as PlanningItem["category"],
    tracking_type: trackingType as PlanningItem["tracking_type"],
    item_type: String(payload.item_type ?? ""),
    description: String(payload.description ?? ""),
    notes: payload.notes ? String(payload.notes) : null,
    sync_status: "pending",
  };
}

function applyPendingPlanningMutations(items: PlanningItem[], mutations: PendingPlanningMutation[], date: string) {
  const visibleItems = [...items];

  for (const mutation of mutations) {
    const mutationId = Number(mutation.payload.id);

    if (mutation.method === "DELETE") {
      if (Number.isFinite(mutationId)) {
        const index = visibleItems.findIndex((item) => item.id === mutationId);
        if (index !== -1) {
          visibleItems.splice(index, 1);
        }
      }
      continue;
    }

    const optimisticItem = toOptimisticPlanningItem(mutation);
    if (!optimisticItem || optimisticItem.item_date !== date) {
      continue;
    }

    const existingIndex = visibleItems.findIndex((item) => item.id === optimisticItem.id);
    if (existingIndex === -1) {
      visibleItems.push(optimisticItem);
    } else {
      visibleItems[existingIndex] = optimisticItem;
    }
  }

  return visibleItems;
}

type GanttScale = {
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
  slotCount: number;
  endLabel: string;
  hourMarks: Array<{
    key: string;
    label: string;
    major: boolean;
  }>;
};

type ShiftKey = "Dia" | "Noche";

const SHIFT_CONFIG: Record<
  ShiftKey,
  {
    title: string;
    description: string;
    start: string;
    end: string;
    wrapsMidnight: boolean;
  }
> = {
  Dia: {
    title: "Turno Dia",
    description: "Ventana operacional de 08:00 a 20:00.",
    start: "08:00",
    end: "20:00",
    wrapsMidnight: false,
  },
  Noche: {
    title: "Turno Noche",
    description: "Ventana operacional de 20:00 a 08:00.",
    start: "20:00",
    end: "08:00",
    wrapsMidnight: true,
  },
};

function toMinutes(time: string) {
  const normalized = time.slice(0, 5);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatLocalDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function toTitleCaseDate(value: string) {
  return value.replace(/\p{L}+/gu, (word) => {
    const [firstLetter = "", ...rest] = Array.from(word);
    return `${firstLetter.toLocaleUpperCase("es-CL")}${rest.join("").toLocaleLowerCase("es-CL")}`;
  });
}

function formatDateTitle(value: string) {
  const formattedDate = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

  return toTitleCaseDate(formattedDate);
}

function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const days: Array<Date | null> = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function toDisplayCategory(category: PlanningItem["category"]) {
  return category === "interferencia" ? "Interferencia" : "Actividad";
}

function toTrackingTypeLabel(trackingType: PlanningItem["tracking_type"]) {
  return trackingType === "programado" ? "Programado" : "Real";
}

function buildEventTitle(item: {
  level?: string | null;
  front?: string | null;
  description?: string | null;
}) {
  return String(item.description ?? "").trim();
}

function buildGanttBarLabel(item: PlanningItem, layer: "programado" | "real") {
  if (layer === "real") {
    return String(item.description || item.item_type).trim();
  }

  return buildEventTitle(item);
}

function buildEventSubtitle(item: {
  level?: string | null;
  front?: string | null;
}) {
  return [item.level, item.front]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

function buildPlanningItemAriaLabel(item: PlanningItem, duration: string) {
  return [
    buildEventTitle(item),
    `Categoria ${toDisplayCategory(item.category)}`,
    toTrackingTypeLabel(item.tracking_type),
    `Frente ${item.front}, nivel ${item.level}`,
    `Turno ${item.shift}, ${formatDateLabel(item.item_date)}`,
    `Horario ${item.start} a ${item.end}, duracion ${duration}`,
  ].join(". ");
}

function formatDuration(start: string, end: string) {
  const startMinutes = toMinutes(start);
  let endMinutes = toMinutes(end);

  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60;
  }

  const diff = endMinutes - startMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (!hours) {
    return `${minutes}m`;
  }

  if (!minutes) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function buildGanttScale(start: string, end: string, wrapsMidnight: boolean): GanttScale {
  const startMinutes = toMinutes(start);
  const rawEndMinutes = toMinutes(end);
  const slotMinutes = 30;
  const baseEndMinutes = wrapsMidnight ? rawEndMinutes + 24 * 60 : rawEndMinutes;
  const spanMinutes = baseEndMinutes - startMinutes;
  const slotCount = Math.ceil(spanMinutes / slotMinutes);
  const endMinutes = baseEndMinutes;
  const hourMarks = Array.from({ length: slotCount }, (_, index) => {
    const minutes = startMinutes + index * slotMinutes;
    return {
      key: `gantt-${minutes}`,
      label: toTimeLabel(minutes),
      major: minutes % 60 === 0,
    };
  });

  return {
    startMinutes,
    endMinutes,
    slotMinutes,
    slotCount,
    endLabel: toTimeLabel(endMinutes),
    hourMarks,
  };
}
function positionMinutesInScale(time: string, scale: GanttScale) {
  let minutes = toMinutes(time);

  if (minutes < scale.startMinutes) {
    minutes += 24 * 60;
  }

  return minutes;
}

function getDefaultShiftTimes(shift: ShiftKey) {
  if (shift === "Noche") {
    return {
      start_time: SHIFT_CONFIG.Noche.start,
      end_time: "21:00",
    };
  }

  return {
    start_time: SHIFT_CONFIG.Dia.start,
    end_time: "09:00",
  };
}

function getDefaultRealEventTimes(group: PlanningGroup) {
  const lastRealSegment = group.realSegments[group.realSegments.length - 1] ?? null;

  if (!lastRealSegment) {
    return {
      start_time: group.programado?.start ?? getDefaultShiftTimes(group.shift as ShiftKey).start_time,
      end_time: group.programado?.end ?? getDefaultShiftTimes(group.shift as ShiftKey).end_time,
    };
  }

  const start_time = lastRealSegment.end;
  const plannedEnd = group.programado?.end ?? "";
  const shift = lastRealSegment.shift === "Noche" ? "Noche" : "Dia";
  const scale = buildGanttScale(SHIFT_CONFIG[shift].start, SHIFT_CONFIG[shift].end, SHIFT_CONFIG[shift].wrapsMidnight);
  const startOffset = positionMinutesInScale(start_time, scale);
  const plannedEndOffset = plannedEnd ? positionMinutesInScale(plannedEnd, scale) : startOffset;
  const end_time = plannedEnd && plannedEndOffset > startOffset ? plannedEnd : toTimeLabel(startOffset + 60);

  return {
    start_time,
    end_time,
  };
}


function toInitialPlanningForm(
  categories: CatalogCategory[],
  levels: CatalogLevel[],
  shift: ShiftKey = "Dia",
  itemDate = formatLocalDateIso()
): PlanningItemForm {
  const defaultCategory = categories[0] ?? {
    slug: "actividad" as const,
    label: "Actividad",
    types: [],
  };
  const defaultType = defaultCategory.types[0];
  const defaultDetail = defaultType?.details[0];
  const defaultLevel = levels[0];
  const defaultTimes = getDefaultShiftTimes(shift);

  return {
    activity_group_id: crypto.randomUUID(),
    item_date: itemDate,
    start_time: defaultTimes.start_time,
    end_time: defaultTimes.end_time,
    shift,
    level: defaultLevel?.label ?? "",
    front: "",
    category: defaultCategory.slug,
    tracking_type: "programado",
    item_type: defaultType?.label ?? "",
    description: defaultDetail?.label ?? "",
    notes: "",
  };
}

function syncPlanningForm(form: PlanningItemForm, categories: CatalogCategory[], levels: CatalogLevel[]) {
  const fallback = toInitialPlanningForm(categories, levels);
  const normalizedCategory =
    form.tracking_type === "programado" ? ("actividad" as const) : form.category;
  const selectedCategory =
    categories.find((category) => category.slug === normalizedCategory) ??
    categories.find((category) => category.slug === fallback.category);

  if (!selectedCategory) {
    return fallback;
  }

  const selectedType =
    selectedCategory.types.find((type) => type.label === form.item_type) ?? selectedCategory.types[0];
  const selectedDetail =
    selectedType?.details.find((detail) => detail.label === form.description) ?? selectedType?.details[0];

  return {
    ...form,
    category: selectedCategory.slug,
    level: levels.some((level) => level.label === form.level) ? form.level : fallback.level,
    item_type: selectedType?.label ?? "",
    description: selectedDetail?.label ?? "",
  };
}

function groupPlanningItems(items: PlanningItem[]) {
  const groups = new Map<string, PlanningGroup>();

  function syncGroupSummary(group: PlanningGroup) {
    const displayItem = group.programado ?? group.realSegments[0] ?? null;

    if (!displayItem) {
      return;
    }

    group.item_date = displayItem.item_date;
    group.shift = displayItem.shift;
    group.level = displayItem.level;
    group.front = displayItem.front;
    group.category = displayItem.category;
    group.item_type = displayItem.item_type;
    group.description = displayItem.description;
    group.notes = group.programado?.notes ?? group.realSegments[0]?.notes ?? null;
  }

  for (const item of items) {
    const existingGroup = groups.get(item.activity_group_id);

    if (existingGroup) {
      if (item.tracking_type === "programado") {
        existingGroup.programado = item;
      } else {
        existingGroup.realSegments.push(item);
        existingGroup.realSegments.sort((left, right) =>
          `${left.item_date}-${left.start}`.localeCompare(`${right.item_date}-${right.start}`)
        );
      }
      syncGroupSummary(existingGroup);
      continue;
    }

    const nextGroup: PlanningGroup = {
      key: item.activity_group_id,
      activity_group_id: item.activity_group_id,
      item_date: item.item_date,
      shift: item.shift,
      level: item.level,
      front: item.front,
      category: item.category,
      item_type: item.item_type,
      description: item.description,
      notes: item.notes ?? null,
      programado: item.tracking_type === "programado" ? item : null,
      realSegments: item.tracking_type === "real" ? [item] : [],
    };
    syncGroupSummary(nextGroup);
    groups.set(item.activity_group_id, nextGroup);
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftItem = left.programado ?? left.realSegments[0] ?? null;
    const rightItem = right.programado ?? right.realSegments[0] ?? null;

    if (!leftItem || !rightItem) {
      return 0;
    }

    return `${leftItem.item_date}-${leftItem.start}`.localeCompare(`${rightItem.item_date}-${rightItem.start}`);
  });
}

function findSegmentContinuation(
  item: PlanningItem | null,
  groups: PlanningGroup[]
): { previous: PlanningItem | null; next: PlanningItem | null } | null {
  if (!item || item.tracking_type !== "real") {
    return null;
  }

  const group = groups.find((entry) => entry.activity_group_id === item.activity_group_id);
  if (!group || group.realSegments.length <= 1) {
    return null;
  }

  const index = group.realSegments.findIndex((segment) => segment.id === item.id);
  if (index === -1) {
    return null;
  }

  return {
    previous: group.realSegments[index - 1] ?? null,
    next: group.realSegments[index + 1] ?? null,
  };
}

function syncDetailAdminForm(form: DetailAdminForm, categories: CatalogCategory[]) {
  const selectedCategory =
    categories.find((category) => category.slug === form.category) ?? categories[0] ?? null;

  if (!selectedCategory) {
    return { category: "actividad" as const, typeId: "", label: form.label };
  }

  const selectedType =
    selectedCategory.types.find((type) => String(type.id) === form.typeId) ?? selectedCategory.types[0] ?? null;

  return {
    ...form,
    category: selectedCategory.slug,
    typeId: selectedType ? String(selectedType.id) : "",
  };
}

async function fetchPlanningItems(date: string) {
  assertBrowserOnline();

  const response = await fetch(`/api/planning-items?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo cargar la planificacion."));
  }

  return Array.isArray(json.items)
    ? json.items.map((item: PlanningItemApi) => ({
        id: item.id,
        activity_group_id: item.activity_group_id,
        item_date: item.item_date,
        start: item.start_time.slice(0, 5),
        end: item.end_time.slice(0, 5),
        shift: item.shift,
        level: item.level,
        front: item.front,
        category: item.category,
        tracking_type: item.tracking_type,
        item_type: item.item_type,
        description: item.description,
        notes: item.notes ?? null,
      }))
    : [];
}

async function fetchPlanningCatalog(): Promise<PlanningCatalog> {
  assertBrowserOnline();

  const response = await fetch("/api/planning-catalog", { cache: "no-store" });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(String(json.error ?? "No se pudo cargar el catalogo."));
  }

  return {
    categories: Array.isArray(json.categories) ? (json.categories as CatalogCategory[]) : [],
    levels: Array.isArray(json.levels) ? (json.levels as CatalogLevel[]) : [],
  };
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
  const pendingRealtimeRefreshRef = useRef(false);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
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
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogFormError, setCatalogFormError] = useState("");
  const [formState, setFormState] = useState<PlanningItemForm>(toInitialPlanningForm([], [], "Dia", formatLocalDateIso()));
  const [typeForm, setTypeForm] = useState<TypeAdminForm>({
    category: "actividad",
    label: "",
  });
  const [levelForm, setLevelForm] = useState<LevelAdminForm>({
    label: "",
  });
  const [detailForm, setDetailForm] = useState<DetailAdminForm>({
    category: "actividad",
    typeId: "",
    label: "",
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

  const [editingType, setEditingType] = useState<EditTypeForm | null>(null);
  const [editingLevel, setEditingLevel] = useState<EditLevelForm | null>(null);
  const [editingDetail, setEditingDetail] = useState<EditDetailForm | null>(null);

  const refreshPlanningItems = useCallback(async () => {
    const nextItems = await fetchPlanningItems(selectedDate);
    setPlanningItems(nextItems);
    void savePlanningCache(selectedDate, nextItems);
  }, [selectedDate]);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        setCatalogLoading(true);
        setCatalogError("");
        const nextCatalog = await fetchPlanningCatalog();

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
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPlanningItems() {
      try {
        setItemsLoading(true);
        setItemsError("");
        const nextItems = await fetchPlanningItems(selectedDate);

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
  }, [refreshPlanningItems, selectedDate]);

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
      const cachedMutations = await readPendingPlanningMutationsCache<PendingPlanningMutation[]>().catch(() => null);

      if (cachedMutations?.value && Array.isArray(cachedMutations.value)) {
        if (active) {
          setPendingPlanningMutations(cachedMutations.value);
        }
        return;
      }

      if (typeof window === "undefined") {
        return;
      }

      try {
        const parsed = JSON.parse(window.localStorage.getItem(LEGACY_PLANNING_MUTATION_QUEUE_KEY) ?? "[]");
        const legacyMutations = Array.isArray(parsed) ? (parsed as PendingPlanningMutation[]) : [];

        if (!legacyMutations.length) {
          return;
        }

        await savePendingPlanningMutations(legacyMutations);
        window.localStorage.removeItem(LEGACY_PLANNING_MUTATION_QUEUE_KEY);

        if (active) {
          setPendingPlanningMutations(legacyMutations);
        }
      } catch {
        if (active) {
          setPendingPlanningMutations([]);
        }
      }
    }

    void loadPendingMutations();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void savePendingPlanningMutations(pendingPlanningMutations);
  }, [pendingPlanningMutations]);

  useEffect(() => {
    function syncWhenOnline() {
      syncPendingPlanningMutationsRef.current();
    }

    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("focus", syncWhenOnline);
    const retryInterval = window.setInterval(syncWhenOnline, PENDING_SYNC_RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", syncWhenOnline);
      window.removeEventListener("focus", syncWhenOnline);
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

    window.addEventListener("online", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);

    return () => {
      window.removeEventListener("online", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
    };
  }, [refreshPlanningItems]);

  useEffect(() => {
    const realtimeClient = supabaseAuth;

    if (!session?.access_token || isBrowserOffline()) {
      return;
    }

    realtimeClient.realtime.setAuth(session.access_token);

    function scheduleRealtimeRefresh() {
      if (document.visibilityState === "hidden" || isBrowserOffline()) {
        pendingRealtimeRefreshRef.current = true;
        return;
      }

      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        if (isBrowserOffline()) {
          return;
        }
        void refreshPlanningItems().catch((error: unknown) => {
          setItemsError(getRequestErrorMessage(error, "No se pudo actualizar la planificacion."));
        });
      }, 350);
    }

    function refreshDeferredRealtimeChanges() {
      if (!pendingRealtimeRefreshRef.current || document.visibilityState === "hidden") {
        return;
      }

      pendingRealtimeRefreshRef.current = false;
      scheduleRealtimeRefresh();
    }

    const channel = realtimeClient
      .channel(`planning-items-${selectedDate}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "planning_items",
          filter: `item_date=eq.${selectedDate}`,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "planning_items",
          filter: `item_date=eq.${selectedDate}`,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "planning_items",
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_execution_segments",
          filter: `item_date=eq.${selectedDate}`,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "activity_execution_segments",
          filter: `item_date=eq.${selectedDate}`,
        },
        scheduleRealtimeRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "activity_execution_segments",
        },
        scheduleRealtimeRefresh
      )
      .subscribe();

    document.addEventListener("visibilitychange", refreshDeferredRealtimeChanges);
    window.addEventListener("focus", refreshDeferredRealtimeChanges);

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      document.removeEventListener("visibilitychange", refreshDeferredRealtimeChanges);
      window.removeEventListener("focus", refreshDeferredRealtimeChanges);
      void realtimeClient.removeChannel(channel);
    };
  }, [refreshPlanningItems, selectedDate, session?.access_token]);

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
    assertBrowserOnline();

    if (!session?.access_token) {
      throw new Error("Necesitas iniciar sesion para registrar actividades.");
    }

    const response = await fetch("/api/planning-items", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new PlanningMutationRequestError(
        await readApiErrorMessage(response, "No se pudo sincronizar el registro."),
        response.status
      );
    }

    return response.json().catch(() => ({}));
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
    const retryableMutations = pendingPlanningMutations.filter((mutation) => mutation.status !== "conflict");

    if (!session?.access_token || queueSyncing || !retryableMutations.length) {
      return;
    }

    if (isBrowserOffline()) {
      return;
    }

    setQueueSyncing(true);

    const nextQueue: PendingPlanningMutation[] = [];
    let syncedCount = 0;
    let stoppedForRetryableError = false;
    let foundConflict = false;

    for (let index = 0; index < pendingPlanningMutations.length; index += 1) {
      const mutation = pendingPlanningMutations[index];

      if (mutation.status === "conflict") {
        nextQueue.push(mutation);
        continue;
      }

      try {
        await sendPlanningMutation(mutation.method, mutation.payload);
        syncedCount += 1;
      } catch (error: unknown) {
        const message = getRequestErrorMessage(error, "No se pudo sincronizar un registro pendiente.");

        if (isRetryablePlanningSyncError(error)) {
          nextQueue.push(mutation);
          nextQueue.push(...pendingPlanningMutations.slice(index + 1));
          stoppedForRetryableError = true;

          if (!isNetworkRequestError(error)) {
            setItemsError(message);
          }

          break;
        }

        nextQueue.push({
          ...mutation,
          status: "conflict",
          lastError: message,
          lastTriedAt: new Date().toISOString(),
        });
        foundConflict = true;
        setItemsError(
          "Un registro pendiente no pudo sincronizarse porque entra en conflicto con la planificacion actual. Revisa el detalle y descartalo o vuelve a crearlo con otro horario."
        );
      }
    }

    if (!stoppedForRetryableError) {
      const processedIds = new Set(nextQueue.map((mutation) => mutation.id));
      for (const mutation of pendingPlanningMutations) {
        if (mutation.status === "conflict" && !processedIds.has(mutation.id)) {
          nextQueue.push(mutation);
        }
      }
    }

    setPendingPlanningMutations(nextQueue);
    setQueueSyncing(false);

    if (syncedCount > 0 || foundConflict) {
      await refreshPlanningItems().then(() => {
        if (nextQueue.length === 0) {
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
    setPendingPlanningMutations((current) => current.filter((mutation) => mutation.status !== "conflict"));
  }

  async function refreshCatalog() {
    const nextCatalog = await fetchPlanningCatalog();
    setCatalog(nextCatalog.categories);
    setLevels(nextCatalog.levels);
    void saveCatalogCache(nextCatalog);
    setFormState((current) => syncPlanningForm(current, nextCatalog.categories, nextCatalog.levels));
    setDetailForm((current) => syncDetailAdminForm(current, nextCatalog.categories));
    setEditingDetail((current) =>
      current ? { ...current, ...syncDetailAdminForm(current, nextCatalog.categories) } : null
    );
    setEditingLevel((current) =>
      current && nextCatalog.levels.some((level) => level.id === current.id) ? current : null
    );
  }

  async function mutateCatalog(method: "POST" | "PATCH" | "DELETE", payload: Record<string, unknown>) {
    assertBrowserOnline();

    if (!session?.access_token) {
      throw new Error("Necesitas iniciar sesion para administrar el catalogo.");
    }

    const response = await fetch("/api/planning-catalog", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(String(json.error ?? "No se pudo actualizar el catalogo."));
    }

    await refreshCatalog();
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

  async function handleCreateType(event: React.FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!session?.access_token) {
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

  async function handleCreateDetail(event: React.FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!session?.access_token) {
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

  async function handleCreateLevel(event: React.FormEvent) {
    event.preventDefault();
    setCatalogFormError("");

    if (!session?.access_token) {
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

  async function handleUpdateType(event: React.FormEvent) {
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

  async function handleUpdateDetail(event: React.FormEvent) {
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

  async function handleUpdateLevel(event: React.FormEvent) {
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
  const retryablePlanningMutations = pendingPlanningMutations.filter(
    (mutation) => mutation.status !== "conflict"
  );
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
