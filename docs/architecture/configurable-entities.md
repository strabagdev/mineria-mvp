# Configurable Entities (Retirado)

Ultima actualizacion: 2026-05-31

## Estado

El experimento `configurable entities` quedo retirado del codigo activo. El
modelo resolvia seleccion de entidades prearmadas, pero el dominio operacional
requiere asignaciones repetibles completadas al crear una programacion.

No usar como contrato vigente:

- `configurable_entity_types`
- `configurable_entities`
- `configurable_entity_fields`
- `configurable_entity_field_options`
- `configurable_entity_field_values`
- `planning_custom_fields.input_type = entity_reference`
- `planning_custom_fields.entity_type_id`
- `planning_custom_field_values.entity_id`

Las migraciones SQL experimentales fueron retiradas del repo en la fase A2.
No existe migracion de cleanup porque el modelo no llego a produccion y los
datos asociados eran solo de prueba.

## Reemplazo previsto

El modelo futuro debe expresar tipos de asignacion configurables e instancias
laterales al planning:

```text
assignment_types
  -> assignment_fields
     -> assignment_field_options

planning_items
  -> planning_assignments
     -> planning_assignment_values
```

Ejemplo: un tipo `Cuadrillas` puede definir campos `Codigo`, `Departamento`,
`Grupo` y `Cantidad`, con un maximo configurable de instancias por programado.

## Boundaries

- No modelar asignaciones dentro de `planning_custom_fields`.
- No agregar columnas al payload core de `planning_items`.
- No tocar `activity_execution_segments`, Gantt, reportes, realtime ni auth.
- Mantener los custom fields simples existentes:
  `text`, `number`, `date`, `boolean`, `select`, `multi_select`.
- Implementar asignaciones inicialmente online-only. Offline y reportes quedan
  para fases posteriores.

## Pendiente

- Fases siguientes: crear el modelo `assignments`, exponer administracion en
  catalogo e integrar instancias repetibles en programacion.
