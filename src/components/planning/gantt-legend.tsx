const LEGEND_ITEMS = [
  { className: "programado", label: "Programado" },
  { className: "actividad", label: "Actividad" },
  { className: "interferencia", label: "Interferencia" },
];

export function GanttLegend() {
  return (
    <div className="gantt-legend" aria-label="Leyenda de barras">
      {LEGEND_ITEMS.map((item) => (
        <span key={item.className} className={`gantt-legend-chip ${item.className}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
