import {
  buildPlanningItemShiftProjection,
  positionMinutesInScale,
  resolveGanttGroupingPath,
  type GanttScale,
  type GanttGroupingField,
  type GanttGroupingPathEntry,
  type ShiftKey,
} from "./planning-page-helpers";
import type { PlanningGroup, PlanningItem } from "./planning-page-models";

export type GanttHierarchyPlanningItem = Pick<
  PlanningItem,
  "id" | "item_date" | "shift" | "start" | "end" | "operational_header_values"
>;

export type GanttHierarchyPlanningGroup = Pick<
  PlanningGroup,
  "key" | "activity_group_id" | "item_date" | "shift" | "category" | "item_type" | "description" | "notes"
> & {
  programado: GanttHierarchyPlanningItem | null;
  realSegments: GanttHierarchyPlanningItem[];
};

export type GanttHierarchyCounts = {
  planned: number;
  real: number;
  total: number;
};

export type GanttHierarchyNode = {
  id: string;
  kind: "group";
  fieldId: number;
  fieldSlug: string;
  fieldLabel: string;
  optionId: number | null;
  valueKey: string;
  label: string;
  depth: number;
  path: string[];
  children: GanttHierarchyNode[];
  rows: GanttHierarchyPlanningGroup[];
  counts: GanttHierarchyCounts;
  sort: {
    optionSortOrder: number | null;
    label: string;
    stableId: string;
    missing: boolean;
  };
};

export type VisibleGanttHierarchyRow =
  | {
      kind: "node";
      node: GanttHierarchyNode;
      expanded: boolean;
    }
  | {
      kind: "activity";
      group: GanttHierarchyPlanningGroup;
      depth: number;
      compactPath?: {
        id: string;
        label: string;
        nodeIds: string[];
      };
    };

export type HybridGanttHierarchyRow =
  | {
      kind: "node";
      node: GanttHierarchyNode;
      expanded: boolean;
      depth: number;
    }
  | {
      kind: "compact_path";
      id: string;
      nodeIds: string[];
      node: GanttHierarchyNode;
      pathNodes: GanttHierarchyNode[];
      label: string;
      expanded: boolean;
      depth: number;
    }
  | {
      kind: "activity";
      group: GanttHierarchyPlanningGroup;
      depth: number;
      compactPath?: {
        id: string;
        label: string;
        nodeIds: string[];
      };
    };

export type GanttHierarchyVisibleTimeRange = {
  start: string;
  end: string;
};

export type GanttHierarchyRowDensity = "compact" | "collapsed-summary" | "activity";

type MutableGanttHierarchyNode = GanttHierarchyNode & {
  childMap: Map<string, MutableGanttHierarchyNode>;
};

const MISSING_GROUP_VALUE = "Sin valor";
export const VISIBLE_GANTT_GROUPING_LEVELS = 2;

function normalizeHierarchyValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("es-CL");
}

function encodeHierarchyPart(value: string) {
  return encodeURIComponent(normalizeHierarchyValue(value));
}

function isUnresolvedSelectOption(pathEntry: GanttGroupingPathEntry) {
  return pathEntry.input_type === "select" &&
    pathEntry.option_id !== null &&
    pathEntry.option_id !== undefined &&
    pathEntry.option_sort_order === null;
}

function getNodePart(pathEntry: GanttGroupingPathEntry) {
  if (
    pathEntry.option_id !== null &&
    pathEntry.option_id !== undefined &&
    !isUnresolvedSelectOption(pathEntry)
  ) {
    return `field:${pathEntry.field_id}:option:${pathEntry.option_id}`;
  }

  const normalizedValue = normalizeHierarchyValue(pathEntry.value);

  if (!normalizedValue || pathEntry.value === MISSING_GROUP_VALUE) {
    return `field:${pathEntry.field_id}:missing`;
  }

  return `field:${pathEntry.field_id}:text:${encodeHierarchyPart(pathEntry.value)}`;
}

export function getGanttHierarchyNodeId(
  pathEntry: GanttGroupingPathEntry,
  ancestors: string[] = []
) {
  return [...ancestors, getNodePart(pathEntry)].join("/");
}

