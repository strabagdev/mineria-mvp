import type { ReactNode } from "react";

type GanttRowMetaProps = {
  title: string;
  subtitle?: string;
  assignmentIndicators?: ReactNode;
  action?: ReactNode;
};

export function GanttRowMeta({
  title,
  subtitle,
  assignmentIndicators,
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
        {assignmentIndicators}
      </div>

      <div className="gantt-meta-line">
        {action ? <div className="gantt-meta-actions">{action}</div> : null}
      </div>
    </div>
  );
}
