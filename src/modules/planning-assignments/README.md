# Planning Assignments

Catalogo base para grupos repetibles configurables asociados a programados.

Incluye contracts, cliente HTTP y panel administrativo en `/catalog` para:

- tipos de asignacion;
- campos simples por tipo;
- opciones para campos `select` y `multi_select`.

Incluye backend de instancias `planning_assignments` y
`planning_assignment_values`, formulario operacional, cache IndexedDB,
replay lateral desde mutation queue, resumen prioritario en detalle y precarga
batch para iconos en Gantt. La administracion de catalogo sigue online-only.
Todavia no incluye reportes. Ver
`docs/architecture/planning-assignments.md`.