function getHierarchyLabel(pathEntry: GanttGroupingPathEntry) {
  if (pathEntry.value === MISSING_GROUP_VALUE || !pathEntry.value.trim()) {
    return `Sin ${pathEntry.label}`;
  }

  return pathEntry.value;
}

function toMutableNode(input: {
  id: string;
  pathEntry: GanttGroupingPathEntry;
  depth: number;
  ancestors: string[];
}): MutableGanttHierarchyNode {
  const label = getHierarchyLabel(input.pathEntry);
  const missing = !input.pathEntry.value.trim() || input.pathEntry.value === MISSING_GROUP_VALUE;

  return {
    id: input.id,
    kind: "group",
    fieldId: input.pathEntry.field_id,
    fieldSlug: input.pathEntry.slug,
    fieldLabel: input.pathEntry.label,
    optionId: isUnresolvedSelectOption(input.pathEntry) ? null : input.pathEntry.option_id ?? null,
    valueKey: getNodePart(input.pathEntry),
    label,
    depth: input.depth,
    path: [...input.ancestors, input.id],
    children: [],
    rows: [],
    counts: {
      planned: 0,
      real: 0,
      total: 0,
    },
    sort: {
      optionSortOrder: input.pathEntry.option_sort_order ?? null,
      label,
      stableId: input.id,
      missing,
    },
    childMap: new Map(),
  };
}

function incrementCounts(node: GanttHierarchyNode, group: GanttHierarchyPlanningGroup) {
  if (group.programado) {
    node.counts.planned += 1;
  }

  if (group.realSegments.length > 0) {
    node.counts.real += 1;
  }

  node.counts.total += 1;
}

function comparePlanningGroups(left: GanttHierarchyPlanningGroup, right: GanttHierarchyPlanningGroup) {
  const leftItem = left.programado ?? left.realSegments[0] ?? null;
  const rightItem = right.programado ?? right.realSegments[0] ?? null;
  const leftKey = leftItem
    ? `${leftItem.item_date}-${leftItem.start}-${leftItem.end}-${leftItem.id}`
    : `${left.item_date}-${left.activity_group_id}`;
  const rightKey = rightItem
    ? `${rightItem.item_date}-${rightItem.start}-${rightItem.end}-${rightItem.id}`
    : `${right.item_date}-${right.activity_group_id}`;

  return leftKey.localeCompare(rightKey, "es-CL");
}

export function sortGanttHierarchyNodes(nodes: GanttHierarchyNode[]): GanttHierarchyNode[] {
  return [...nodes]
    .sort((left, right) => {
      if (left.sort.missing !== right.sort.missing) {
        return left.sort.missing ? 1 : -1;
      }

      if (
        left.sort.optionSortOrder !== null &&
        right.sort.optionSortOrder !== null &&
        left.sort.optionSortOrder !== right.sort.optionSortOrder
      ) {
        return left.sort.optionSortOrder - right.sort.optionSortOrder;
      }

      return normalizeHierarchyValue(left.sort.label).localeCompare(
        normalizeHierarchyValue(right.sort.label),
        "es-CL"
      ) || left.sort.stableId.localeCompare(right.sort.stableId, "es-CL");
    })
    .map((node) => ({
      ...node,
      children: sortGanttHierarchyNodes(node.children),
      rows: [...node.rows].sort(comparePlanningGroups),
    }));
}

function stripMutableNode(node: MutableGanttHierarchyNode): GanttHierarchyNode {
  const cleanNode = { ...node };
  delete (cleanNode as Partial<MutableGanttHierarchyNode>).childMap;

  return {
    ...cleanNode,
    children: node.children.map((child) => stripMutableNode(child as MutableGanttHierarchyNode)),
    rows: [...node.rows],
    counts: { ...node.counts },
    sort: { ...node.sort },
    path: [...node.path],
  };
}

export function countGanttHierarchyNodeItems(node: Pick<GanttHierarchyNode, "counts">) {
  return { ...node.counts };
}

