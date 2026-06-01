import { createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OperationalHero } from "./operational-hero";

type SwitchElement = ReactElement<{
  "aria-label": string;
  "aria-checked": boolean;
  className: string;
  onClick: () => void;
  role: string;
}>;

function findSwitch(node: ReactNode): SwitchElement | null {
  if (!isValidElement<{ children?: ReactNode; role?: string }>(node)) {
    return null;
  }

  if (node.props.role === "switch") {
    return node as SwitchElement;
  }

  const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];

  return children.map(findSwitch).find(Boolean) ?? null;
}

function renderHero(activeShift: "Dia" | "Noche", onSelectShift = vi.fn()) {
  return {
    onSelectShift,
    shiftSwitch: findSwitch(
      OperationalHero({
        activeShift,
        onSelectShift,
        shiftConfig: {
          Dia: { title: "Turno Dia", description: "08:00 a 20:00" },
          Noche: { title: "Turno Noche", description: "20:00 a 08:00" },
        },
        selectedDate: "2026-06-01",
        todayIso: "2026-06-01",
        todayDate: new Date("2026-06-01T00:00:00"),
        calendarMonth: new Date("2026-06-01T00:00:00"),
        calendarDays: [],
        canGoNextMonth: false,
        isDatePickerOpen: false,
        setIsDatePickerOpen: vi.fn(),
        setCalendarMonth: vi.fn(),
        datePickerRef: createRef<HTMLDivElement>(),
        isHistoricalView: false,
        isCreateDisabled: false,
        createTitle: "Nueva programacion",
        formatDateTitle: (value) => value,
        formatMonthTitle: () => "Junio",
        formatLocalDateIso: () => "2026-06-01",
        onSelectOperationalDate: vi.fn(),
        onCreatePlanning: vi.fn(),
      })
    ),
  };
}

describe("OperationalHero shift selector", () => {
  it("toggles the whole control from Dia to Noche", () => {
    const { onSelectShift, shiftSwitch } = renderHero("Dia");

    shiftSwitch?.props.onClick();

    expect(onSelectShift).toHaveBeenCalledWith("Noche");
  });

  it("toggles the whole control from Noche to Dia", () => {
    const { onSelectShift, shiftSwitch } = renderHero("Noche");

    shiftSwitch?.props.onClick();

    expect(onSelectShift).toHaveBeenCalledWith("Dia");
  });

  it("exposes the current shift through the switch state", () => {
    expect(renderHero("Dia").shiftSwitch?.props["aria-checked"]).toBe(false);
    expect(renderHero("Noche").shiftSwitch?.props["aria-checked"]).toBe(true);
  });
});
