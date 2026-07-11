import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GanttShiftSection } from "./gantt-shift-section";
import type { GanttGroupingPathEntry, GanttScale } from "@/modules/planning/presentation/planning-page-helpers";

type TestItem = {
  id: number;
  shift: string;
  start: string;
  end: string;
  gantt_projection?: {
    start: string;
    end: string;
  };
};

type TestGroup = {
  key: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  programado: TestItem | null;
  realSegments: TestItem[];
  gantt_group_path?: GanttGroupingPathEntry[];
};

const scale: GanttScale = {
  startMinutes: 480,
  endMinutes: 540,
  slotMinutes: 30,
  slotCount: 2,
  endLabel: "09:00",
  hourMarks: [
    { key: "08:00", label: "08:00", major: true },
    { key: "08:30", label: "08:30", major: false },
  ],
};

function renderSection(groups: TestGroup[]) {
  return renderToStaticMarkup(
    <GanttShiftSection
      shift="Dia"
      groups={groups}
      scale={scale}
      renderBar={() => null}
      renderCreateRealButton={() => null}
    />
  );
}

function group(overrides: Partial<TestGroup> = {}): TestGroup {
  return {
    key: "group-1",
    level: "NTI",
    front: "GT1",
    category: "actividad",
    item_type: "unitaria",
    description: "Extraccion",
    programado: { id: 1, shift: "Dia", start: "08:00", end: "09:00" },
    realSegments: [],
    ...overrides,
  };
}

describe("GanttShiftSection grouping", () => {
  it("shows a clear empty header state when no gantt path exists", () => {
    const html = renderSection([group()]);

    expect(html).toContain("Sin cabecera");
    expect(html).not.toContain("NTI - GT1");
  });

  it("uses dynamic operational header grouping path when present", () => {
    const html = renderSection([
      group({
        gantt_group_path: [
          {
            field_id: 10,
            slug: "departamento",
            label: "Departamento",
            value: "Mina",
            input_type: "text",
            field_sort_order: 10,
          },
          {
            field_id: 11,
            slug: "especialidad",
            label: "Especialidad",
            value: "Perforacion",
            input_type: "text",
            field_sort_order: 20,
          },
        ],
      }),
    ]);

    expect(html).toContain("Mina - Perforacion");
    expect(html).not.toContain("NTI - GT1");
  });

  it("projects planned items into the visible shift without duplicating real segments from another shift", () => {
    const renderedBars: Array<{ id: number; layer: "programado" | "real"; projection?: { start: string; end: string } }> = [];

    renderToStaticMarkup(
      <GanttShiftSection
        shift="Noche"
        groups={[
          group({
            programado: { id: 1, shift: "Dia", start: "19:00", end: "21:00" },
            realSegments: [
              { id: 2, shift: "Dia", start: "19:00", end: "20:00" },
              { id: 3, shift: "Noche", start: "20:00", end: "21:00" },
            ],
          }),
        ]}
        scale={scale}
        renderBar={(item, layer) => {
          if (item) {
            renderedBars.push({ id: item.id, layer, projection: item.gantt_projection });
          }
          return null;
        }}
        renderCreateRealButton={() => null}
      />
    );

    expect(renderedBars).toEqual([
      { id: 1, layer: "programado", projection: { start: "20:00", end: "21:00" } },
      { id: 3, layer: "real", projection: undefined },
    ]);
  });
});
