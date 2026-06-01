# Planning Assignments

Ultima actualizacion: 2026-05-31

## Objetivo

Modelar asignaciones repetibles y configurables que se completan al crear o
editar un programado. El catalogo base define tipos, campos y opciones; las
instancias operacionales se guardan lateralmente al payload core.

Ejemplo:

```text
Tipo: Cuadrillas
max_instances: 2

Cuadrilla #1
  Codigo: CUAD-001
  Departamento: Operaciones
  Grupo: Fortificacion
  Cantidad: 8
```

## Diferencia con custom fields

- `planning_custom_fields`: datos simples laterales con un valor por campo y
  target.
- `planning assignments`: grupos configurables repetibles por programado.
- Assignments no usan `entity_reference` ni entidades prearmadas.
- Assignments no se guardan dentro del payload core de `planning_items`.

## Catalogo base

```text
assignment_types
  -> assignment_fields
     -> assignment_field_options
```

`assignment_types.max_instances` limita cuantas instancias del tipo se podran
crear por programado. Parte en `2`, pero queda configurable.

`assignment_types.icon_key` permite elegir un icono Lucide desde una lista
cerrada. El icono identifica el tipo en catalogo, detalle y tooltip Gantt.

`assignment_fields.input_type` soporta:

- `text`
- `number`
- `date`
- `boolean`
- `select`
- `multi_select`

Solo `select` y `multi_select` pueden tener filas en
`assignment_field_options`.

## Boundaries

- Contracts/client: `src/modules/planning-assignments`.
- API routes:
  `/api/assignment-types`,
  `/api/assignment-fields`,
  `/api/assignment-field-options`.
- Server: `src/server/services/planning-assignments.service.ts` y
  `src/server/repositories/planning-assignments.repository.ts`.
- SQL: `supabase/sql/006_assignment_catalog.sql`,
  `supabase/sql/007_planning_assignments.sql` y
  `supabase/sql/008_assignment_type_icons.sql`.
- Lectura: `requireApprovedUser`.
- Administracion: `requireAdminUser`.

La administracion del catalogo de assignments es online-only. La UI vive en
`/catalog`, seccion `Asignaciones`, con tres areas: tipos, campos del tipo y
opciones del campo. No permite mutaciones administrativas offline.

## Instancias por programado

Fase D agrega instancias operacionales laterales al payload core:

```text
planning_items
  -> planning_assignments
     -> planning_assignment_values
```

API:

- GET `/api/planning-assignments?planning_item_id=...`
- GET `/api/planning-assignments?planning_item_ids=1,2,3`
- POST `/api/planning-assignments`

POST recibe la lista completa de instancias para un programado. El service
valida primero tipos, `max_instances`, campos activos, required, pertenencia de
campo/tipo, pertenencia de opcion/campo y serializacion por tipo. Luego ejecuta
el reemplazo mediante RPC PostgreSQL `replace_planning_assignments`, de modo que
delete e inserts ocurren dentro de una sola transaccion.

Las instancias son operacionales y soportan continuidad offline. El formulario
usa definiciones activas cacheadas cuando no hay red. Al guardar offline,
`assignmentPayload` queda lateral al payload core dentro de la mutation queue.
El replay guarda primero el core planning, obtiene `planning_item_id` y luego
reemplaza assignments por API. Si falla este segundo paso, conserva el ID del
core ya sincronizado para reintentar sin duplicarlo.

IndexedDB guarda:

- `planning-assignment-types`: tipos, campos y opciones necesarios en terreno.
- `planning-assignments:{planningItemId}`: instancias por programado.

El detalle resuelve instancias desde cache o queue. El Gantt precarga por lote
las instancias visibles cuando hay red, usa cache al degradarse y muestra
iconos por tipo sin hacer fetch por hover.

## Borrado seguro

- Los tipos con campos asociados no se eliminan; se desactivan.
- Los campos con opciones asociadas no se eliminan; se desactivan.
- Las opciones con valores operacionales no se eliminan; se desactivan.

## Pendiente

- Fase posterior: reportes.
