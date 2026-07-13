import { describe, expect, it } from "vitest";
import {
  areGanttHierarchyNodeIdSetsEqual,
  buildCompactGanttHierarchyRows,
  buildGanttHierarchy,
  countGanttHierarchyNodeItems,
  filterValidExpandedGanttNodeIds,
  getAllGanttHierarchyExpandableIds,
  flattenVisibleGanttHierarchy,
  getAllGanttHierarchyNodeIds,
  getCompactGanttHierarchyPathId,
  getCompactGanttHierarchyPathLabel,
  getGanttHierarchyExpansionState,
  getGanttHierarchyStorageKey,
  getGanttHierarchyVisibleTimeRange,
  getGanttGroupingFieldsSignature,
  getGanttHierarchyNodeId,
  getInitialExpandedGanttNodeIds,
  getInitialHybridExpandedNodeIds,
  parseExpandedGanttNodeIds,
  reconcileExpandedGanttNodeIds,
  resolveGanttHierarchyRowDensity,
  serializeExpandedGanttNodeIds,
  sortGanttHierarchyNodes,
  toggleGanttHierarchyNode,
  VISIBLE_GANTT_GROUPING_LEVELS,
} from "./gantt-hierarchy";
import { buildGanttScale } from "./planning-page-helpers";
import type { GanttGroupingPathEntry } from "./planning-page-helpers";
import type { PlanningGroup, PlanningItem } from "./planning-page-models";
import type { OperationalHeaderFieldDto } from "@/modules/operational-header/contracts/operational-header";

function field(input: Partial<OperationalHeaderFieldDto> & Pick<OperationalHeaderFieldDto, "id" | "slug" | "label" | "input_type">): OperationalHeaderFieldDto {
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

function item(overrides: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id: 1,
    activity_group_id: "group-1",
    description: "Extraccion",
    item_date: "2026-05-06",
    start: "08:00",
    end: "09:00",
    shift: "Dia",
    category: "actividad",
    tracking_type: "programado",
    item_type: "unitaria",
    notes: null,
    operational_header_values: [],
    ...overrides,
  };
}

function group(overrides: Partial<PlanningGroup> = {}): PlanningGroup {
  const programado = overrides.programado === undefined
    ? item({ activity_group_id: overrides.activity_group_id ?? "group-1" })
    : overrides.programado;

  return {
    key: overrides.activity_group_id ?? "group-1",
    activity_group_id: overrides.activity_group_id ?? "group-1",
    item_date: "2026-05-06",
    shift: "Dia",
    category: "actividad",
    item_type: "unitaria",
    description: "Extraccion",
    notes: null,
    programado,
    realSegments: [],
    ...overrides,
  };
}

const level = field({
  id: 1,
  slug: "nivel",
  label: "Nivel",
  input_type: "select",
  options: [
    { id: 10, field_id: 1, value: "nti", label: "NTI", active: true, sort_order: 20, metadata: {} },
    { id: 11, field_id: 1, value: "nnm", label: "NNM", active: false, sort_order: 10, metadata: {} },
    { id: 12, field_id: 1, value: "snv", label: "SNV", active: true, sort_order: 30, metadata: {} },
  ],
});

const front = field({
  id: 2,
  slug: "frente",
  label: "Frente",
  input_type: "select",
  options: [
    { id: 20, field_id: 2, value: "a", label: "Frente A", active: true, sort_order: 20, metadata: {} },
    { id: 21, field_id: 2, value: "b", label: "Frente B", active: true, sort_order: 10, metadata: {} },
    { id: 22, field_id: 2, value: "b2", label: "Frente B", active: true, sort_order: 30, metadata: {} },
  ],
});

const specialty = field({
  id: 3,
  slug: "especialidad",
  label: "Especialidad",
  input_type: "text",
});

const department = field({
  id: 4,
  slug: "departamento",
  label: "Departamento",
  input_type: "text",
});

const area = field({
  id: 5,
  slug: "area",
  label: "Area",
  input_type: "text",
});

