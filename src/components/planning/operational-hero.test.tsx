import { createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { formatLocalDateIso } from "../../modules/planning/presentation/planning-page-helpers";
import { OperationalHero } from "./operational-hero";

type OperationalHeroProps = Parameters<typeof OperationalHero>[0];

type SwitchElement = ReactElement<{
  "aria-label": string;
  "aria-checked": boolean;
  className: string;
  onClick: () => void;
  role: string;
}>;

type ButtonElement = ReactElement<{
  "aria-label"?: string;
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
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

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function findButton(
  node: ReactNode,
  predicate: (button: ButtonElement) => boolean
): ButtonElement | null {
  if (!isValidElement<{ children?: ReactNode; type?: string }>(node)) {
    return null;
  }

  if (node.type === "button" && predicate(node as ButtonElement)) {
    return node as ButtonElement;
  }

  const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];

  return children.map((child) => findButton(child, predicate)).find(Boolean) ?? null;
}

function findButtonByLabel(node: ReactNode, label: string) {
  return findButton(node, (button) => button.props["aria-label"] === label);
}

function findButtonByText(node: ReactNode, text: string) {
  return findButton(node, (button) => getNodeText(button.props.children).trim() === text);
}

function renderHero(
  activeShift: "Dia" | "Noche",
  onSelectShift = vi.fn(),
  overrides: Partial<OperationalHeroProps> = {}
) {
  const onSelectOperationalDate = overrides.onSelectOperationalDate ?? vi.fn();
  const tree = OperationalHero({
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
    canExpandGanttHierarchy: true,
    canCollapseGanttHierarchy: true,
    formatDateTitle: (value) => value,
    formatMonthTitle: () => "Junio",
    formatLocalDateIso,
    onSelectOperationalDate,
    onExpandGanttHierarchy: vi.fn(),
    onCollapseGanttHierarchy: vi.fn(),
    onCreatePlanning: vi.fn(),
    ...overrides,
  });

  return {
    onSelectShift,
    onSelectOperationalDate,
    previousDayButton: findButtonByLabel(tree, "Dia anterior"),
    nextDayButton: findButtonByLabel(tree, "Dia siguiente"),
    shiftSwitch: findSwitch(tree),
    todayButton: findButtonByText(tree, "Hoy"),
    tree,
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

describe("OperationalHero operational date navigation", () => {
  it("selects the current operational date from the Today button", () => {
    const { onSelectOperationalDate, todayButton } = renderHero("Dia", vi.fn(), {
      selectedDate: "2026-06-07",
      todayIso: "2026-06-08",
      todayDate: new Date("2026-06-08T00:00:00"),
      isHistoricalView: true,
    });

    todayButton?.props.onClick?.();

    expect(onSelectOperationalDate).toHaveBeenCalledWith("2026-06-08");
  });

  it("selects the previous operational date", () => {
    const { onSelectOperationalDate, previousDayButton } = renderHero("Dia", vi.fn(), {
      selectedDate: "2026-06-08",
      todayIso: "2026-06-09",
      todayDate: new Date("2026-06-09T00:00:00"),
    });

    previousDayButton?.props.onClick?.();

    expect(onSelectOperationalDate).toHaveBeenCalledWith("2026-06-07");
  });

  it("selects the next operational date when it is not in the future", () => {
    const { onSelectOperationalDate, nextDayButton } = renderHero("Dia", vi.fn(), {
      selectedDate: "2026-06-08",
      todayIso: "2026-06-09",
      todayDate: new Date("2026-06-09T00:00:00"),
    });

    nextDayButton?.props.onClick?.();

    expect(onSelectOperationalDate).toHaveBeenCalledWith("2026-06-09");
  });

  it("disables the next day button on the current operational date", () => {
    const { nextDayButton } = renderHero("Dia", vi.fn(), {
      selectedDate: "2026-06-08",
      todayIso: "2026-06-08",
      todayDate: new Date("2026-06-08T00:00:00"),
    });

    expect(nextDayButton?.props.disabled).toBe(true);
  });
});

describe("OperationalHero view menu", () => {
  it("renders a view menu in the top action bar", () => {
    const { tree } = renderHero("Dia");

    expect(getNodeText(tree)).toContain("Vista");
    expect(getNodeText(tree)).toContain("Expandir todo");
    expect(getNodeText(tree)).toContain("Colapsar todo");
  });

  it("runs hierarchy expand and collapse commands from the view menu", () => {
    const onExpandGanttHierarchy = vi.fn();
    const onCollapseGanttHierarchy = vi.fn();
    const { tree } = renderHero("Dia", vi.fn(), {
      onExpandGanttHierarchy,
      onCollapseGanttHierarchy,
    });

    findButtonByText(tree, "Expandir todo")?.props.onClick?.();
    findButtonByText(tree, "Colapsar todo")?.props.onClick?.();

    expect(onExpandGanttHierarchy).toHaveBeenCalledTimes(1);
    expect(onCollapseGanttHierarchy).toHaveBeenCalledTimes(1);
  });

  it("disables hierarchy commands when the visible Gantt cannot run them", () => {
    const { tree } = renderHero("Dia", vi.fn(), {
      canExpandGanttHierarchy: false,
      canCollapseGanttHierarchy: false,
    });

    expect(findButtonByText(tree, "Expandir todo")?.props.disabled).toBe(true);
    expect(findButtonByText(tree, "Colapsar todo")?.props.disabled).toBe(true);
  });
});
