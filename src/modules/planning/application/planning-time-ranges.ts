import type { PlanningShiftDto } from "../contracts/planning-items";

const DAY_MINUTES = 24 * 60;

export const PLANNED_START_OUTSIDE_SHIFT_MESSAGE =
  "La hora de inicio debe estar dentro del turno seleccionado.";

export const PLANNED_DURATION_INVALID_MESSAGE =
  "La hora de término debe formar una duración válida menor a 24 horas.";

export function toPlanningTimeMinutes(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

export function isStartTimeInsideShift(time: string, shift: PlanningShiftDto) {
  const minutes = toPlanningTimeMinutes(time);

  if (shift === "Dia") {
    return minutes >= toPlanningTimeMinutes("08:00") && minutes < toPlanningTimeMinutes("20:00");
  }

  return minutes >= toPlanningTimeMinutes("20:00") || minutes < toPlanningTimeMinutes("08:00");
}

export function getOperationalDurationMinutes(startTime: string, endTime: string) {
  const start = toPlanningTimeMinutes(startTime);
  let end = toPlanningTimeMinutes(endTime);

  if (end < start) {
    end += DAY_MINUTES;
  }

  return end - start;
}

export function validatePlannedTimeRange(input: {
  startTime: string;
  endTime: string;
  shift: PlanningShiftDto;
}) {
  if (!isStartTimeInsideShift(input.startTime, input.shift)) {
    return PLANNED_START_OUTSIDE_SHIFT_MESSAGE;
  }

  const duration = getOperationalDurationMinutes(input.startTime, input.endTime);

  if (duration <= 0 || duration >= DAY_MINUTES) {
    return PLANNED_DURATION_INVALID_MESSAGE;
  }

  return null;
}