export function resolveGanttHierarchyRowDensity(input:
  | { kind: "activity" }
  | { kind: "node" | "compact_path"; expanded: boolean; hasSummaryRange: boolean }
): GanttHierarchyRowDensity {
  if (input.kind === "activity") {
    return "activity";
  }

  return input.expanded || !input.hasSummaryRange ? "compact" : "collapsed-summary";
}

/**
 * Builds hierarchy from PlanningGroup values already visible for the current shift.
 * It does not filter by shift, project planned bars, or split real segments.
 */
export function buildGanttHierarchy(
  groups: GanttHierarchyPlanningGroup[],
  groupingFields: GanttGroupingField[]
): GanttHierarchyNode[] {
  if (!groupingFields.length) {
    return [];
  }

  const rootMap = new Map<string, MutableGanttHierarchyNode>();
  const roots: MutableGanttHierarchyNode[] = [];

  for (const group of groups) {
    const path = resolveGanttGroupingPath(
      group.programado ?? group.realSegments[0] ?? { operational_header_values: [] },
      groupingFields
    );
    let currentMap = rootMap;
    let currentNodes = roots;
    let ancestors: string[] = [];
    let terminalNode: MutableGanttHierarchyNode | null = null;

    for (const [depth, pathEntry] of path.entries()) {
      const nodeId = getGanttHierarchyNodeId(pathEntry, ancestors);
      let node = currentMap.get(nodeId);

      if (!node) {
        node = toMutableNode({
          id: nodeId,
          pathEntry,
          depth,
          ancestors,
        });
        currentMap.set(nodeId, node);
        currentNodes.push(node);
      }

      incrementCounts(node, group);
      terminalNode = node;
      ancestors = [...ancestors, nodeId];
      currentMap = node.childMap;
      currentNodes = node.children as MutableGanttHierarchyNode[];
    }

    if (terminalNode) {
      terminalNode.rows.push(group);
    }
  }

  return sortGanttHierarchyNodes(roots.map(stripMutableNode));
}

export function flattenVisibleGanttHierarchy(
  tree: GanttHierarchyNode[],
  expandedNodeIds: ReadonlySet<string>
): VisibleGanttHierarchyRow[] {
  const rows: VisibleGanttHierarchyRow[] = [];

  function visit(node: GanttHierarchyNode) {
    const expanded = expandedNodeIds.has(node.id);
    rows.push({ kind: "node", node, expanded });

    if (!expanded) {
      return;
    }

    for (const child of node.children) {
      visit(child);
    }

    for (const group of node.rows) {
      rows.push({ kind: "activity", group, depth: node.depth + 1 });
    }
  }

  for (const node of tree) {
    visit(node);
  }

  return rows;
}

export function getInitialExpandedGanttNodeIds(tree: GanttHierarchyNode[]) {
  return new Set(tree.map((node) => node.id));
}

export function getInitialHybridExpandedNodeIds(tree: GanttHierarchyNode[]) {
  return new Set(getAllGanttHierarchyExpandableIds(tree));
}

export function areGanttHierarchyNodeIdSetsEqual(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
) {
  if (left.size !== right.size) {
    return false;
  }

  for (const id of left) {
    if (!right.has(id)) {
      return false;
    }
  }

  return true;
}

export function reconcileExpandedGanttNodeIds(
  currentExpandedIds: ReadonlySet<string>,
  tree: GanttHierarchyNode[],
  initialExpandedIds = getInitialExpandedGanttNodeIds(tree)
) {
  const validIds = new Set(getAllGanttHierarchyNodeIds(tree));
  const next = new Set<string>();

  for (const id of currentExpandedIds) {
    if (validIds.has(id)) {
      next.add(id);
    }
  }

  for (const id of initialExpandedIds) {
    if (validIds.has(id)) {
      next.add(id);
    }
  }

  return next;
}

export function filterValidExpandedGanttNodeIds(
  currentExpandedIds: ReadonlySet<string>,
  tree: GanttHierarchyNode[],
  validIds = new Set(getAllGanttHierarchyExpandableIds(tree))
) {
  const next = new Set<string>();

  for (const id of currentExpandedIds) {
    if (validIds.has(id)) {
      next.add(id);
    }
  }

  return next;
}

