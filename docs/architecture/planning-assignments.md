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
- SQL: `supabase/sql/006_assignment_catalog.sql`.
- Lectura: `requireApprovedUser`.
- Administracion: `requireAdminUser`.

El catalogo de assignments es online-only. La UI administrativa vive en
`/catalog`, seccion `Asignaciones`, con tres areas: tipos, campos del tipo y
opciones del campo. No agrega caches IndexedDB, queue, realtime, reportes ni
integracion visual en planning.

## Instancias por programado

Fase D agrega instancias operacionales laterales al payload core:

```text
planning_items
  -> planning_assignments
     -> planning_assignment_values
```

API:

- GET `/api/planning-assignments?planning_item_id=...`
- POST `/api/planning-assignments`

POST recibe la lista completa de instancias para un programado. El service
valida primero tipos, `max_instances`, campos activos, required, pertenencia de
campo/tipo, pertenencia de opcion/campo y serializacion por tipo. Luego ejecuta
el reemplazo mediante RPC PostgreSQL `replace_planning_assignments`, de modo que
delete e inserts ocurren dentro de una sola transaccion.

Las instancias son online-only por ahora. El formulario de programacion carga
tipos activos y, al editar, consulta las instancias existentes. Guarda el core
primero y luego reemplaza assignments por API. El detalle consulta y muestra un
resumen simple. No se integran todavia a IndexedDB, queue offline, Gantt ni
reportes.

## Borrado seguro

- Los tipos con campos asociados no se eliminan; se desactivan.
- Los campos con opciones asociadas no se eliminan; se desactivan.
- Las opciones con valores operacionales no se eliminan; se desactivan.

## Pendiente

- Fases posteriores: offline, visualizacion Gantt y reportes.
