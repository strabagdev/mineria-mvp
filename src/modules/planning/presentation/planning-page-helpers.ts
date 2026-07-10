import type {
  PlanningCategoryDto,
  PlanningShiftDto,
  PlanningTrackingTypeDto,
} from "../contracts/planning-items";
import type {
  OperationalHeaderFieldDto,
  OperationalHeaderResponseDto,
} from "@/modules/operational-header/contracts/operational-header";
import type { PlanningItem } from "./planning-page-models";

export type GanttScale = {
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

export type ShiftKey = PlanningShiftDto;

export type GanttCurrentTimeMarker = {
  offsetPercent: number;
  label: string;
  timeLabel: string;
};

export type OperationalView = {
  selectedDate: string;
  activeShift: ShiftKey;
};

export type GanttGroupingField = Pick<
  OperationalHeaderFieldDto,
  "id" | "slug" | "label" | "input_type" | "sort_order" | "options"
>;

export type GanttGroupingPathEntry = {
  field_id: number;
  slug: string;
  label: string;
  value: string;
  option_id?: number | null;
  option_sort_order?: number | null;
  input_type: OperationalHeaderFieldDto["input_type"];
  field_sort_order: number;
};

type PlanningTimelineItem = {
  item_date: string;
  start: string;
  end: string;
  shift: string;
  category: PlanningCategoryDto;
  tracking_type: PlanningTrackingTypeDto;
  item_type: string;
  description: string;
};

type PlanningRealEventGroup = {
  shift: string;
  programado: Pick<PlanningTimelineItem, "start" | "end"> | null;
  realSegments: Array<Pick<PlanningTimelineItem, "end" | "shift">>;
};

const EMPTY_GANTT_GROUP_VALUE = "Sin valor";

export const SHIFT_CONFIG: Record<
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

type ShiftWindowConfig = Record<ShiftKey, { start: string; end: string; wrapsMidnight: boolean }>;

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

function normalizeGroupingValue(value: string) {
  return value.trim().toLocaleLowerCase("es-CL");
}

function findOperationalHeaderValue(
  item: Pick<PlanningItem, "operational_header_values">,
  field: GanttGroupingField
) {
  const values = item.operational_header_values;

  if (!values) {
    return null;
  }

  if (Array.isArray(values)) {
    return values.find((value) => value.field_id === field.id) ?? null;
  }

  const record = values as Record<string, { value?: string; option_id?: number | null } | undefined>;
  return record[field.slug] ?? record[String(field.id)] ?? null;
}

function findGroupingOption(field: GanttGroupingField, input: { value: string; optionId?: number | null }) {
  if (input.optionId) {
    const optionById = field.options.find((option) => option.id === input.optionId);
    if (optionById) {
      return optionById;
    }
  }

  const normalizedValue = normalizeGroupingValue(input.value);

  if (!normalizedValue) {
    return null;
  }

  return field.options.find((option) =>
    normalizeGroupingValue(option.value) === normalizedValue ||
    normalizeGroupingValue(option.label) === normalizedValue
  ) ?? null;
}

export function getGanttGroupingFields(config?: OperationalHeaderResponseDto | null): GanttGroupingField[] {
  return (config?.fields ?? [])
    .filter((field) => field.active && field.groupable && field.visible_in_gantt)
    .sort((left, right) => left.sort_order - right.sort_order || left.label.localeCompare(right.label));
}

export function resolveGanttGroupingPath(
  item: Pick<PlanningItem, "operational_header_values">,
  fields: GanttGroupingField[]
): GanttGroupingPathEntry[] {
  return fields.map((field) => {
    const headerValue = findOperationalHeaderValue(item, field);
    const value = String(headerValue?.value ?? "").trim();
    const option = field.input_type === "select"
      ? findGroupingOption(field, { value, optionId: headerValue?.option_id })
      : null;
    const displayValue = value || EMPTY_GANTT_GROUP_VALUE;

    return {
      field_id: field.id,
      slug: field.slug,
      label: field.label,
      value: option?.label || displayValue,
      option_id: headerValue?.option_id ?? option?.id ?? null,
      option_sort_order: option?.sort_order ?? null,
      input_type: field.input_type,
      field_sort_order: field.sort_order,
    };
  });
}

export function compareGanttGroupingPaths(
  left: GanttGroupingPathEntry[],
  right: GanttGroupingPathEntry[]
) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftEntry = left[index];
    const rightEntry = right[index];

    if (!leftEntry && !rightEntry) {
      continue;
    }

    if (!leftEntry) {
      return -1;
    }

    if (!rightEntry) {
      return 1;
    }

    const leftIsEmpty = leftEntry.value === EMPTY_GANTT_GROUP_VALUE;
    const rightIsEmpty = rightEntry.value === EMPTY_GANTT_GROUP_VALUE;

    if (leftIsEmpty !== rightIsEmpty) {
      return leftIsEmpty ? 1 : -1;
    }

    if (
      leftEntry.input_type === "select" &&
      rightEntry.input_type === "select" &&
      leftEntry.option_sort_order !== null &&
      leftEntry.option_sort_order !== undefined &&
      rightEntry.option_sort_order !== null &&
      rightEntry.option_sort_order !== undefined &&
      leftEntry.option_sort_order !== rightEntry.option_sort_order
    ) {
      return leftEntry.option_sort_order - rightEntry.option_sort_order;
    }

    const valueDelta = normalizeGroupingValue(leftEntry.value).localeCompare(
      normalizeGroupingValue(rightEntry.value),
      "es-CL"
    );

    if (valueDelta !== 0) {
      return valueDelta;
    }
  }

  return 0;
}

