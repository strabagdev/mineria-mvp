import type { ReactNode } from "react";

type GanttRowMetaProps = {
  title: string;
  subtitle?: string;
  categoryLabel: string;
  categoryTone: "success" | "warning";
  typeLabel: string;
  action?: ReactNode;
};

export function GanttRowMeta({
  title,
  subtitle,
  categoryLabel,
  categoryTone,
  typeLabel,
  action,
}: GanttRowMetaProps) {
  return (
    <div className="gantt-meta-card">
      <div className="gantt-meta-heading">
        <h3 title={title}>{title}</h3>
        {subtitle ? (
          <p className="gantt-meta-subtitle" title={subtitle}>
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="gantt-meta-line">
        <div className="field-list">
          <span className={`category-pill ${categoryTone}`}>{categoryLabel}</span>
          <span className="field-chip">{typeLabel}</span>
          {action}
        </div>
      </div>
    </div>
  );
}
