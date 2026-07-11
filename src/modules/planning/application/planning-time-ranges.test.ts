import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getOperationalDurationMinutes,
  isStartTimeInsideShift,
  PLANNED_DURATION_INVALID_MESSAGE,
  PLANNED_START_OUTSIDE_SHIFT_MESSAGE,
  validatePlannedTimeRange,
} from "./planning-time-ranges";

describe("planning time ranges", () => {
  it("validates planned events inside the selected shift", () => {
    expect(validatePlannedTimeRange({
      startTime: "08:00",
      endTime: "10:00",
      shift: "Dia",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "19:00",
      endTime: "22:00",
      shift: "Dia",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "20:00",
      endTime: "22:00",
      shift: "Noche",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "22:00",
      endTime: "06:00",
      shift: "Noche",
    })).toBeNull();
  });

  it("allows planned events to finish in the next shift", () => {
    expect(validatePlannedTimeRange({
      startTime: "18:00",
      endTime: "22:00",
      shift: "Dia",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "19:00",
      endTime: "07:00",
      shift: "Dia",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "06:00",
      endTime: "10:00",
      shift: "Noche",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "23:00",
      endTime: "09:00",
      shift: "Noche",
    })).toBeNull();
    expect(validatePlannedTimeRange({
      startTime: "07:00",
      endTime: "09:00",
      shift: "Noche",
    })).toBeNull();
  });

  it("rejects planned events when start time is outside the selected shift", () => {
    expect(isStartTimeInsideShift("22:00", "Dia")).toBe(false);
    expect(isStartTimeInsideShift("10:00", "Noche")).toBe(false);
    expect(isStartTimeInsideShift("20:00", "Dia")).toBe(false);
    expect(isStartTimeInsideShift("08:00", "Noche")).toBe(false);
    expect(validatePlannedTimeRange({
      startTime: "22:00",
      endTime: "23:00",
      shift: "Dia",
    })).toBe(PLANNED_START_OUTSIDE_SHIFT_MESSAGE);
    expect(validatePlannedTimeRange({
      startTime: "10:00",
      endTime: "11:00",
      shift: "Noche",
    })).toBe(PLANNED_START_OUTSIDE_SHIFT_MESSAGE);
    expect(validatePlannedTimeRange({
      startTime: "07:00",
      endTime: "09:00",
      shift: "Dia",
    })).toBe(PLANNED_START_OUTSIDE_SHIFT_MESSAGE);
    expect(validatePlannedTimeRange({
      startTime: "20:00",
      endTime: "22:00",
      shift: "Dia",
    })).toBe(PLANNED_START_OUTSIDE_SHIFT_MESSAGE);
    expect(validatePlannedTimeRange({
      startTime: "08:00",
      endTime: "10:00",
      shift: "Noche",
    })).toBe(PLANNED_START_OUTSIDE_SHIFT_MESSAGE);
  });

  it("calculates operational duration across midnight and rejects empty ranges", () => {
    expect(getOperationalDurationMinutes("19:00", "07:00")).toBe(12 * 60);
    expect(getOperationalDurationMinutes("23:00", "09:00")).toBe(10 * 60);
    expect(validatePlannedTimeRange({
      startTime: "08:00",
      endTime: "08:00",
      shift: "Dia",
    })).toBe(PLANNED_DURATION_INVALID_MESSAGE);
  });

  it("keeps the SQL planning_items check aligned with half-open shift boundaries", () => {
    const sql = readFileSync("supabase/sql/018_update_planning_items_valid_range.sql", "utf8");

    expect(sql).toContain("drop constraint if exists planning_items_valid_range");
    expect(sql).toContain("existen % planning_items incompatibles");
    expect(sql).toContain("start_time <> end_time");
    expect(sql).toContain("shift = 'Dia'");
    expect(sql).toContain("start_time >= time '08:00'");
    expect(sql).toContain("start_time < time '20:00'");
    expect(sql).toContain("shift = 'Noche'");
    expect(sql).toContain("start_time >= time '20:00'");
    expect(sql).toContain("start_time < time '08:00'");
    expect(sql).not.toContain("end_time <= time '20:00'");
    expect(sql).not.toContain("end_time <= time '08:00'");
  });
});
