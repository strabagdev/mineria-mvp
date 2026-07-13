import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GanttShiftSection } from "./gantt-shift-section";
import type { GanttGroupingPathEntry, GanttScale } from "@/modules/planning/presentation/planning-page-helpers";

type TestItem = {
  id: number;
  item_date: string;
  shift: string;
  start: string;
  end: string;
  operational_header_values?: Array<{ field_id: number; value: string; option_id?: number | null }>;
  gantt_projection?: {
    start: string;
    end: string;
  };
};

type TestGroup = {
  key: string;
  activity_group_id: string;
  item_date: string;
  shift: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes?: string | null;
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
    activity_group_id: "group-1",
    item_date: "2026-05-06",
    shift: "Dia",
    level: "NTI",
    front: "GT1",
    category: "actividad",
    item_type: "unitaria",
    description: "Extraccion",
    programado: { id: 1, item_date: "2026-05-06", shift: "Dia", start: "08:00", end: "09:00" },
    realSegments: [],
    ...overrides,
  };
}

describe("GanttShiftSection grouping", () => {
  it("shows a configuration empty state when no grouping fields exist", () => {
    const html = renderSection([group()]);

    expect(html).toContain("El Gantt no tiene campos configurados para agrupación.");
    expect(html).toContain("Configura campos agrupables y visibles en Gantt desde el Catálogo.");
    expect(html).not.toContain("Sin campos de agrupacion configurados.");
    expect(html).not.toContain("Expandir todo");
    expect(html).not.toContain("Colapsar todo");
    expect(html).not.toContain("Extraccion");
    expect(html).not.toContain("gantt-hierarchy-node-row");
    expect(html).not.toContain("NTI - GT1");
  });

  it("shows an activity empty state when grouping exists but no rows are visible", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[]}
        groupingFields={[
          {
            id: 10,
            slug: "departamento",
            label: "Departamento",
            input_type: "text",
            sort_order: 10,
            grouping_order: null,
            options: [],
          },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html).toContain("No hay actividades visibles para esta configuración.");
    expect(html).not.toContain("El Gantt no tiene campos configurados");
  });

  it("does not render hierarchy view controls inside the shift section", () => {
    const html = renderSection([group()]);

    expect(html).not.toContain('aria-label="Controles de jerarquia del turno Dia"');
    expect(html).not.toContain("gantt-hierarchy-toolbar");
  });

  it("renders a one-level hierarchy with its activity visible", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[
          group({
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:00",
              end: "09:00",
              operational_header_values: [{ field_id: 10, value: "Mina" }],
            },
          }),
        ]}
        groupingFields={[
          {
            id: 10,
            slug: "departamento",
            label: "Departamento",
            input_type: "text",
            sort_order: 10,
            grouping_order: null,
            options: [],
          },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html).toContain("gantt-hierarchy-row--group gantt-hierarchy-row--compact expanded");
    expect(html).toContain("gantt-hierarchy-row--activity");
    expect(html).not.toContain("gantt-hierarchy-compact-row");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Mina");
    expect(html).toContain("Departamento");
    expect(html).toContain("1 actividad");
    expect(html).toContain('title="1 programada · 0 con reales"');
    expect(html).toContain("Extraccion");
  });

  it("renders a two-level hierarchy with activities visible initially", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[
          group({
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:00",
              end: "09:00",
              operational_header_values: [
                { field_id: 10, value: "Mina" },
                { field_id: 11, value: "Perforacion" },
              ],
            },
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
        ]}
        groupingFields={[
          {
            id: 10,
            slug: "departamento",
            label: "Departamento",
            input_type: "text",
            sort_order: 10,
            grouping_order: null,
            options: [],
          },
          {
            id: 11,
            slug: "especialidad",
            label: "Especialidad",
            input_type: "text",
            sort_order: 20,
            grouping_order: null,
            options: [],
          },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html).toContain('data-hierarchy-enabled="true"');
    expect(html).toContain('data-hierarchy-actions-ready="true"');
    expect(html).toContain('data-visible-hierarchy-rows="3"');
    expect(html).toContain("gantt-hierarchy-row--compact");
    expect(html).toContain("gantt-hierarchy-row--activity");
    expect(html).not.toContain("gantt-hierarchy-compact-row");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('style="--gantt-tree-depth:1"');
    expect(html).toContain("Mina");
    expect(html).toContain("Perforacion");
    expect(html).not.toContain("Mina › Perforacion");
    expect(html).not.toContain("Departamento › Especialidad");
    expect(html).not.toContain("Mina - Perforacion");
    expect(html).toContain("Extraccion");
  });

  it("keeps two visible levels and shows a single compact route as activity subtitle", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[
          group({
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:00",
              end: "09:00",
              operational_header_values: [
                { field_id: 10, value: "NTI" },
                { field_id: 11, value: "Barrio Civico" },
                { field_id: 12, value: "Geologia" },
                { field_id: 13, value: "Mecanica" },
              ],
            },
          }),
        ]}
        groupingFields={[
          { id: 10, slug: "nivel", label: "Nivel", input_type: "text", sort_order: 10, grouping_order: null, options: [] },
          { id: 11, slug: "frente", label: "Frente", input_type: "text", sort_order: 20, grouping_order: null, options: [] },
          { id: 12, slug: "departamento", label: "Departamento", input_type: "text", sort_order: 30, grouping_order: null, options: [] },
          { id: 13, slug: "especialidad", label: "Especialidad", input_type: "text", sort_order: 40, grouping_order: null, options: [] },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html).toContain("NTI");
    expect(html).toContain("Barrio Civico");
    expect(html).toContain("Geologia › Mecanica");
    expect(html).toContain('class="gantt-meta-subtitle" title="Geologia › Mecanica"');
    expect(html).not.toContain("Departamento › Especialidad");
    expect(html).not.toContain("gantt-hierarchy-compact-row");
    expect(html).toContain("gantt-hierarchy-row--activity");
    expect(html).toContain("Extraccion");
    expect(html).toContain('aria-label="Colapsar NTI"');
    expect(html).toContain('aria-label="Colapsar Barrio Civico"');
    expect(html).not.toContain('aria-label="Colapsar Geologia"');
    expect(html).not.toContain('aria-label="Colapsar Mecanica"');
  });

  it("keeps a compact header for multiple activities under the same compact route", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[
          group({
            key: "group-a",
            activity_group_id: "group-a",
            description: "Acunadura",
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:00",
              end: "09:00",
              operational_header_values: [
                { field_id: 10, value: "NTI" },
                { field_id: 11, value: "Barrio Civico" },
                { field_id: 12, value: "Servicios" },
                { field_id: 13, value: "Perforacion" },
              ],
            },
          }),
          group({
            key: "group-b",
            activity_group_id: "group-b",
            description: "Fortificacion",
            programado: {
              id: 2,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:30",
              end: "09:00",
              operational_header_values: [
                { field_id: 10, value: "NTI" },
                { field_id: 11, value: "Barrio Civico" },
                { field_id: 12, value: "Servicios" },
                { field_id: 13, value: "Perforacion" },
              ],
            },
          }),
        ]}
        groupingFields={[
          { id: 10, slug: "nivel", label: "Nivel", input_type: "text", sort_order: 10, grouping_order: null, options: [] },
          { id: 11, slug: "frente", label: "Frente", input_type: "text", sort_order: 20, grouping_order: null, options: [] },
          { id: 12, slug: "departamento", label: "Departamento", input_type: "text", sort_order: 30, grouping_order: null, options: [] },
          { id: 13, slug: "especialidad", label: "Especialidad", input_type: "text", sort_order: 40, grouping_order: null, options: [] },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html).toContain("gantt-hierarchy-row--compact-path gantt-hierarchy-row--compact expanded");
    expect(html).toContain("Servicios › Perforacion");
    expect(html).toContain("Departamento › Especialidad");
    expect(html).toContain("Acunadura");
    expect(html).toContain("Fortificacion");
    expect(html.match(/class="gantt-meta-subtitle" title="Servicios › Perforacion"/g)).toBeNull();
  });

  it("keeps repeated labels as separate hierarchy nodes when option ids differ", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[
          group({
            key: "group-a",
            activity_group_id: "group-a",
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:00",
              end: "09:00",
              operational_header_values: [{ field_id: 20, option_id: 201, value: "a" }],
            },
          }),
          group({
            key: "group-b",
            activity_group_id: "group-b",
            programado: {
              id: 2,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "09:00",
              end: "10:00",
              operational_header_values: [{ field_id: 20, option_id: 202, value: "b" }],
            },
          }),
        ]}
        groupingFields={[
          {
            id: 20,
            slug: "frente",
            label: "Frente",
            input_type: "select",
            sort_order: 10,
            grouping_order: null,
            options: [
              { id: 201, field_id: 20, value: "a", label: "Frente B", active: true, sort_order: 10, metadata: {} },
              { id: 202, field_id: 20, value: "b", label: "Frente B", active: true, sort_order: 20, metadata: {} },
            ],
          },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html.match(/aria-label="Colapsar Frente B"/g)).toHaveLength(2);
    expect(html.match(/1 actividad/g)).toHaveLength(2);
  });

  it("keeps meta and timeline rows aligned in hierarchy render", () => {
    const html = renderToStaticMarkup(
      <GanttShiftSection
        shift="Dia"
        groups={[
          group({
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "08:00",
              end: "09:00",
              operational_header_values: [{ field_id: 10, value: "Mina" }],
            },
          }),
        ]}
        groupingFields={[
          {
            id: 10,
            slug: "departamento",
            label: "Departamento",
            input_type: "text",
            sort_order: 10,
            grouping_order: null,
            options: [],
          },
        ]}
        scale={scale}
        renderBar={() => null}
        renderCreateRealButton={() => null}
      />
    );

    expect(html.match(/class="gantt-meta"/g)).toHaveLength(2);
    expect(html.match(/class="gantt-track(?:\s|")/g)).toHaveLength(2);
  });

  it("keeps existing bar rendering and projected times under hierarchy rows", () => {
    const renderedBars: Array<{ id: number; layer: "programado" | "real"; projection?: { start: string; end: string } }> = [];

    renderToStaticMarkup(
      <GanttShiftSection
        shift="Noche"
        groups={[
          group({
            programado: {
              id: 1,
              item_date: "2026-05-06",
              shift: "Dia",
              start: "19:00",
              end: "21:00",
              operational_header_values: [{ field_id: 10, value: "Mina" }],
            },
            realSegments: [
              {
                id: 3,
                item_date: "2026-05-06",
                shift: "Noche",
                start: "20:00",
                end: "21:00",
                operational_header_values: [{ field_id: 10, value: "Mina" }],
              },
            ],
          }),
        ]}
        groupingFields={[
          {
            id: 10,
            slug: "departamento",
            label: "Departamento",
            input_type: "text",
            sort_order: 10,
            grouping_order: null,
            options: [],
          },
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

  it("keeps hierarchy state scoped to each rendered shift section", () => {
    const html = renderToStaticMarkup(
      <>
        <GanttShiftSection
          shift="Dia"
          groups={[group()]}
          groupingFields={[]}
          scale={scale}
          renderBar={() => null}
          renderCreateRealButton={() => null}
        />
        <GanttShiftSection
          shift="Noche"
          groups={[group()]}
          groupingFields={[]}
          scale={scale}
          renderBar={() => null}
          renderCreateRealButton={() => null}
        />
      </>
    );

    expect(html.match(/gantt-section shift-section/g)).toHaveLength(2);
    expect(html).not.toContain("data-hierarchy-enabled");
  });

  it("projects planned items into the visible shift without duplicating real segments from another shift", () => {
    const renderedBars: Array<{ id: number; layer: "programado" | "real"; projection?: { start: string; end: string } }> = [];

    renderToStaticMarkup(
      <GanttShiftSection
        shift="Noche"
        groups={[
          group({
            programado: { id: 1, item_date: "2026-05-06", shift: "Dia", start: "19:00", end: "21:00" },
            realSegments: [
              { id: 2, item_date: "2026-05-06", shift: "Dia", start: "19:00", end: "20:00" },
              { id: 3, item_date: "2026-05-06", shift: "Noche", start: "20:00", end: "21:00" },
            ],
          }),
        ]}
        groupingFields={[
          {
            id: 10,
            slug: "departamento",
            label: "Departamento",
            input_type: "text",
            sort_order: 10,
            grouping_order: null,
            options: [],
          },
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
