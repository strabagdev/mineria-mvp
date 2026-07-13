import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GanttLegend } from "./gantt-legend";
import { GanttRowMeta } from "./gantt-row-meta";
import {
  areGanttHierarchyNodeIdSetsEqual,
  buildCompactGanttHierarchyRows,
  buildGanttHierarchy,
  filterValidExpandedGanttNodeIds,
  getGanttHierarchyExpansionState,
  getGanttHierarchyStorageKey,
  getGanttHierarchyVisibleTimeRange,
  getGanttGroupingFieldsSignature,
  getInitialHybridExpandedNodeIds,
  parseExpandedGanttNodeIds,
  resolveGanttHierarchyRowDensity,
  serializeExpandedGanttNodeIds,
  toggleGanttHierarchyNode,
} from "../../modules/planning/presentation/gantt-hierarchy";
import {
  buildGanttBarPlacement,
  buildPlanningItemShiftProjection,
  type GanttGroupingField,
  type GanttGroupingPathEntry,
} from "../../modules/planning/presentation/planning-page-helpers";
import type { PlanningItemOperationalHeaderValueDto } from "../../modules/planning/contracts/planning-items";

type ShiftKey = "Dia" | "Noche";

type GanttPlanningItem = {
  id: number;
  item_date: string;
  shift: string;
  start: string;
  end: string;
  tracking_type?: string;
  operational_header_values?: PlanningItemOperationalHeaderValueDto[];
  gantt_projection?: {
    start: string;
    end: string;
  };
};

type GanttPlanningGroup<TItem extends GanttPlanningItem> = {
  key: string;
  activity_group_id: string;
  item_date: string;
  shift: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  notes?: string | null;
  programado: TItem | null;
  realSegments: TItem[];
  gantt_group_path?: GanttGroupingPathEntry[];
};

type GanttScale = {
  startMinutes: number;
  endMinutes: number;
  slotMinutes: number;
  slotCount: number;
  endLabel: string;
  hourMarks: {
    key: string;
    label: string;
    major: boolean;
  }[];
};

type GanttCurrentTimeMarker = {
  offsetPercent: number;
  label: string;
  timeLabel: string;
};

export type GanttHierarchyViewControls = {
  canExpandAll: boolean;
  canCollapseAll: boolean;
  expandAll: () => void;
  collapseAll: () => void;
};

type GanttShiftSectionProps<
  TItem extends GanttPlanningItem,
  TGroup extends GanttPlanningGroup<TItem>,
> = {
  shift: ShiftKey;
  groups: TGroup[];
  scale: GanttScale;
  groupingFields?: GanttGroupingField[];
  currentTimeMarker?: GanttCurrentTimeMarker | null;
  renderBar: (item: TItem | null, layer: "programado" | "real", scale: GanttScale) => ReactNode;
  renderAssignmentIndicators?: (item: TItem | null) => ReactNode;
  renderCreateRealButton: (group: TGroup) => ReactNode;
  onHierarchyViewControlsChange?: (controls: GanttHierarchyViewControls) => void;
};

export function GanttShiftSection<
  TItem extends GanttPlanningItem,
  TGroup extends GanttPlanningGroup<TItem>,
