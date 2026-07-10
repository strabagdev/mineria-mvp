# Configurable Entities (Retirado)

Ultima actualizacion: 2026-05-31

## Estado

El experimento `configurable entities` quedo retirado del codigo activo. El
modelo resolvia seleccion de entidades prearmadas, pero el dominio operacional
requiere asignaciones repetibles completadas al crear una programacion.

No usar como contrato vigente ni como base para nuevas funcionalidades:

- `configurable_entity_types`
- `configurable_entities`
- `configurable_entity_fields`
- `configurable_entity_field_options`
- `configurable_entity_field_values`
- Custom Fields.
- Cualquier variante de `entity_reference` dentro de campos genericos.

Las migraciones SQL experimentales fueron retiradas del repo en la fase A2.
No existe migracion de cleanup porque el modelo no llego a produccion y los
datos asociados eran solo de prueba.

## Reemplazo vigente

El modelo vigente expresa recursos mediante Asignaciones:

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

- No modelar asignaciones dentro de Cabecera Operacional.
- No agregar columnas al payload core de `planning_items`.
- No reintroducir Custom Fields como mecanismo lateral.
- Cabecera Operacional cubre identidad, clasificacion, filtros, Gantt,
  reportes y exportaciones.
- Asignaciones cubre recursos, equipos, cuadrillas, operadores y atributos
  asociados.

## Estado

El experimento queda documentado solo como antecedente. No forma parte de la
arquitectura vigente.
