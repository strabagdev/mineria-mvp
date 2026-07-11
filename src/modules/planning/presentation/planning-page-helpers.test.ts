import { describe, expect, it } from "vitest";
import {
  buildEventSubtitle,
  buildEventTitle,
  buildGanttBarPlacement,
  compareGanttGroupingPaths,
  formatGanttGroupingTitle,
  buildGanttBarLabel,
  buildGanttCurrentTimeMarker,
  buildGanttScale,
  buildPlanningItemShiftProjection,
  buildPlanningItemAriaLabel,
  doesPlanningItemIntersectShiftWindow,
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
import {
  getOperationalHeaderGanttGroupingFields,
  sortOperationalHeaderGanttGroupingFields,
} from "../../operational-header/application/operational-header-ordering";
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
    grouping_order: null,
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

  it("keeps Gantt bar placement inside the visible shift window", () => {
    const dayScale = buildGanttScale("08:00", "20:00", false);
    const nightScale = buildGanttScale("20:00", "08:00", true);

    expect(buildGanttBarPlacement("10:00", "18:00", dayScale)).toEqual({
      leftPercent: expect.closeTo(16.666, 2),
      widthPercent: expect.closeTo(66.666, 2),
    });
    expect(buildGanttBarPlacement("18:00", "22:00", dayScale)).toEqual({
      leftPercent: expect.closeTo(83.333, 2),
      widthPercent: expect.closeTo(16.666, 2),
    });
    expect(buildGanttBarPlacement("19:00", "07:00", dayScale)).toEqual({
      leftPercent: expect.closeTo(91.666, 2),
      widthPercent: expect.closeTo(8.333, 2),
    });
    expect(buildGanttBarPlacement("23:00", "09:00", nightScale)).toEqual({
      leftPercent: expect.closeTo(25, 2),
      widthPercent: expect.closeTo(75, 2),
    });
  });

  it("projects planned items that cross from day to night", () => {
    const item = planningItem({ shift: "Dia", start: "19:00", end: "21:00" });

    expect(buildPlanningItemShiftProjection(item, "Dia")).toEqual({
      start: "19:00",
      end: "20:00",
    });
    expect(buildPlanningItemShiftProjection(item, "Noche")).toEqual({
      start: "20:00",
      end: "21:00",
    });
  });

  it("projects planned items that cross from day to night across midnight", () => {
    const item = planningItem({ shift: "Dia", start: "19:00", end: "07:00" });

    expect(buildPlanningItemShiftProjection(item, "Dia")).toEqual({
      start: "19:00",
      end: "20:00",
    });
    expect(buildPlanningItemShiftProjection(item, "Noche")).toEqual({
      start: "20:00",
      end: "07:00",
    });
  });

  it("projects planned items that cross from night to day", () => {
    const earlyNightItem = planningItem({ shift: "Noche", start: "07:00", end: "09:00" });
    const lateNightItem = planningItem({ shift: "Noche", start: "23:00", end: "09:00" });

    expect(buildPlanningItemShiftProjection(earlyNightItem, "Noche")).toEqual({
      start: "07:00",
      end: "08:00",
    });
    expect(buildPlanningItemShiftProjection(earlyNightItem, "Dia")).toEqual({
      start: "08:00",
      end: "09:00",
    });
    expect(buildPlanningItemShiftProjection(lateNightItem, "Noche")).toEqual({
      start: "23:00",
      end: "08:00",
    });
    expect(buildPlanningItemShiftProjection(lateNightItem, "Dia")).toEqual({
      start: "08:00",
      end: "09:00",
    });
  });

  it("does not project items into shifts they do not intersect", () => {
    expect(buildPlanningItemShiftProjection(
      planningItem({ shift: "Dia", start: "10:00", end: "18:00" }),
      "Noche"
    )).toBeNull();
    expect(buildPlanningItemShiftProjection(
      planningItem({ shift: "Noche", start: "22:00", end: "06:00" }),
      "Dia"
    )).toBeNull();
    expect(doesPlanningItemIntersectShiftWindow(
      planningItem({ shift: "Dia", start: "10:00", end: "18:00" }),
      "Dia"
    )).toBe(true);
  });

  it("handles exact shift boundaries without duplicating adjacent windows", () => {
    const dayToNight = planningItem({ shift: "Dia", start: "19:00", end: "20:00" });
    const nightStart = planningItem({ shift: "Noche", start: "20:00", end: "22:00" });
    const nightToDay = planningItem({ shift: "Noche", start: "07:00", end: "08:00" });
    const dayStart = planningItem({ shift: "Dia", start: "08:00", end: "10:00" });

    expect(buildPlanningItemShiftProjection(dayToNight, "Dia")).toEqual({
      start: "19:00",
      end: "20:00",
    });
    expect(buildPlanningItemShiftProjection(dayToNight, "Noche")).toBeNull();
    expect(buildPlanningItemShiftProjection(nightStart, "Noche")).toEqual({
      start: "20:00",
      end: "22:00",
    });
    expect(buildPlanningItemShiftProjection(nightToDay, "Noche")).toEqual({
      start: "07:00",
      end: "08:00",
    });
    expect(buildPlanningItemShiftProjection(nightToDay, "Dia")).toBeNull();
    expect(buildPlanningItemShiftProjection(dayStart, "Dia")).toEqual({
      start: "08:00",
      end: "10:00",
    });
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

  it("uses groupable visible operational header fields ordered by visual order when grouping_order is null", () => {
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

  it("orders Gantt grouping fields by explicit grouping_order before visual order", () => {
    const department = operationalHeaderField({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      sort_order: 10,
      grouping_order: 30,
    });
    const specialty = operationalHeaderField({
      id: 11,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      sort_order: 20,
      grouping_order: 10,
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([department, specialty]));

    expect(fields.map((field) => field.slug)).toEqual(["especialidad", "departamento"]);
  });

  it("mixes explicit grouping_order with sort_order fallback", () => {
    const department = operationalHeaderField({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
      sort_order: 10,
      grouping_order: 50,
    });
    const specialty = operationalHeaderField({
      id: 11,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      sort_order: 20,
      grouping_order: null,
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([department, specialty]));

    expect(fields.map((field) => field.slug)).toEqual(["especialidad", "departamento"]);
  });

  it("uses sort_order, label and id as stable tie breakers for grouping_order", () => {
    const sector = operationalHeaderField({
      id: 12,
      slug: "sector",
      label: "Sector",
      input_type: "text",
      sort_order: 20,
      grouping_order: 10,
    });
    const area = operationalHeaderField({
      id: 13,
      slug: "area",
      label: "Area",
      input_type: "text",
      sort_order: 20,
      grouping_order: 10,
    });
    const beta = operationalHeaderField({
      id: 14,
      slug: "beta",
      label: "Area",
      input_type: "text",
      sort_order: 20,
      grouping_order: 10,
    });
    const first = operationalHeaderField({
      id: 15,
      slug: "first",
      label: "Zeta",
      input_type: "text",
      sort_order: 5,
      grouping_order: 10,
    });
    const fields = getGanttGroupingFields(operationalHeaderConfig([sector, beta, first, area]));

    expect(fields.map((field) => field.slug)).toEqual(["first", "area", "beta", "sector"]);
  });

  it("excludes inactive, non-groupable and non-visible fields from Gantt grouping", () => {
    const visible = operationalHeaderField({
      id: 10,
      slug: "departamento",
      label: "Departamento",
      input_type: "text",
    });
    const inactive = operationalHeaderField({
      id: 11,
      slug: "area",
      label: "Area",
      input_type: "text",
      active: false,
    });
    const notGroupable = operationalHeaderField({
      id: 12,
      slug: "sector",
      label: "Sector",
      input_type: "text",
      groupable: false,
    });
    const notVisible = operationalHeaderField({
      id: 13,
      slug: "especialidad",
      label: "Especialidad",
      input_type: "text",
      visible_in_gantt: false,
    });

    expect(getGanttGroupingFields(operationalHeaderConfig([
      inactive,
      notGroupable,
      notVisible,
      visible,
    ])).map((field) => field.slug)).toEqual(["departamento"]);
  });

  it("does not mutate the original grouping field array", () => {
    const fields = [
      operationalHeaderField({
        id: 10,
        slug: "departamento",
        label: "Departamento",
        input_type: "text",
        grouping_order: 20,
      }),
      operationalHeaderField({
        id: 11,
        slug: "especialidad",
        label: "Especialidad",
        input_type: "text",
        grouping_order: 10,
      }),
    ];
    const originalOrder = fields.map((field) => field.slug);
    const sorted = sortOperationalHeaderGanttGroupingFields(fields);

    expect(sorted.map((field) => field.slug)).toEqual(["especialidad", "departamento"]);
    expect(fields.map((field) => field.slug)).toEqual(originalOrder);
  });

  it("filters Gantt grouping fields by active, groupable and visible before ordering", () => {
    const visible = operationalHeaderField({
      id: 10,
      slug: "visible",
      label: "Visible",
      input_type: "text",
      grouping_order: null,
      sort_order: 20,
    });
    const first = operationalHeaderField({
      id: 11,
      slug: "first",
      label: "First",
      input_type: "text",
      grouping_order: 1,
      sort_order: 100,
    });
    const inactive = operationalHeaderField({
      id: 12,
      slug: "inactive",
      label: "Inactive",
      input_type: "text",
      active: false,
      grouping_order: 0,
    });
    const notVisible = operationalHeaderField({
      id: 13,
      slug: "not_visible",
      label: "Not visible",
      input_type: "text",
      visible_in_gantt: false,
      grouping_order: 0,
    });
    const notGroupable = operationalHeaderField({
      id: 14,
      slug: "not_groupable",
      label: "Not groupable",
      input_type: "text",
      groupable: false,
      grouping_order: 0,
    });

    expect(getOperationalHeaderGanttGroupingFields([
      visible,
      inactive,
      notVisible,
      notGroupable,
      first,
    ]).map((field) => field.slug)).toEqual(["first", "visible"]);
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