const sector = field({
  id: 6,
  slug: "sector",
  label: "Sector",
  input_type: "text",
});

describe("gantt hierarchy", () => {
  it("builds a one-level hierarchy", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
        }),
      }),
    ], [level]);

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      kind: "group",
      fieldId: 1,
      optionId: 10,
      label: "NTI",
      depth: 0,
      counts: { planned: 1, real: 0, total: 1 },
    });
    expect(tree[0].rows).toHaveLength(1);
  });

  it("builds multiple configured levels and assigns rows only to terminal nodes", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [level, front, specialty]);

    expect(tree[0].rows).toEqual([]);
    expect(tree[0].children[0].rows).toEqual([]);
    expect(tree[0].children[0].children[0]).toMatchObject({
      label: "Mecanica",
      depth: 2,
      counts: { planned: 1, real: 0, total: 1 },
    });
    expect(tree[0].children[0].children[0].rows).toHaveLength(1);
  });

  it("returns an empty tree without grouping fields and does not lose the input groups", () => {
    const groups = [group()];
    const tree = buildGanttHierarchy(groups, []);

    expect(tree).toEqual([]);
    expect(groups).toHaveLength(1);
  });

  it("creates explicit missing nodes per field", () => {
    const tree = buildGanttHierarchy([group()], [level, front]);

    expect(tree[0]).toMatchObject({
      label: "Sin Nivel",
      valueKey: "field:1:missing",
      sort: expect.objectContaining({ missing: true }),
    });
    expect(tree[0].children[0]).toMatchObject({
      label: "Sin Frente",
      valueKey: "field:2:missing",
    });
  });

  it("keeps inactive existing options by option id and label", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [{ field_id: 1, option_id: 11, value: "nnm" }],
        }),
      }),
    ], [level]);

    expect(tree[0]).toMatchObject({
      label: "NNM",
      optionId: 11,
      sort: expect.objectContaining({ optionSortOrder: 10 }),
    });
  });

  it("uses historical text when a select option no longer exists", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [{ field_id: 1, option_id: 999, value: "Historico" }],
        }),
      }),
    ], [level]);

    expect(tree[0]).toMatchObject({
      label: "Historico",
      optionId: null,
      valueKey: "field:1:text:historico",
    });
  });

  it("keeps repeated labels with different option ids as distinct nodes", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "group-a",
        programado: item({
          id: 1,
          activity_group_id: "group-a",
          operational_header_values: [{ field_id: 2, option_id: 21, value: "b" }],
        }),
      }),
      group({
        activity_group_id: "group-b",
        programado: item({
          id: 2,
          activity_group_id: "group-b",
          operational_header_values: [{ field_id: 2, option_id: 22, value: "b2" }],
        }),
      }),
    ], [front]);

    expect(tree.map((node) => node.label)).toEqual(["Frente B", "Frente B"]);
    expect(tree.map((node) => node.id)).toEqual([
      "field:2:option:21",
      "field:2:option:22",
    ]);
  });

  it("groups text with stable normalization and keeps the first display label", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "group-a",
        programado: item({
          id: 1,
          activity_group_id: "group-a",
          operational_header_values: [{ field_id: 3, value: "  Mecánica  Mina " }],
        }),
      }),
      group({
        activity_group_id: "group-b",
        programado: item({
          id: 2,
          activity_group_id: "group-b",
          operational_header_values: [{ field_id: 3, value: "mecánica mina" }],
        }),
      }),
    ], [specialty]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("field:3:text:mec%C3%A1nica%20mina");
    expect(tree[0].label).toBe("Mecánica  Mina");
    expect(tree[0].counts.total).toBe(2);
  });

  it("keeps stable identity even when input order changes", () => {
    const groups = [
      group({
        activity_group_id: "group-a",
        programado: item({
          id: 1,
          activity_group_id: "group-a",
          operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
        }),
      }),
      group({
        activity_group_id: "group-b",
        programado: item({
          id: 2,
          activity_group_id: "group-b",
          operational_header_values: [{ field_id: 1, option_id: 12, value: "SNV" }],
        }),
      }),
    ];

    expect(buildGanttHierarchy(groups, [level]).map((node) => node.id)).toEqual(
      buildGanttHierarchy([...groups].reverse(), [level]).map((node) => node.id)
    );
  });

  it("uses the full path to avoid collisions between branches", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "group-a",
        programado: item({
          id: 1,
          activity_group_id: "group-a",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
      group({
        activity_group_id: "group-b",
        programado: item({
          id: 2,
          activity_group_id: "group-b",
          operational_header_values: [
            { field_id: 1, option_id: 12, value: "SNV" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
    ], [level, front]);

    expect(tree[0].children[0].id).toBe("field:1:option:10/field:2:option:20");
    expect(tree[1].children[0].id).toBe("field:1:option:12/field:2:option:20");
  });

  it("orders nodes by option sort order, text label and missing last", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({
          id: 1,
          activity_group_id: "a",
          operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
        }),
      }),
      group({
        activity_group_id: "b",
        programado: item({
          id: 2,
          activity_group_id: "b",
          operational_header_values: [{ field_id: 1, option_id: 11, value: "NNM" }],
        }),
      }),
      group({
        activity_group_id: "c",
        programado: item({ id: 3, activity_group_id: "c" }),
      }),
    ], [level]);

    expect(tree.map((node) => node.label)).toEqual(["NNM", "NTI", "Sin Nivel"]);
  });

  it("sorts activity rows by item date, start, end and id", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "late",
        programado: item({ id: 3, activity_group_id: "late", start: "10:00", end: "11:00", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
      group({
        activity_group_id: "early",
        programado: item({ id: 1, activity_group_id: "early", start: "08:00", end: "09:00", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
      group({
        activity_group_id: "middle",
        programado: item({ id: 2, activity_group_id: "middle", start: "08:00", end: "08:30", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
    ], [level]);

    expect(tree[0].rows.map((row) => row.activity_group_id)).toEqual(["middle", "early", "late"]);
  });

  it("counts visible rows by groups rather than real segment count", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "real-only",
        programado: null,
        realSegments: [
          item({ id: 2, activity_group_id: "real-only", tracking_type: "real", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
          item({ id: 3, activity_group_id: "real-only", tracking_type: "real", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
        ],
      }),
      group({
        activity_group_id: "planned-and-real",
        programado: item({ id: 1, activity_group_id: "planned-and-real", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
        realSegments: [
          item({ id: 4, activity_group_id: "planned-and-real", tracking_type: "real", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
        ],
      }),
    ], [level]);

    expect(countGanttHierarchyNodeItems(tree[0])).toEqual({
      planned: 1,
      real: 2,
      total: 2,
    });
  });

  it("resolves hierarchy row density by explicit row state", () => {
    expect(resolveGanttHierarchyRowDensity({ kind: "activity" })).toBe("activity");
    expect(resolveGanttHierarchyRowDensity({
      kind: "node",
      expanded: true,
      hasSummaryRange: false,
    })).toBe("compact");
    expect(resolveGanttHierarchyRowDensity({
      kind: "compact_path",
      expanded: true,
      hasSummaryRange: true,
    })).toBe("compact");
    expect(resolveGanttHierarchyRowDensity({
      kind: "node",
      expanded: false,
      hasSummaryRange: true,
    })).toBe("collapsed-summary");
    expect(resolveGanttHierarchyRowDensity({
      kind: "compact_path",
      expanded: false,
      hasSummaryRange: false,
    })).toBe("compact");
  });

  it("flattens only expanded branches", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
    ], [level, front]);
    const expandedRoots = getInitialExpandedGanttNodeIds(tree);

    expect(flattenVisibleGanttHierarchy(tree, expandedRoots).map((row) => row.kind)).toEqual([
      "node",
      "node",
    ]);
    expect(flattenVisibleGanttHierarchy(tree, new Set(getAllGanttHierarchyNodeIds(tree))).map((row) => row.kind)).toEqual([
      "node",
      "node",
      "activity",
    ]);
  });

  it("keeps the first two configured levels visible and fuses a single compact route into the activity row", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [level, front, department, specialty]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(VISIBLE_GANTT_GROUPING_LEVELS).toBe(2);
    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "activity"]);
    expect(rows[0]).toMatchObject({ kind: "node", node: expect.objectContaining({ label: "NTI" }), depth: 0 });
    expect(rows[1]).toMatchObject({ kind: "node", node: expect.objectContaining({ label: "Frente A" }), depth: 1 });
    expect(rows[2]).toMatchObject({
      kind: "activity",
      depth: 2,
      compactPath: {
        label: "Geologia › Mecanica",
      },
    });
  });

  it("keeps compact path labels in field order", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [department, specialty]);

    expect(getCompactGanttHierarchyPathLabel([tree[0], tree[0].children[0]])).toBe("Geologia › Mecanica");
  });

  it("keeps activities visible by default in hybrid mode", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
    ], [level, front]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "activity"]);
    expect(rows[0]).toMatchObject({ kind: "node", expanded: true });
    expect(rows[1]).toMatchObject({ kind: "node", expanded: true });
  });

  it("renders the third configured level as a compact activity subtitle when it has one terminal activity", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
          ],
        }),
      }),
    ], [level, front, department]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "activity"]);
    expect(rows[2]).toMatchObject({
      kind: "activity",
      compactPath: {
        label: "Geologia",
      },
      depth: 2,
    });
  });

  it("keeps the same visual depth pattern when datasets have different branch counts", () => {
    const todayTree = buildGanttHierarchy([
      group({
        activity_group_id: "today",
        programado: item({
          id: 1,
          activity_group_id: "today",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [level, front, department, specialty]);
    const yesterdayTree = buildGanttHierarchy([
      group({
        activity_group_id: "yesterday-a",
        programado: item({
          id: 2,
          activity_group_id: "yesterday-a",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Mineria" },
            { field_id: 3, value: "Perforacion" },
          ],
        }),
      }),
      group({
        activity_group_id: "yesterday-b",
        programado: item({
          id: 3,
          activity_group_id: "yesterday-b",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 21, value: "b" },
            { field_id: 4, value: "Servicios" },
            { field_id: 3, value: "Mantencion" },
          ],
        }),
      }),
    ], [level, front, department, specialty]);

    const todayPattern = buildCompactGanttHierarchyRows(todayTree, getInitialHybridExpandedNodeIds(todayTree))
      .map((row) => `${row.kind}:${row.depth}`);
    const yesterdayPattern = buildCompactGanttHierarchyRows(yesterdayTree, getInitialHybridExpandedNodeIds(yesterdayTree))
      .filter((row) => row.kind !== "activity")
      .map((row) => `${row.kind}:${row.depth}`);

    expect(todayPattern).toEqual(["node:0", "node:1", "activity:2"]);
    expect(yesterdayPattern).toEqual(["node:0", "node:1", "node:1"]);
  });

  it("lists multiple activities under the same visible second-level node", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({
          id: 1,
          activity_group_id: "a",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
      group({
        activity_group_id: "b",
        programado: item({
          id: 2,
          activity_group_id: "b",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
      group({
        activity_group_id: "c",
        programado: item({
          id: 3,
          activity_group_id: "c",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
    ], [level, front]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "activity", "activity", "activity"]);
    expect(rows[1]).toMatchObject({
      kind: "node",
      node: expect.objectContaining({
        label: "Frente A",
        counts: { planned: 3, real: 0, total: 3 },
      }),
    });
  });

  it("lists multiple activities once under the same compact route after the second level", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({
          id: 1,
          activity_group_id: "a",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
      group({
        activity_group_id: "b",
        programado: item({
          id: 2,
          activity_group_id: "b",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [level, front, department, specialty]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "compact_path", "activity", "activity"]);
    expect(rows[2]).toMatchObject({
      kind: "compact_path",
      label: "Geologia › Mecanica",
      node: expect.objectContaining({ counts: { planned: 2, real: 0, total: 2 } }),
    });
  });

  it("does not repeat compact route subtitles for multiple activities under the same route", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({
          id: 1,
          activity_group_id: "a",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
      group({
        activity_group_id: "b",
        programado: item({
          id: 2,
          activity_group_id: "b",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [level, front, department, specialty]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));
    const activityRows = rows.filter((row) => row.kind === "activity");

    expect(activityRows).toHaveLength(2);
    expect(activityRows.every((row) => row.compactPath === undefined)).toBe(true);
  });

  it("compacts missing values as normal hierarchy values", () => {
    const tree = buildGanttHierarchy([group()], [level, front]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(rows[0]).toMatchObject({
      kind: "node",
      node: expect.objectContaining({ label: "Sin Nivel" }),
    });
    expect(rows[1]).toMatchObject({
      kind: "node",
      node: expect.objectContaining({ label: "Sin Frente" }),
    });
    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "activity"]);
  });

  it("shows a collapsed visible node summary row without activity rows", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
          ],
        }),
      }),
    ], [level, front]);
    const rows = buildCompactGanttHierarchyRows(tree, new Set());

    expect(rows.map((row) => row.kind)).toEqual(["node"]);
    expect(rows[0]).toMatchObject({ kind: "node", expanded: false });
  });

  it("preserves deep bifurcations as separate compact paths", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "c1",
        programado: item({
          id: 1,
          activity_group_id: "c1",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
          ],
        }),
      }),
      group({
        activity_group_id: "c2",
        programado: item({
          id: 2,
          activity_group_id: "c2",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Mina" },
          ],
        }),
      }),
    ], [level, front, department]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree));

    expect(rows.map((row) => row.kind)).toEqual(["node", "node", "activity", "activity"]);
    expect(rows[0]).toMatchObject({ kind: "node", node: expect.objectContaining({ label: "NTI" }), depth: 0 });
    expect(rows[1]).toMatchObject({ kind: "node", node: expect.objectContaining({ label: "Frente A" }), depth: 1 });
    expect(rows[2]).toMatchObject({ kind: "activity", compactPath: { label: "Geologia" }, depth: 2 });
    expect(rows[3]).toMatchObject({ kind: "activity", compactPath: { label: "Mina" }, depth: 2 });
  });

  it("does not include fused compact routes in expandable ids", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "single",
        programado: item({
          id: 1,
          activity_group_id: "single",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
          ],
        }),
      }),
    ], [level, front, department]);
    const compactId = getCompactGanttHierarchyPathId([tree[0].children[0].children[0]]);

    expect(getAllGanttHierarchyExpandableIds(tree)).not.toContain(compactId);
  });

  it("builds expansion state only from rendered expandable rows", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "single",
        programado: item({
          id: 1,
          activity_group_id: "single",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Geologia" },
          ],
        }),
      }),
      group({
        activity_group_id: "multi-a",
        programado: item({
          id: 2,
          activity_group_id: "multi-a",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Mina" },
          ],
        }),
      }),
      group({
        activity_group_id: "multi-b",
        programado: item({
          id: 3,
          activity_group_id: "multi-b",
          operational_header_values: [
            { field_id: 1, option_id: 10, value: "NTI" },
            { field_id: 2, option_id: 20, value: "a" },
            { field_id: 4, value: "Mina" },
          ],
        }),
      }),
    ], [level, front, department]);
    const state = getGanttHierarchyExpansionState(tree);
    const singlePathId = getCompactGanttHierarchyPathId([tree[0].children[0].children[0]]);
    const multiPathId = getCompactGanttHierarchyPathId([tree[0].children[0].children[1]]);

    expect(state.expandableIds.has(tree[0].id)).toBe(true);
    expect(state.expandableIds.has(tree[0].children[0].id)).toBe(true);
    expect(state.expandableIds.has(singlePathId)).toBe(false);
    expect(state.expandableIds.has(multiPathId)).toBe(true);
    expect(state.initialExpandedIds).toEqual(state.expandableIds);
  });

  it("keeps compact path identity derived from node ids rather than labels", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "group-a",
        programado: item({
          id: 1,
          activity_group_id: "group-a",
          operational_header_values: [
            { field_id: 2, option_id: 21, value: "b" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
      group({
        activity_group_id: "group-b",
        programado: item({
          id: 2,
          activity_group_id: "group-b",
          operational_header_values: [
            { field_id: 2, option_id: 22, value: "b2" },
            { field_id: 3, value: "Mecanica" },
          ],
        }),
      }),
    ], [front, specialty]);
    const rows = buildCompactGanttHierarchyRows(tree, getInitialHybridExpandedNodeIds(tree))
      .filter((row) => row.kind === "node");

    expect(tree.map((node) => node.label)).toEqual(["Frente B", "Frente B"]);
    expect(getCompactGanttHierarchyPathId([tree[0], tree[0].children[0]])).not.toBe(
      getCompactGanttHierarchyPathId([tree[1], tree[1].children[0]])
    );
    expect(rows).toHaveLength(4);
  });

  it("calculates visible aggregate ranges for projected planned items and real segments", () => {
    const scale = buildGanttScale("20:00", "08:00", true);
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "planned",
        programado: item({
          id: 1,
          activity_group_id: "planned",
          shift: "Dia",
          start: "19:00",
          end: "21:00",
          operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
        }),
      }),
      group({
        activity_group_id: "real",
        programado: null,
        realSegments: [
          item({
            id: 2,
            activity_group_id: "real",
            tracking_type: "real",
            shift: "Noche",
            start: "22:00",
            end: "06:00",
            operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
          }),
        ],
      }),
    ], [level]);

    expect(getGanttHierarchyVisibleTimeRange(tree[0], "Noche", scale)).toEqual({
      start: "20:00",
      end: "06:00",
    });
  });

  it("returns null aggregate range when a branch has no visible events in the shift", () => {
    const scale = buildGanttScale("08:00", "20:00", false);
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          shift: "Noche",
          start: "22:00",
          end: "06:00",
          operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
        }),
      }),
    ], [level]);

    expect(getGanttHierarchyVisibleTimeRange(tree[0], "Dia", scale)).toBeNull();
  });

  it("reconciles expanded ids by keeping valid ids, removing orphans and adding new roots", () => {
    const initialTree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({ id: 1, activity_group_id: "a", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
      group({
        activity_group_id: "b",
        programado: item({ id: 2, activity_group_id: "b", operational_header_values: [{ field_id: 1, option_id: 12, value: "SNV" }] }),
      }),
    ], [level, front]);
    const expanded = new Set([
      initialTree[0].id,
      initialTree[0].children[0].id,
      "orphan",
    ]);
    const nextTree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({ id: 1, activity_group_id: "a", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
      group({
        activity_group_id: "c",
        programado: item({ id: 3, activity_group_id: "c", operational_header_values: [{ field_id: 1, option_id: 11, value: "NNM" }] }),
      }),
    ], [level, front]);

    const reconciled = reconcileExpandedGanttNodeIds(expanded, nextTree);

    expect(reconciled.has(initialTree[0].id)).toBe(true);
    expect(reconciled.has(initialTree[0].children[0].id)).toBe(true);
    expect(reconciled.has("orphan")).toBe(false);
    expect(reconciled.has(nextTree[0].id)).toBe(true);
  });

  it("filters invalid expanded ids without adding initial nodes", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({ operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
    ], [level]);

    expect([...filterValidExpandedGanttNodeIds(new Set([tree[0].id, "orphan"]), tree)]).toEqual([tree[0].id]);
  });

  it("compares node id sets without mutating them", () => {
    const left = new Set(["a", "b"]);
    const right = new Set(["b", "a"]);

    expect(areGanttHierarchyNodeIdSetsEqual(left, right)).toBe(true);
    expect(areGanttHierarchyNodeIdSetsEqual(left, new Set(["a"]))).toBe(false);
    expect([...left]).toEqual(["a", "b"]);
  });

  it("builds grouping field signatures from ids and ordering metadata only", () => {
    expect(getGanttGroupingFieldsSignature([
      { ...level, label: "Nivel viejo", grouping_order: null, sort_order: 20 },
      { ...front, grouping_order: 10, sort_order: 30 },
    ])).toBe("0:1:20:20|1:2:10:30");
    expect(getGanttGroupingFieldsSignature([
      { ...level, label: "Nivel nuevo", grouping_order: null, sort_order: 20 },
      { ...front, grouping_order: 10, sort_order: 30 },
    ])).toBe("0:1:20:20|1:2:10:30");
    expect(getGanttGroupingFieldsSignature([
      { ...front, grouping_order: 10, sort_order: 30 },
      { ...level, grouping_order: null, sort_order: 20 },
    ])).toBe("0:2:10:30|1:1:20:20");
  });

  it("toggles expanded state without mutating the original set", () => {
    const original = new Set(["node-1"]);
    const collapsed = toggleGanttHierarchyNode(original, "node-1");
    const expanded = toggleGanttHierarchyNode(collapsed, "node-2");

    expect(original.has("node-1")).toBe(true);
    expect(collapsed.has("node-1")).toBe(false);
    expect(expanded.has("node-2")).toBe(true);
  });

  it("serializes and parses expanded node ids safely", () => {
    expect(serializeExpandedGanttNodeIds(new Set(["b", "a"]))).toBe("[\"a\",\"b\"]");
    expect(parseExpandedGanttNodeIds("[\"a\",\"b\"]")).toEqual(new Set(["a", "b"]));
    expect(parseExpandedGanttNodeIds("{bad json")).toBeNull();
    expect(parseExpandedGanttNodeIds("[\"a\",1]")).toBeNull();
    expect(parseExpandedGanttNodeIds(null)).toBeNull();
  });

  it("builds storage keys by grouping signature and shift without dates", () => {
    expect(getGanttHierarchyStorageKey({ groupingSignature: "nivel|frente", shift: "Dia" })).toBe(
      "gantt-hierarchy:v2:nivel|frente:Dia"
    );
    expect(getGanttHierarchyStorageKey({ groupingSignature: "nivel|frente", shift: "Noche" })).toBe(
      "gantt-hierarchy:v2:nivel|frente:Noche"
    );
  });

  it("sorts hierarchy nodes without mutating the input array", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "a",
        programado: item({ id: 1, activity_group_id: "a", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
      }),
      group({
        activity_group_id: "b",
        programado: item({ id: 2, activity_group_id: "b", operational_header_values: [{ field_id: 1, option_id: 11, value: "NNM" }] }),
      }),
    ], [level]);
    const reversed = [...tree].reverse();
    const sorted = sortGanttHierarchyNodes(reversed);

    expect(reversed.map((node) => node.label)).toEqual(["NTI", "NNM"]);
    expect(sorted.map((node) => node.label)).toEqual(["NNM", "NTI"]);
  });

  it("does not mutate groups or grouping fields", () => {
    const groups = [group()];
    const fields = [level];
    const originalGroups = JSON.stringify(groups);
    const originalFields = JSON.stringify(fields);

    buildGanttHierarchy(groups, fields);

    expect(JSON.stringify(groups)).toBe(originalGroups);
    expect(JSON.stringify(fields)).toBe(originalFields);
  });

  it("keeps the same planned group as a single visible row", () => {
    const tree = buildGanttHierarchy([
      group({
        programado: item({
          operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }],
        }),
      }),
    ], [level]);

    expect(tree[0].rows).toHaveLength(1);
    expect(tree[0].counts.total).toBe(1);
  });

  it("preserves real segmented groups as they arrive", () => {
    const tree = buildGanttHierarchy([
      group({
        activity_group_id: "real-only",
        programado: null,
        realSegments: [
          item({ id: 2, activity_group_id: "real-only", tracking_type: "real", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
          item({ id: 3, activity_group_id: "real-only", tracking_type: "real", operational_header_values: [{ field_id: 1, option_id: 10, value: "NTI" }] }),
        ],
      }),
    ], [level]);

    expect(tree[0].rows[0].realSegments).toHaveLength(2);
  });

  it("builds a 1,000 group hierarchy without quadratic-looking output growth", () => {
    const groups = Array.from({ length: 1000 }, (_, index) => {
      const levelOption = index % 2 === 0 ? level.options[0] : level.options[2];
      const frontOption = index % 3 === 0 ? front.options[0] : front.options[1];

      return group({
        activity_group_id: `group-${index}`,
        programado: item({
          id: index + 1,
          activity_group_id: `group-${index}`,
          start: `${String(8 + (index % 10)).padStart(2, "0")}:00`,
          operational_header_values: [
            { field_id: 1, option_id: levelOption.id, value: levelOption.value },
            { field_id: 2, option_id: frontOption.id, value: frontOption.value },
            { field_id: 3, value: index % 5 === 0 ? "Mecanica" : "Electrica" },
          ],
        }),
      });
    });

    const tree = buildGanttHierarchy(groups, [level, front, specialty]);

    expect(tree.reduce((total, node) => total + node.counts.total, 0)).toBe(1000);
    expect(getAllGanttHierarchyNodeIds(tree).length).toBeLessThan(30);
  });

  it("builds compact rows for 100, 1,000 and 10,000 groups without duplicating visible row identities", () => {
    function buildGroups(count: number, fields: OperationalHeaderFieldDto[]) {
      return Array.from({ length: count }, (_, index) => {
        const operationalHeaderValues = fields.map((field, fieldIndex) => ({
          field_id: field.id,
          value: fieldIndex % 2 === 0
            ? `${field.slug}-${index % Math.max(2, fieldIndex + 2)}`
            : "",
        }));

        return group({
          activity_group_id: `volume-${fields.length}-${index}`,
          programado: item({
            id: index + 1,
            activity_group_id: `volume-${fields.length}-${index}`,
            start: `${String(8 + (index % 10)).padStart(2, "0")}:00`,
            operational_header_values: operationalHeaderValues,
          }),
        });
      });
    }

    const scenarios = [
      { count: 100, fields: [level] },
      { count: 1000, fields: [level, front, department, specialty] },
      { count: 10000, fields: [level, front, department, specialty, area, sector] },
    ];

    for (const scenario of scenarios) {
      const tree = buildGanttHierarchy(buildGroups(scenario.count, scenario.fields), scenario.fields);
      const expansionState = getGanttHierarchyExpansionState(tree);
      const rows = buildCompactGanttHierarchyRows(tree, expansionState.initialExpandedIds);
      const rowKeys = rows.map((row) => {
        if (row.kind === "node") return `node:${row.node.id}`;
        if (row.kind === "compact_path") return `compact:${row.id}`;
        return `activity:${row.group.activity_group_id}`;
      });

      expect(tree.reduce((total, node) => total + node.counts.total, 0)).toBe(scenario.count);
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rowKeys).size).toBe(rowKeys.length);
      expect(rows.filter((row) => row.kind === "activity")).toHaveLength(scenario.count);
    }
  });

  it("builds stable node ids from path entries without labels", () => {
    const entry: GanttGroupingPathEntry = {
      field_id: 1,
      slug: "nivel",
      label: "Nivel",
      value: "NTI",
      option_id: 10,
      option_sort_order: 20,
      input_type: "select",
      field_sort_order: 10,
    };

    expect(getGanttHierarchyNodeId(entry)).toBe("field:1:option:10");
    expect(getGanttHierarchyNodeId({
      ...entry,
      option_id: null,
      value: " Mina Norte ",
      input_type: "text",
    }, ["field:9:option:99"])).toBe("field:9:option:99/field:1:text:mina%20norte");
  });
});
