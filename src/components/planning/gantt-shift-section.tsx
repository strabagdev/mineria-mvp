import type { CSSProperties, ReactNode } from "react";
import { Fragment } from "react";
import { GanttLegend } from "@/components/planning/gantt-legend";
import { GanttRowMeta } from "@/components/planning/gantt-row-meta";

type ShiftKey = "Dia" | "Noche";

type GanttPlanningItem = {
  id: number;
  shift: string;
};

type GanttPlanningGroup<TItem extends GanttPlanningItem> = {
  key: string;
  level: string;
  front: string;
  category: "actividad" | "interferencia";
  item_type: string;
  description: string;
  programado: TItem | null;
  realSegments: TItem[];
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

type GanttShiftSectionProps<
  TItem extends GanttPlanningItem,
  TGroup extends GanttPlanningGroup<TItem>,
> = {
  shift: ShiftKey;
  groups: TGroup[];
  scale: GanttScale;
  currentTimeMarker?: GanttCurrentTimeMarker | null;
  renderBar: (item: TItem | null, layer: "programado" | "real", scale: GanttScale) => ReactNode;
  renderCreateRealButton: (group: TGroup) => ReactNode;
  toDisplayCategory: (category: TGroup["category"]) => string;
};

export function GanttShiftSection<
  TItem extends GanttPlanningItem,
  TGroup extends GanttPlanningGroup<TItem>,
>({
  shift,
  groups,
  scale,
  currentTimeMarker,
  renderBar,
  renderCreateRealButton,
  toDisplayCategory,
}: GanttShiftSectionProps<TItem, TGroup>) {
  const groupedRows = groups.reduce<Array<{ key: string; title: string; rows: TGroup[] }>>((accumulator, group) => {
    const level = String(group.level ?? "").trim();
    const front = String(group.front ?? "").trim();
    const title = [level || "Sin nivel", front || "Sin frente"].join(" - ");
    const key = `${level.toLowerCase()}::${front.toLowerCase()}`;
    const existingGroup = accumulator.find((entry) => entry.key === key);

    if (existingGroup) {
      existingGroup.rows.push(group);
      return accumulator;
    }

    accumulator.push({ key, title, rows: [group] });
    return accumulator;
  }, []);

  return (
    <section className="gantt-section shift-section">
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

        {groupedRows.length ? (
          groupedRows.map((locationGroup) => (
            <section key={locationGroup.key} className="gantt-location-group">
              <div className="gantt-location-header">
                <div className="gantt-location-title">
                  <span>{locationGroup.title}</span>
                </div>
                <div className="gantt-location-rule" aria-hidden="true" />
              </div>

              {locationGroup.rows.map((group) => {
                const realSegmentsForShift = group.realSegments.filter((segment) => segment.shift === shift);
                const plannedItemForShift = group.programado?.shift === shift ? group.programado : null;
                const activityName = String(group.description ?? "").trim() || group.item_type;

                return (
                  <article key={group.key} className="gantt-row gantt-row-dual">
                    <div className="gantt-meta">
                      <GanttRowMeta
                        title={activityName}
                        categoryLabel={toDisplayCategory(group.category)}
                        categoryTone={group.category === "interferencia" ? "warning" : "success"}
                        typeLabel={group.item_type}
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
              })}
            </section>
          ))
        ) : (
          <div className="shift-empty-state">
            <p className="ops-copy">Sin actividades para este turno.</p>
          </div>
        )}

        <div className="gantt-footer">
          <GanttLegend />
        </div>
      </div>
    </section>
  );
}
