import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";
import { GanttLegend } from "@/components/planning/gantt-legend";
import { GanttRowMeta } from "@/components/planning/gantt-row-meta";

type ShiftKey = "Dia" | "Noche";

type PlanningItem = {
  id: number;
  shift: string;
};

type PlanningGroup = {
  key: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  programado: PlanningItem | null;
  realSegments: PlanningItem[];
};

type GanttScale = {
  startMinutes: number;
  endMinutes: number;
  slotCount: number;
  endLabel: string;
  hourMarks: {
    key: string;
    label: string;
    major: boolean;
  }[];
};

type GanttShiftSectionProps = {
  shift: ShiftKey;
  groups: PlanningGroup[];
  scale: GanttScale;
  renderBar: (item: PlanningItem | null, layer: "programado" | "real", scale: GanttScale) => ReactNode;
  renderCreateRealButton: (group: PlanningGroup) => ReactNode;
  toDisplayCategory: (category: PlanningGroup["category"]) => string;
};

export function GanttShiftSection({
  shift,
  groups,
  scale,
  renderBar,
  renderCreateRealButton,
  toDisplayCategory,
}: GanttShiftSectionProps) {
  return (
    <section className="gantt-section shift-section">
      <div className="gantt-section-header shift-section-header">
        <GanttLegend />
      </div>

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

        {groups.length ? (
          groups.map((group) => {
            const realSegmentsForShift = group.realSegments.filter((segment) => segment.shift === shift);
            const plannedItemForShift = group.programado?.shift === shift ? group.programado : null;
            const eventTitle = [group.level, group.front]
              .map((part) => String(part ?? "").trim())
              .filter(Boolean)
              .join(" - ");
            const activityName = String(group.description ?? "").trim();

            return (
              <article key={group.key} className="gantt-row gantt-row-dual">
                <div className="gantt-meta">
                  <GanttRowMeta
                    title={eventTitle}
                    subtitle={activityName}
                    categoryLabel={toDisplayCategory(group.category)}
                    categoryTone={group.category === "interferencia" ? "warning" : "success"}
                    typeLabel={group.item_type}
                    action={renderCreateRealButton(group)}
                  />
                </div>

                <div className="gantt-track gantt-track-compare">
                  <div className="gantt-track-scale">
                    <span className="gantt-lane-label programado" aria-hidden="true">
                      Plan
                    </span>
                    <span className="gantt-lane-label real" aria-hidden="true">
                      Eventos
                    </span>
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
          })
        ) : (
          <div className="shift-empty-state">
            <p className="ops-copy">Sin actividades para este turno.</p>
          </div>
        )}
      </div>
    </section>
  );
}