export function formatGanttGroupingTitle(path: GanttGroupingPathEntry[]) {
  return path.map((entry) => entry.value || EMPTY_GANTT_GROUP_VALUE).join(" - ") || EMPTY_GANTT_GROUP_VALUE;
}

export function formatLocalDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function formatDateLabel(value: string) {
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

export function formatDateTitle(value: string) {
  const formattedDate = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

  return toTitleCaseDate(formattedDate);
}

export function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getCalendarDays(monthDate: Date) {
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

export function isSameCalendarMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

export function toDisplayCategory(category: PlanningCategoryDto) {
  return category === "interferencia" ? "Interferencia" : "Actividad";
}

export function toTrackingTypeLabel(trackingType: PlanningTrackingTypeDto) {
  return trackingType === "programado" ? "Programado" : "Real";
}

export function buildEventTitle(item: { description?: string | null }) {
  return String(item.description ?? "").trim();
}

export function buildGanttBarLabel(item: PlanningTimelineItem, layer: PlanningTrackingTypeDto) {
  if (layer === "real") {
    return String(item.description || item.item_type).trim();
  }

  return buildEventTitle(item);
}

export function buildEventSubtitle() {
  return "";
}

export function buildPlanningItemAriaLabel(item: PlanningTimelineItem, duration: string) {
  return [
    buildEventTitle(item),
    `Categoria ${toDisplayCategory(item.category)}`,
    toTrackingTypeLabel(item.tracking_type),
    `Turno ${item.shift}, ${formatDateLabel(item.item_date)}`,
    `Horario ${item.start} a ${item.end}, duracion ${duration}`,
  ].join(". ");
}

export function formatDuration(start: string, end: string) {
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

export function buildGanttScale(start: string, end: string, wrapsMidnight: boolean): GanttScale {
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

export function positionMinutesInScale(time: string, scale: GanttScale) {
  let minutes = toMinutes(time);

  if (minutes < scale.startMinutes) {
    minutes += 24 * 60;
  }

  return minutes;
}

function isMinuteInsideShift(minutes: number, shift: ShiftWindowConfig[ShiftKey]) {
  const start = toMinutes(shift.start);
  const end = toMinutes(shift.end);

  if (shift.wrapsMidnight) {
    return minutes >= start || minutes < end;
  }

  return minutes >= start && minutes < end;
}

export function getShiftForCurrentTime(
  now = new Date(),
  shiftConfig: ShiftWindowConfig = SHIFT_CONFIG,
  fallback: ShiftKey = "Dia"
): ShiftKey {
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (isMinuteInsideShift(minutes, shiftConfig.Dia)) {
    return "Dia";
  }

  if (isMinuteInsideShift(minutes, shiftConfig.Noche)) {
    return "Noche";
  }

  return fallback;
}

export function getCurrentOperationalDate(
  now = new Date(),
  shiftConfig: ShiftWindowConfig = SHIFT_CONFIG
) {
  const activeShift = getShiftForCurrentTime(now, shiftConfig);
  const activeShiftConfig = shiftConfig[activeShift];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const shiftEndMinutes = toMinutes(activeShiftConfig.end);

  if (activeShiftConfig.wrapsMidnight && currentMinutes < shiftEndMinutes) {
    return formatLocalDateIso(addLocalDays(now, -1));
  }

  return formatLocalDateIso(now);
}

export function getInitialOperationalView(
  now = new Date(),
  shiftConfig: ShiftWindowConfig = SHIFT_CONFIG
): OperationalView {
  return {
    selectedDate: getCurrentOperationalDate(now, shiftConfig),
    activeShift: getShiftForCurrentTime(now, shiftConfig),
  };
}

export function buildGanttCurrentTimeMarker(
  selectedDate: string,
  scale: GanttScale,
  now = new Date()
): GanttCurrentTimeMarker | null {
  if (selectedDate !== getCurrentOperationalDate(now)) {
    return null;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let positionedMinutes = currentMinutes;

  if (positionedMinutes < scale.startMinutes) {
    positionedMinutes += 24 * 60;
  }

  if (positionedMinutes < scale.startMinutes || positionedMinutes >= scale.endMinutes) {
    return null;
  }

  const scaleSpan = scale.endMinutes - scale.startMinutes;
  const offsetPercent = ((positionedMinutes - scale.startMinutes) / scaleSpan) * 100;

  return {
    offsetPercent,
    label: "Ahora",
    timeLabel: toTimeLabel(currentMinutes),
  };
}

export function getDefaultShiftTimes(shift: ShiftKey) {
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

export function getDefaultRealEventTimes(group: PlanningRealEventGroup) {
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