>({
  shift,
  groups,
  scale,
  groupingFields = [],
  currentTimeMarker,
  renderBar,
  renderAssignmentIndicators,
  renderCreateRealButton,
  onHierarchyViewControlsChange,
}: GanttShiftSectionProps<TItem, TGroup>) {
  const hierarchyTree = useMemo(
    () => groupingFields.length ? buildGanttHierarchy(groups, groupingFields) : [],
    [groupingFields, groups]
  );
  const groupingFieldsSignature = useMemo(
    () => getGanttGroupingFieldsSignature(groupingFields),
    [groupingFields]
  );
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() =>
    getInitialHybridExpandedNodeIds(hierarchyTree)
  );
  const expansionState = useMemo(
    () => getGanttHierarchyExpansionState(hierarchyTree),
    [hierarchyTree]
  );
  const previousStorageKey = useRef<string | null>(null);
  const knownNodeIds = useRef<Set<string>>(new Set());
  const persistedExpansion = useRef<{ key: string; value: string } | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const storageKey = useMemo(
    () => getGanttHierarchyStorageKey({ groupingSignature: groupingFieldsSignature, shift }),
    [groupingFieldsSignature, shift]
  );

  useEffect(() => {
    const validNodeIds = expansionState.expandableIds;
    const initialExpandedNodeIds = expansionState.initialExpandedIds;
    const keyChanged = previousStorageKey.current !== storageKey;

    setExpandedNodeIds((currentExpandedNodeIds) => {
      if (typeof window !== "undefined" && keyChanged) {
        const storedExpandedNodeIds = parseExpandedGanttNodeIds(window.localStorage.getItem(storageKey));
        const nextExpandedNodeIds = storedExpandedNodeIds
          ? filterValidExpandedGanttNodeIds(storedExpandedNodeIds, hierarchyTree, validNodeIds)
          : initialExpandedNodeIds;

        previousStorageKey.current = storageKey;
        knownNodeIds.current = validNodeIds;

        return areGanttHierarchyNodeIdSetsEqual(currentExpandedNodeIds, nextExpandedNodeIds)
          ? currentExpandedNodeIds
          : nextExpandedNodeIds;
      }

      const nextExpandedNodeIds = filterValidExpandedGanttNodeIds(currentExpandedNodeIds, hierarchyTree, validNodeIds);

      for (const id of initialExpandedNodeIds) {
        if (!knownNodeIds.current.has(id)) {
          nextExpandedNodeIds.add(id);
        }
      }

      previousStorageKey.current = storageKey;
      knownNodeIds.current = validNodeIds;

      return areGanttHierarchyNodeIdSetsEqual(currentExpandedNodeIds, nextExpandedNodeIds)
        ? currentExpandedNodeIds
        : nextExpandedNodeIds;
    });
    setStorageReady(true);
  }, [expansionState, hierarchyTree, storageKey]);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") {
      return;
    }

    const serializedExpandedNodeIds = serializeExpandedGanttNodeIds(expandedNodeIds);

    if (
      persistedExpansion.current?.key === storageKey &&
      persistedExpansion.current.value === serializedExpandedNodeIds
    ) {
      return;
    }

    window.localStorage.setItem(storageKey, serializedExpandedNodeIds);
    persistedExpansion.current = {
      key: storageKey,
      value: serializedExpandedNodeIds,
    };
  }, [expandedNodeIds, storageKey, storageReady]);

  const visibleHierarchyRows = useMemo(
    () => buildCompactGanttHierarchyRows(hierarchyTree, expandedNodeIds),
    [expandedNodeIds, hierarchyTree]
  );
  const expandableNodeIds = expansionState.expandableIds;
  const expandableNodeIdsRef = useRef(expandableNodeIds);
  useEffect(() => {
    expandableNodeIdsRef.current = expandableNodeIds;
  }, [expandableNodeIds]);
  const visibleExpandedNodeIds = useMemo(
    () => filterValidExpandedGanttNodeIds(expandedNodeIds, hierarchyTree, expandableNodeIds),
    [expandableNodeIds, expandedNodeIds, hierarchyTree]
  );
  const hierarchyEnabled = groupingFields.length > 0 && hierarchyTree.length > 0;
  const hasGroupingConfiguration = groupingFields.length > 0;
  const canExpandAllHierarchyNodes = hierarchyEnabled &&
    !areGanttHierarchyNodeIdSetsEqual(visibleExpandedNodeIds, expandableNodeIds);
  const canCollapseAllHierarchyNodes = hierarchyEnabled && visibleExpandedNodeIds.size > 0;
  const handleToggleHierarchyNode = useCallback((nodeId: string) => {
    setExpandedNodeIds((current) => toggleGanttHierarchyNode(current, nodeId));
  }, []);
  const handleExpandAllHierarchyNodes = useCallback(() => {
    setExpandedNodeIds(new Set(expandableNodeIdsRef.current));
  }, []);
  const handleCollapseAllHierarchyNodes = useCallback(() => {
    setExpandedNodeIds(new Set());
  }, []);
  const hierarchyActions = useMemo(() => ({
    toggle: handleToggleHierarchyNode,
    expandAll: handleExpandAllHierarchyNodes,
    collapseAll: handleCollapseAllHierarchyNodes,
  }), [handleCollapseAllHierarchyNodes, handleExpandAllHierarchyNodes, handleToggleHierarchyNode]);
  const hierarchyViewControls = useMemo<GanttHierarchyViewControls>(() => ({
    canExpandAll: canExpandAllHierarchyNodes,
    canCollapseAll: canCollapseAllHierarchyNodes,
    expandAll: handleExpandAllHierarchyNodes,
    collapseAll: handleCollapseAllHierarchyNodes,
  }), [
    canCollapseAllHierarchyNodes,
    canExpandAllHierarchyNodes,
    handleCollapseAllHierarchyNodes,
    handleExpandAllHierarchyNodes,
  ]);

  useEffect(() => {
    onHierarchyViewControlsChange?.(hierarchyViewControls);
  }, [hierarchyViewControls, onHierarchyViewControlsChange]);

  function formatNodeCountLabel(count: number) {
    return `${count} ${count === 1 ? "actividad" : "actividades"}`;
  }

  function formatNodeCountTooltip(counts: { planned: number; real: number }) {
    const plannedLabel = `${counts.planned} ${counts.planned === 1 ? "programada" : "programadas"}`;
    const realLabel = `${counts.real} ${counts.real === 1 ? "con real" : "con reales"}`;
    return `${plannedLabel} · ${realLabel}`;
  }

  function isInteractiveElement(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest("button, a, input, select, textarea, [role='button']"));
  }

  function handleHierarchyRowClick(event: MouseEvent<HTMLElement>, nodeId: string) {
    if (isInteractiveElement(event.target)) {
      return;
    }

    hierarchyActions.toggle(nodeId);
  }

  function getHierarchyRowDensityClass(density: ReturnType<typeof resolveGanttHierarchyRowDensity>) {
    return `gantt-hierarchy-row--${density}`;
  }

  function renderActivityRow(group: TGroup, input: { depth: number; showLaneLabels: boolean; compactPathLabel?: string }) {
    const realSegmentsForShift = group.realSegments.filter((segment) => segment.shift === shift);
    const plannedProjection = group.programado
      ? buildPlanningItemShiftProjection(group.programado, shift)
      : null;
    const plannedItemForShift = group.programado && plannedProjection
      ? { ...group.programado, gantt_projection: plannedProjection }
      : null;
    const activityName = String(group.description ?? "").trim() || group.item_type;

    return (
      <article
        key={`activity-${group.key}`}
        className={[
          "gantt-row",
          "gantt-row-dual",
          "gantt-hierarchy-activity-row",
          getHierarchyRowDensityClass(resolveGanttHierarchyRowDensity({ kind: "activity" })),
        ].join(" ")}
        style={{ "--gantt-tree-depth": String(input.depth) } as CSSProperties}
      >
        <div className="gantt-meta">
          <GanttRowMeta
            title={activityName}
            subtitle={input.compactPathLabel}
            assignmentIndicators={renderAssignmentIndicators?.(plannedItemForShift)}
            action={renderCreateRealButton(group)}
          />
        </div>

        <div className="gantt-track gantt-track-compare">
          <div className="gantt-track-scale">
            {currentTimeMarker ? (
              <span
                className="gantt-now-track-line"
                style={{ left: `${currentTimeMarker.offsetPercent}%` }}
                aria-hidden="true"
              />
            ) : null}
            {input.showLaneLabels ? (
              <>
                <span className="gantt-lane-label programado" aria-hidden="true">
                  Plan
                </span>
                <span className="gantt-lane-label real" aria-hidden="true">
                  Eventos
                </span>
              </>
            ) : null}
            {renderBar(plannedItemForShift, "programado", scale)}
            {realSegmentsForShift.map((segment) => (
              <Fragment key={`real-segment-${segment.id}`}>
                {renderBar(segment, "real", scale)}
              </Fragment>
            ))}
          </div>
        </div>
      </article>
    );
  }

  function renderSummaryRangeBar(
    timeRange: NonNullable<ReturnType<typeof getGanttHierarchyVisibleTimeRange>>,
    label: string
  ) {
    const placement = timeRange ? buildGanttBarPlacement(timeRange.start, timeRange.end, scale) : null;

    if (!placement) {
      return null;
    }

    return (
      <span
        className="gantt-summary-bar"
        style={{ left: `${placement.leftPercent}%`, width: `${placement.widthPercent}%` }}
        title={`${label}: rango visible de las actividades contenidas, ${timeRange.start} - ${timeRange.end}`}
        aria-label={`${label}: rango visible de las actividades contenidas ${timeRange.start} a ${timeRange.end}`}
      >
        <span aria-hidden="true">{timeRange.start} - {timeRange.end}</span>
      </span>
    );
  }

  function renderHierarchyNodeRow(row: Extract<(typeof visibleHierarchyRows)[number], { kind: "node" }>) {
    const { node, expanded } = row;
    const countLabel = formatNodeCountLabel(node.counts.total);
    const summaryRange = !expanded ? getGanttHierarchyVisibleTimeRange(node, shift, scale) : null;
    const hasSummaryRange = Boolean(summaryRange);

    return (
      <article
        key={`node-${node.id}`}
        className={[
          "gantt-row",
          "gantt-hierarchy-node-row",
          "gantt-hierarchy-row--group",
          getHierarchyRowDensityClass(resolveGanttHierarchyRowDensity({ kind: "node", expanded, hasSummaryRange })),
          expanded ? "expanded" : "collapsed",
        ].join(" ")}
        style={{ "--gantt-tree-depth": String(row.depth) } as CSSProperties}
        onClick={(event) => handleHierarchyRowClick(event, node.id)}
      >
        <div className="gantt-meta">
          <button
            type="button"
            className="gantt-hierarchy-node-button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Colapsar" : "Expandir"} ${node.label}`}
            title={`${expanded ? "Colapsar" : "Expandir"} ${node.label}`}
            onClick={(event) => {
              event.stopPropagation();
              hierarchyActions.toggle(node.id);
            }}
          >
            <span className="gantt-hierarchy-chevron" aria-hidden="true">
              {expanded ? "▾" : "▸"}
            </span>
            <span className="gantt-hierarchy-node-text">
              <span className="gantt-hierarchy-node-label">{node.label}</span>
              <span className="gantt-hierarchy-node-field">{node.fieldLabel}</span>
            </span>
            <span className="gantt-hierarchy-node-count" title={formatNodeCountTooltip(node.counts)}>
              {countLabel}
            </span>
          </button>
        </div>
        <div className="gantt-track gantt-hierarchy-node-track" aria-hidden="true">
          <div className="gantt-hierarchy-node-rule" />
          {summaryRange ? renderSummaryRangeBar(summaryRange, node.label) : null}
        </div>
      </article>
    );
  }

  function renderCompactPathRow(row: Extract<(typeof visibleHierarchyRows)[number], { kind: "compact_path" }>) {
    const countLabel = `${row.node.counts.total} ${row.node.counts.total === 1 ? "actividad" : "actividades"}`;
    const summaryRange = !row.expanded ? getGanttHierarchyVisibleTimeRange(row.node, shift, scale) : null;
    const hasSummaryRange = Boolean(summaryRange);

    return (
      <article
        key={`compact-${row.id}`}
        className={[
          "gantt-row",
          "gantt-hierarchy-node-row",
          "gantt-hierarchy-compact-row",
          "gantt-hierarchy-row--compact-path",
          getHierarchyRowDensityClass(resolveGanttHierarchyRowDensity({
            kind: "compact_path",
            expanded: row.expanded,
            hasSummaryRange,
          })),
          row.expanded ? "expanded" : "collapsed",
        ].join(" ")}
        style={{ "--gantt-tree-depth": String(row.depth) } as CSSProperties}
        onClick={(event) => handleHierarchyRowClick(event, row.id)}
      >
        <div className="gantt-meta">
          <button
            type="button"
            className="gantt-hierarchy-node-button"
            aria-expanded={row.expanded}
            aria-label={`${row.expanded ? "Colapsar" : "Expandir"} ${row.label}`}
            title={`${row.expanded ? "Colapsar" : "Expandir"} ${row.label}`}
            onClick={(event) => {
              event.stopPropagation();
              hierarchyActions.toggle(row.id);
            }}
          >
            <span className="gantt-hierarchy-chevron" aria-hidden="true">
              {row.expanded ? "▾" : "▸"}
            </span>
            <span className="gantt-hierarchy-node-text">
              <span className="gantt-hierarchy-node-label">{row.label}</span>
              <span className="gantt-hierarchy-node-field">
                {row.pathNodes.map((node) => node.fieldLabel).join(" › ")}
              </span>
            </span>
            <span className="gantt-hierarchy-node-count" title={formatNodeCountTooltip(row.node.counts)}>
              {countLabel}
            </span>
          </button>
        </div>
        <div className="gantt-track gantt-hierarchy-node-track" aria-hidden="true">
          <div className="gantt-hierarchy-node-rule" />
          {summaryRange ? renderSummaryRangeBar(summaryRange, row.label) : null}
        </div>
      </article>
    );
  }

  return (
    <section
      className="gantt-section shift-section"
      data-hierarchy-enabled={groupingFields.length ? "true" : undefined}
      data-hierarchy-actions-ready={groupingFields.length && Object.keys(hierarchyActions).length === 3 ? "true" : undefined}
      data-visible-hierarchy-rows={groupingFields.length ? visibleHierarchyRows.length : undefined}
    >
      <div className="gantt-header">
        <div className="gantt-header-meta">Evento</div>
        <div className="gantt-timeline-scroll">
          <div
            className="gantt-header-timeline"
            style={{ gridTemplateColumns: `repeat(${scale.slotCount}, minmax(0, 1fr)) auto` }}
          >
            {scale.hourMarks.map((mark, index) => (
              <span
                key={`${shift}-${mark.key}`}
                className={[
                  mark.major ? "major" : "minor",
                  mark.major && index === 0 ? "first-major" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {mark.major ? <span className="gantt-hour-label">{mark.label}</span> : null}
              </span>
            ))}
            <span className="gantt-end-label" aria-hidden="true">
              <span className="gantt-hour-label">{scale.endLabel}</span>
            </span>
            {currentTimeMarker ? (
              <span
                className="gantt-now-header-marker"
                style={{ left: `${currentTimeMarker.offsetPercent}%` }}
                aria-hidden="true"
              >
                <span className="gantt-now-label">
                  {currentTimeMarker.label}
                  <span>{currentTimeMarker.timeLabel}</span>
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="gantt-rows"
        style={
          {
            "--gantt-slot-count": String(scale.slotCount),
          } as CSSProperties
        }
      >
        <div className="gantt-rows-timeline-bg" aria-hidden="true" />
        {currentTimeMarker ? (
          <div className="gantt-now-overlay" aria-hidden="true">
            <span
              className="gantt-now-line"
              style={{ left: `${currentTimeMarker.offsetPercent}%` }}
            />
          </div>
        ) : null}

        {!hasGroupingConfiguration ? (
          <div className="shift-empty-state gantt-empty-state">
            <p className="ops-copy">El Gantt no tiene campos configurados para agrupación.</p>
            <p className="muted-copy">Configura campos agrupables y visibles en Gantt desde el Catálogo.</p>
          </div>
        ) : hierarchyEnabled ? (
          (() => {
            let activityIndex = 0;

            return visibleHierarchyRows.map((row) => {
              if (row.kind === "node") {
                return renderHierarchyNodeRow(row);
              }

              if (row.kind === "compact_path") {
                return renderCompactPathRow(row);
              }

              const renderedRow = renderActivityRow(row.group as TGroup, {
                depth: row.depth,
                showLaneLabels: activityIndex === 0,
                compactPathLabel: row.compactPath?.label,
              });
              activityIndex += 1;
              return renderedRow;
            });
          })()
        ) : (
          <div className="shift-empty-state gantt-empty-state">
            <p className="ops-copy">No hay actividades visibles para esta configuración.</p>
          </div>
        )}

        <div className="gantt-footer">
          <GanttLegend />
        </div>
      </div>
    </section>
  );
}
