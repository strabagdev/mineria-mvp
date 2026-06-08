import { describe, expect, it } from "vitest";
import {
  buildEventSubtitle,
  buildEventTitle,
  buildGanttBarLabel,
  buildGanttCurrentTimeMarker,
  buildGanttScale,
  buildPlanningItemAriaLabel,
  formatDuration,
  formatLocalDateIso,
  getCalendarDays,
  getCurrentOperationalDate,
  getDefaultRealEventTimes,
  getDefaultShiftTimes,
  getInitialOperationalView,
  getShiftForCurrentTime,
  positionMinutesInScale,
  SHIFT_CONFIG,
} from "./planning-page-helpers";
import type { PlanningGroup, PlanningItem } from "./planning-page-models";

function planningItem(overrides: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id: 1,
    activity_group_id: "group-1",
    description: "Extraccion",
    item_date: "2026-05-06",
    start: "10:30",
    end: "15:00",
    shift: "Dia",
    level: "NTI",
    front: "GT1 N XC 2AS",
    category: "actividad",
    tracking_type: "programado",
    item_type: "unitaria",
    notes: null,
    ...overrides,
  };
}

describe("planning page helpers", () => {
  it("formats local dates without UTC shifting", () => {
    expect(formatLocalDateIso(new Date(2026, 4, 6, 23, 30))).toBe("2026-05-06");
  });

  it("formats durations across regular and overnight ranges", () => {
    expect(formatDuration("10:30", "15:00")).toBe("4h 30m");
    expect(formatDuration("20:00", "01:30")).toBe("5h 30m");
    expect(formatDuration("08:00", "08:45")).toBe("45m");
    expect(formatDuration("08:00", "10:00")).toBe("2h");
  });

  it("builds day and night Gantt scales with 30 minute slots", () => {
    const dayScale = buildGanttScale(
      SHIFT_CONFIG.Dia.start,
      SHIFT_CONFIG.Dia.end,
      SHIFT_CONFIG.Dia.wrapsMidnight
    );
    const nightScale = buildGanttScale(
      SHIFT_CONFIG.Noche.start,
      SHIFT_CONFIG.Noche.end,
      SHIFT_CONFIG.Noche.wrapsMidnight
    );

    expect(dayScale).toMatchObject({
      startMinutes: 480,
      endMinutes: 1200,
      slotMinutes: 30,
      slotCount: 24,
      endLabel: "20:00",
    });
    expect(nightScale).toMatchObject({
      startMinutes: 1200,
      endMinutes: 1920,
      slotMinutes: 30,
      slotCount: 24,
      endLabel: "08:00",
    });
    expect(nightScale.hourMarks[0]).toEqual({
      key: "gantt-1200",
      label: "20:00",
      major: true,
    });
  });

  it("positions overnight times inside a wrapping scale", () => {
    const nightScale = buildGanttScale("20:00", "08:00", true);

    expect(positionMinutesInScale("21:00", nightScale)).toBe(1260);
    expect(positionMinutesInScale("01:00", nightScale)).toBe(1500);
  });

  it("selects the operational shift from the current time", () => {
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 9, 0))).toBe("Dia");
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 13, 0))).toBe("Dia");
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 19, 59))).toBe("Dia");
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 20, 0))).toBe("Noche");
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 1, 0))).toBe("Noche");
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 7, 59))).toBe("Noche");
    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 8, 0))).toBe("Dia");
  });

  it("selects the operational date from the shift start date", () => {
    expect(getCurrentOperationalDate(new Date(2026, 5, 9, 0, 0))).toBe("2026-06-08");
    expect(getCurrentOperationalDate(new Date(2026, 5, 9, 7, 59))).toBe("2026-06-08");
    expect(getCurrentOperationalDate(new Date(2026, 5, 9, 8, 0))).toBe("2026-06-09");
    expect(getCurrentOperationalDate(new Date(2026, 5, 9, 19, 59))).toBe("2026-06-09");
    expect(getCurrentOperationalDate(new Date(2026, 5, 9, 20, 0))).toBe("2026-06-09");
    expect(getCurrentOperationalDate(new Date(2026, 5, 9, 23, 59))).toBe("2026-06-09");
  });

  it("builds the initial operational view from the current shift window", () => {
    expect(getInitialOperationalView(new Date(2026, 5, 9, 1, 0))).toEqual({
      selectedDate: "2026-06-08",
      activeShift: "Noche",
    });
    expect(getInitialOperationalView(new Date(2026, 5, 9, 8, 0))).toEqual({
      selectedDate: "2026-06-09",
      activeShift: "Dia",
    });
    expect(getInitialOperationalView(new Date(2026, 5, 9, 20, 0))).toEqual({
      selectedDate: "2026-06-09",
      activeShift: "Noche",
    });
  });

  it("uses the fallback when no shift contains the current time", () => {
    const shiftConfig = {
      Dia: { start: "09:00", end: "17:00", wrapsMidnight: false },
      Noche: { start: "21:00", end: "23:00", wrapsMidnight: false },
    };

    expect(getShiftForCurrentTime(new Date(2026, 4, 6, 18, 0), shiftConfig, "Noche")).toBe("Noche");
  });

  it("builds the current time marker only for the visible current shift", () => {
    const dayScale = buildGanttScale("08:00", "20:00", false);
    const marker = buildGanttCurrentTimeMarker(
      "2026-05-06",
      dayScale,
      new Date(2026, 4, 6, 14, 0)
    );

    expect(marker).toEqual({
      offsetPercent: 50,
      label: "Ahora",
      timeLabel: "14:00",
    });
    expect(buildGanttCurrentTimeMarker("2026-05-05", dayScale, new Date(2026, 4, 6, 14, 0))).toBeNull();
    expect(buildGanttCurrentTimeMarker("2026-05-06", dayScale, new Date(2026, 4, 6, 21, 0))).toBeNull();
    expect(buildGanttCurrentTimeMarker("2026-05-06", dayScale, new Date(2026, 4, 6, 20, 0))).toBeNull();
  });

  it("positions the current time marker inside an overnight shift", () => {
    const nightScale = buildGanttScale("20:00", "08:00", true);

    expect(buildGanttCurrentTimeMarker("2026-05-06", nightScale, new Date(2026, 4, 6, 23, 0))).toMatchObject({
      offsetPercent: 25,
      timeLabel: "23:00",
    });
    expect(buildGanttCurrentTimeMarker("2026-05-05", nightScale, new Date(2026, 4, 6, 2, 0))).toMatchObject({
      offsetPercent: 50,
      timeLabel: "02:00",
    });
    expect(buildGanttCurrentTimeMarker("2026-05-06", nightScale, new Date(2026, 4, 6, 2, 0))).toBeNull();
    expect(buildGanttCurrentTimeMarker("2026-05-06", nightScale, new Date(2026, 4, 6, 10, 0))).toBeNull();
  });

  it("returns default shift times used by new planned and real events", () => {
    expect(getDefaultShiftTimes("Dia")).toEqual({
      start_time: "08:00",
      end_time: "09:00",
    });
    expect(getDefaultShiftTimes("Noche")).toEqual({
      start_time: "20:00",
      end_time: "21:00",
    });
  });

  it("continues a real event from the last real segment", () => {
    const group: PlanningGroup = {
      key: "group-1",
      activity_group_id: "group-1",
      item_date: "2026-05-06",
      shift: "Dia",
      level: "NTI",
      front: "GT1",
      category: "actividad",
      item_type: "unitaria",
      description: "Extraccion",
      notes: null,
      programado: planningItem({ start: "08:00", end: "12:00" }),
      realSegments: [
        planningItem({ id: 2, tracking_type: "real", start: "08:00", end: "09:00" }),
        planningItem({ id: 3, tracking_type: "real", start: "09:00", end: "10:00" }),
      ],
    };

    expect(getDefaultRealEventTimes(group)).toEqual({
      start_time: "10:00",
      end_time: "12:00",
    });
  });

  it("builds event labels from item data", () => {
    const item = planningItem({
      description: "MX",
      item_type: "mantencion",
      tracking_type: "real",
    });

    expect(buildEventTitle(item)).toBe("MX");
    expect(buildGanttBarLabel(item, "real")).toBe("MX");
    expect(buildEventSubtitle(item)).toBe("NTI · GT1 N XC 2AS");
    expect(buildPlanningItemAriaLabel(item, "4h 30m")).toContain(
      "Categoria Actividad. Real. Frente GT1 N XC 2AS, nivel NTI"
    );
  });

  it("builds calendar days with leading blanks and complete weeks", () => {
    const days = getCalendarDays(new Date(2026, 4, 1));

    expect(days.length % 7).toBe(0);
    expect(days.slice(0, 4)).toEqual([null, null, null, null]);
    expect(days[4]?.getDate()).toBe(1);
    expect(days.filter(Boolean)).toHaveLength(31);
  });
});