export function getGanttGroupingFieldsSignature(groupingFields: GanttGroupingField[]) {
  return groupingFields
    .map((field, index) => `${index}:${field.id}:${field.grouping_order ?? field.sort_order}:${field.sort_order}`)
    .join("|");
}

export function toggleGanttHierarchyNode(
  expandedNodeIds: ReadonlySet<string>,
  nodeId: string
) {
  const next = new Set(expandedNodeIds);

  if (next.has(nodeId)) {
    next.delete(nodeId);
  } else {
    next.add(nodeId);
  }

  return next;
}

export function getAllGanttHierarchyNodeIds(tree: GanttHierarchyNode[]) {
  const ids: string[] = [];

  function visit(node: GanttHierarchyNode) {
    ids.push(node.id);
    node.children.forEach(visit);
  }

  tree.forEach(visit);
  return ids;
}

export function getAllGanttHierarchyExpandableIds(tree: GanttHierarchyNode[]) {
  const ids: string[] = [];

  function visitNodeList(nodes: GanttHierarchyNode[]) {
    for (const node of nodes) {
      if (shouldCompactGanttHierarchyNode(node)) {
        for (const pathNodes of collectCompactTerminalPaths(node, [node])) {
          const terminalNode = pathNodes[pathNodes.length - 1];

          if (terminalNode.rows.length === 1 && terminalNode.children.length === 0) {
            continue;
          }

          ids.push(getCompactGanttHierarchyPathId(pathNodes));
        }
      } else {
        ids.push(node.id);
        visitNodeList(node.children);
      }
    }
  }

  visitNodeList(tree);
  return ids;
}

export function getGanttHierarchyExpansionState(tree: GanttHierarchyNode[]) {
  const expandableIds = new Set(getAllGanttHierarchyExpandableIds(tree));

  return {
    expandableIds,
    initialExpandedIds: new Set(expandableIds),
  };
}

export function getCompactGanttHierarchyPathLabel(pathNodes: GanttHierarchyNode[]) {
  return pathNodes.map((node) => node.label).join(" › ");
}

export function getCompactGanttHierarchyPathId(pathNodes: GanttHierarchyNode[]) {
  return `compact:${pathNodes.map((node) => node.id).join("~")}`;
}

export function shouldCompactGanttHierarchyNode(node: GanttHierarchyNode) {
  return node.depth >= VISIBLE_GANTT_GROUPING_LEVELS;
}

function collectCompactTerminalPaths(
  node: GanttHierarchyNode,
  pathNodes: GanttHierarchyNode[]
): GanttHierarchyNode[][] {
  const terminalPaths: GanttHierarchyNode[][] = [];

  if (node.rows.length > 0 || node.children.length === 0) {
    terminalPaths.push(pathNodes);
  }

  for (const child of node.children) {
    terminalPaths.push(...collectCompactTerminalPaths(child, [...pathNodes, child]));
  }

  return terminalPaths;
}

