import { describe, expect, it } from "vitest";
import {
  buildEventSubtitle,
  buildEventTitle,
  compareGanttGroupingPaths,
  formatGanttGroupingTitle,
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
  getGanttGroupingFields,
  getInitialOperationalView,
  getShiftForCurrentTime,
  positionMinutesInScale,
  resolveGanttGroupingPath,
  SHIFT_CONFIG,
} from "./planning-page-helpers";
import type { PlanningGroup, PlanningItem } from "./planning-page-models";
import type { OperationalHeaderFieldDto, OperationalHeaderResponseDto } from "@/modules/operational-header/contracts/operational-header";

function planningItem(overrides: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id: 1,
    activity_group_id: "group-1",
    description: "Extraccion",
    item_date: "2026-05-06",
    start: "10:30",
    end: "15:00",
    shift: "Dia",
    category: "actividad",
    tracking_type: "programado",
    item_type: "unitaria",
    notes: null,
    ...overrides,
  };
}

function operationalHeaderField(input: Partial<OperationalHeaderFieldDto> & Pick<OperationalHeaderFieldDto, "id" | "slug" | "label" | "input_type">): OperationalHeaderFieldDto {
  return {
    required: false,
    active: true,
    sort_order: 100,
    groupable: true,
    filterable: true,
    visible_in_gantt: true,
    exportable: true,
    options: [],
    ...input,
  };
}

function operationalHeaderConfig(fields: OperationalHeaderFieldDto[]): OperationalHeaderResponseDto {
  return { fields, dependencies: [] };
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
    expect(buildEventSubtitle()).toBe("");
    expect(buildPlanningItemAriaLabel(item, "4h 30m")).toContain(
      "Categoria Actividad. Real. Turno Dia"
    );
  });

  it("does not create legacy level/front grouping fields when there is no operational header config", () => {
    const fields = getGanttGroupingFields(null);
    const path = resolveGanttGroupingPath(planningItem(), fields);

    expect(fields).toEqual([]);
    expect(path).toEqual([]);
    expect(formatGanttGroupingTitle(path)).toBe("Sin valor");
  });

  it("uses groupable visible operational header fields ordered by sort_order and label", () => {
    const department = operationalHeaderField({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      sort_order: 20,
    });
    const specialty = operationalHeaderField({
      id: 11,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      sort_order: 30,
    });
    const hidden = operationalHeaderField({
      id: 12,
      slug: "sector",
      label: "Sector",
      input_type: "text",
      visible_in_gantt: false,
      sort_order: 10,
    });
    const inactive = operationalHeaderField({
      id: 13,
      slug: "area",
      label: "Area",
      input_type: "text",
      active: false,
      sort_order: 10,
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([specialty, hidden, department, inactive]));
    const path = resolveGanttGroupingPath(planningItem({
      operational_header_values: [
        { field_id: 10, value: "Mina" },
        { field_id: 11, value: "Perforacion" },
      ],
    }), fields);

    expect(fields.map((field) => field.slug)).toEqual(["departamento", "especialidad"]);
    expect(path.map((entry) => `${entry.label}:${entry.value}`)).toEqual([
      "Departamento:Mina",
      "Especialidad:Perforacion",
    ]);
  });

  it("orders select grouping paths by option sort_order", () => {
    const department = operationalHeaderField({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "select",
      options: [
        { id: 100, field_id: 10, value: "mina", label: "Mina", active: true, sort_order: 20, metadata: {} },
        { id: 101, field_id: 10, value: "planta", label: "Planta", active: true, sort_order: 10, metadata: {} },
      ],
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([department]));
    const minaPath = resolveGanttGroupingPath(planningItem({
      operational_header_values: [{ field_id: 10, value: "Mina", option_id: 100 }],
    }), fields);
    const plantaPath = resolveGanttGroupingPath(planningItem({
      operational_header_values: [{ field_id: 10, value: "Planta", option_id: 101 }],
    }), fields);

    expect(compareGanttGroupingPaths(plantaPath, minaPath)).toBeLessThan(0);
    expect([minaPath, plantaPath].sort(compareGanttGroupingPaths).map(formatGanttGroupingTitle)).toEqual([
      "Planta",
      "Mina",
    ]);
  });

  it("orders text grouping paths alphabetically", () => {
    const specialty = operationalHeaderField({
      id: 11,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([specialty]));
    const perforacionPath = resolveGanttGroupingPath(planningItem({
      operational_header_values: [{ field_id: 11, value: "Perforacion" }],
    }), fields);
    const carguioPath = resolveGanttGroupingPath(planningItem({
      operational_header_values: [{ field_id: 11, value: "Carguio" }],
    }), fields);

    expect([perforacionPath, carguioPath].sort(compareGanttGroupingPaths).map(formatGanttGroupingTitle)).toEqual([
      "Carguio",
      "Perforacion",
    ]);
  });

  it("sorts Sin valor at the end", () => {
    const department = operationalHeaderField({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([department]));
    const valuedPath = resolveGanttGroupingPath(planningItem({
      operational_header_values: [{ field_id: 10, value: "Mina" }],
    }), fields);
    const emptyPath = resolveGanttGroupingPath(planningItem({ operational_header_values: [] }), fields);

    expect([emptyPath, valuedPath].sort(compareGanttGroupingPaths).map(formatGanttGroupingTitle)).toEqual([
      "Mina",
      "Sin valor",
    ]);
  });

  it("uses configured Nivel and Frente values from operational header only", () => {
    const level = operationalHeaderField({
      id: 1,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      sort_order: 10,
      options: [{ id: 1, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 10, metadata: {} }],
    });
    const front = operationalHeaderField({
      id: 2,
      slug: "frente",
      label: "Frente",
      input_type: "select",
      sort_order: 20,
      options: [{ id: 2, field_id: 2, value: "gt1", label: "GT1 N XC 2AS", active: true, sort_order: 10, metadata: {} }],
    });
    const path = resolveGanttGroupingPath(
      planningItem({
        operational_header_values: [
          { field_id: 1, value: "nti", option_id: 1 },
          { field_id: 2, value: "gt1", option_id: 2 },
        ],
      }),
      getGanttGroupingFields(operationalHeaderConfig([front, level]))
    );

    expect(path.map((entry) => entry.value)).toEqual(["NTI", "GT1 N XC 2AS"]);
    expect(formatGanttGroupingTitle(path)).toBe("NTI - GT1 N XC 2AS");
  });

  it("does not fall back to legacy Nivel and Frente when configured values are missing", () => {
    const level = operationalHeaderField({
      id: 1,
      slug: "nivel",
      label: "Nivel",
      input_type: "select",
      sort_order: 10,
    });
    const front = operationalHeaderField({
      id: 2,
      slug: "frente",
      label: "Frente",
      input_type: "select",
      sort_order: 20,
    });
    const path = resolveGanttGroupingPath(
      planningItem({ operational_header_values: [] }),
      getGanttGroupingFields(operationalHeaderConfig([front, level]))
    );

    expect(path.map((entry) => entry.value)).toEqual(["Sin valor", "Sin valor"]);
    expect(formatGanttGroupingTitle(path)).toBe("Sin valor - Sin valor");
  });

  it("builds calendar days with leading blanks and complete weeks", () => {
    const days = getCalendarDays(new Date(2026, 4, 1));

    expect(days.length % 7).toBe(0);
    expect(days.slice(0, 4)).toEqual([null, null, null, null]);
    expect(days[4]?.getDate()).toBe(1);
    expect(days.filter(Boolean)).toHaveLength(31);
  });
});
