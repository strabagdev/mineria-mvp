import type {
  PlanningCategoryDto,
  PlanningShiftDto,
  PlanningTrackingTypeDto,
} from "../contracts/planning-items";

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

type PlanningTimelineItem = {
  item_date: string;
  start: string;
  end: string;
  shift: string;
  level: string;
  front: string;
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

export function formatLocalDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function buildEventTitle(item: {
  level?: string | null;
  front?: string | null;
  description?: string | null;
}) {
  return String(item.description ?? "").trim();
}

export function buildGanttBarLabel(item: PlanningTimelineItem, layer: PlanningTrackingTypeDto) {
  if (layer === "real") {
    return String(item.description || item.item_type).trim();
  }

  return buildEventTitle(item);
}

export function buildEventSubtitle(item: {
  level?: string | null;
  front?: string | null;
}) {
  return [item.level, item.front]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function buildPlanningItemAriaLabel(item: PlanningTimelineItem, duration: string) {
  return [
    buildEventTitle(item),
    `Categoria ${toDisplayCategory(item.category)}`,
    toTrackingTypeLabel(item.tracking_type),
    `Frente ${item.front}, nivel ${item.level}`,
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

export function buildGanttCurrentTimeMarker(
  selectedDate: string,
  scale: GanttScale,
  now = new Date()
): GanttCurrentTimeMarker | null {
  if (selectedDate !== formatLocalDateIso(now)) {
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