export function buildCompactGanttHierarchyRows(
  tree: GanttHierarchyNode[],
  expandedNodeIds: ReadonlySet<string>
): HybridGanttHierarchyRow[] {
  const rows: HybridGanttHierarchyRow[] = [];

  function pushActivities(
    node: GanttHierarchyNode,
    depth: number,
    compactPath?: Extract<HybridGanttHierarchyRow, { kind: "activity" }>["compactPath"]
  ) {
    for (const group of node.rows) {
      rows.push({ kind: "activity", group, depth, compactPath });
    }
  }

  function pushCompactPath(pathNodes: GanttHierarchyNode[], visualDepth: number) {
    const terminalNode = pathNodes[pathNodes.length - 1];
    const compactPathId = getCompactGanttHierarchyPathId(pathNodes);
    const compactPath = {
      id: compactPathId,
      label: getCompactGanttHierarchyPathLabel(pathNodes),
      nodeIds: pathNodes.map((node) => node.id),
    };

    if (terminalNode.rows.length === 1 && terminalNode.children.length === 0) {
      pushActivities(terminalNode, visualDepth, compactPath);
      return;
    }

    const expanded = expandedNodeIds.has(compactPathId) || expandedNodeIds.has(terminalNode.id);

    rows.push({
      kind: "compact_path",
      id: compactPathId,
      nodeIds: compactPath.nodeIds,
      node: terminalNode,
      pathNodes,
      label: compactPath.label,
      expanded,
      depth: visualDepth,
    });

    if (expanded) {
      visitNodeList(terminalNode.children, visualDepth + 1);
      pushActivities(terminalNode, visualDepth + 1);
    }
  }

  function visit(node: GanttHierarchyNode, visualDepth: number) {
    const expanded = expandedNodeIds.has(node.id);

    rows.push({ kind: "node", node, expanded, depth: visualDepth });

    if (!expanded) {
      return;
    }

    visitNodeList(node.children, visualDepth + 1);
    pushActivities(node, visualDepth + 1);
  }

  function visitNodeList(nodes: GanttHierarchyNode[], visualDepth: number) {
    for (const node of nodes) {
      if (shouldCompactGanttHierarchyNode(node)) {
        for (const pathNodes of collectCompactTerminalPaths(node, [node])) {
          pushCompactPath(pathNodes, visualDepth);
        }
      } else {
        visit(node, visualDepth);
      }
    }
  }

  visitNodeList(tree, 0);

  return rows;
}

function collectGroupsForNode(node: GanttHierarchyNode): GanttHierarchyPlanningGroup[] {
  const groups = [...node.rows];

  for (const child of node.children) {
    groups.push(...collectGroupsForNode(child));
  }

  return groups;
}

function toTimeLabel(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function getVisibleRangeForTimes(input: { start: string; end: string }, scale: GanttScale) {
  const start = positionMinutesInScale(input.start, scale);
  let end = positionMinutesInScale(input.end, scale);

  if (end <= start) {
    end += 24 * 60;
  }

  const visibleStart = Math.max(start, scale.startMinutes);
  const visibleEnd = Math.min(end, scale.endMinutes);

  if (visibleEnd <= visibleStart) {
    return null;
  }

  return {
    start: visibleStart,
    end: visibleEnd,
  };
}

export function getGanttHierarchyVisibleTimeRange(
  node: GanttHierarchyNode,
  viewedShift: ShiftKey,
  scale: GanttScale
): GanttHierarchyVisibleTimeRange | null {
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;

  for (const group of collectGroupsForNode(node)) {
    if (group.programado) {
      const projection = buildPlanningItemShiftProjection(group.programado, viewedShift);
      const visibleRange = projection ? getVisibleRangeForTimes(projection, scale) : null;

      if (visibleRange) {
        minStart = Math.min(minStart, visibleRange.start);
        maxEnd = Math.max(maxEnd, visibleRange.end);
      }
    }

    for (const segment of group.realSegments) {
      if (segment.shift !== viewedShift) {
        continue;
      }

      const visibleRange = getVisibleRangeForTimes(segment, scale);

      if (visibleRange) {
        minStart = Math.min(minStart, visibleRange.start);
        maxEnd = Math.max(maxEnd, visibleRange.end);
      }
    }
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd) || maxEnd <= minStart) {
    return null;
  }

  return {
    start: toTimeLabel(minStart),
    end: toTimeLabel(maxEnd),
  };
}

export function serializeExpandedGanttNodeIds(expandedNodeIds: ReadonlySet<string>) {
  return JSON.stringify([...expandedNodeIds].sort((left, right) => left.localeCompare(right, "es-CL")));
}

export function parseExpandedGanttNodeIds(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
      return null;
    }

    return new Set(parsed);
  } catch {
    return null;
  }
}

export function getGanttHierarchyStorageKey(input: { groupingSignature: string; shift: ShiftKey }) {
  return `gantt-hierarchy:v2:${input.groupingSignature || "none"}:${input.shift}`;
}
