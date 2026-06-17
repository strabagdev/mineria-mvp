# Assignments Evolution Plan

Ultima actualizacion: 2026-06-16

## Objetivo

Documentar la evolucion futura de assignments antes de implementar cambios de
modelo, API, UI, offline o reportes.

## Estado actual

Las instancias operacionales de assignments viven en:

```text
planning_assignments
  -> planning_assignment_values
```

Hoy `planning_assignments` apunta obligatoriamente a `planning_items` mediante
`planning_item_id not null`. No existen assignments sobre
`activity_execution_segments`.

Implicancias actuales:

- La asignacion existe solo para programados.
- La API `/api/planning-assignments` recibe y consulta `planning_item_id`.
- La RPC `replace_planning_assignments` reemplaza por `planning_item_id`.
- La cache offline usa claves por programado:
  `planning-assignments:{planningItemId}`.
- Gantt, detalle y reportes tratan assignments como datos laterales del
  programado.

## Necesidad

El modelo debe permitir asignaciones sobre reales e interferencias registradas
como `activity_execution_segments`, no solo sobre programados.

Tambien debe distinguir claramente:

- Asignacion planificada: asociada a `planning_items`.
- Asignacion real: asociada a `activity_execution_segments`.

La distincion debe venir del target de la asignacion, no de un campo duplicado
que pueda quedar inconsistente.

## Propuesta

Evolucionar `planning_assignments` a un modelo target-aware.

Cambios esperados en DB:

- Agregar `execution_segment_id bigint null references activity_execution_segments(id)`.
- Relajar `planning_item_id` para permitir `null`.
- Agregar constraint de exactamente un target:
  - `planning_item_id is not null` y `execution_segment_id is null`; o
  - `planning_item_id is null` y `execution_segment_id is not null`.
- Reemplazar la unicidad actual por indices unicos parciales:
  - `(planning_item_id, assignment_type_id, instance_order)` cuando
    `planning_item_id is not null`.
  - `(execution_segment_id, assignment_type_id, instance_order)` cuando
    `execution_segment_id is not null`.

Cambios esperados en contratos y API:

- Introducir un target explicito:

```text
target_kind: "planning_item" | "execution_segment"
target_id: number
```

- Mantener compatibilidad temporal con `planning_item_id` para programados.
- Crear endpoints o parametros target-aware para GET/POST.
- Evolucionar la RPC hacia reemplazo por target, por ejemplo:
  `replace_assignments_for_target(target_kind, target_id, assignments)`.

Cambios esperados en offline:

- Cambiar cache por programado a cache por target:

```text
assignments:planning_item:{id}
assignments:execution_segment:{id}
```

- La mutation queue debe conservar el target esperado y mapear IDs temporales a
  IDs reales despues de sincronizar el core.
- Para programados existentes, mantener lectura de claves antiguas durante la
  transicion si se requiere compatibilidad local.

## Reportes

`assignment_rows` debe evolucionar desde `planning_item_id` hacia:

```text
target_kind: "planning_item" | "execution_segment"
target_id: number
```

Los reportes deben asociar assignments a la fila visible correspondiente:

- Filas `planning_items`: usar assignments con target `planning_item`.
- Filas `activity_execution_segments`: usar assignments con target
  `execution_segment`.

La exportacion Excel debe imprimir assignments por cada fila visible, no solo
por filas programadas. Si una fila real o interferencia tiene assignments, deben
aparecer en su misma fila de detalle.

## Metadata de opciones

El catalogo ya contempla `assignment_field_options.metadata`. Esa metadata debe
usarse para evitar selects duplicados cuando una opcion arrastra datos
asociados.

Ejemplo:

```text
Campo: Codigo de equipo
Opcion: JUMBO-01
metadata:
  familia: Jumbo
```

Al seleccionar `JUMBO-01`, la UI puede mostrar o completar la familia asociada.
Esto evita pedir al usuario dos selects independientes que representan una sola
decision operacional.

Regla recomendada:

- Si el dato derivado solo describe la opcion, resolverlo desde metadata.
- Si el dato derivado debe quedar historizado aunque cambie el catalogo,
  materializarlo como snapshot en el valor guardado o en un campo derivado
  controlado.

## Fases recomendadas

1. Preparar DB target-aware sin habilitar UI nueva.
   - Agregar `execution_segment_id`.
   - Agregar constraint de target exclusivo.
   - Crear indices parciales.
   - Mantener compatibilidad para programados existentes.

2. Crear contratos y API target-aware.
   - Agregar target explicito.
   - Mantener endpoints actuales como wrapper de `planning_item`.
   - Cubrir reemplazo transaccional por target.

3. Migrar UI y offline sin cambiar alcance funcional visible.
   - Usar claves de cache por target.
   - Adaptar queue para conservar target.
   - Seguir mostrando assignments solo para programados hasta terminar la
     transicion.

4. Habilitar assignments en reales/interferencias.
   - Mostrar formulario y resumen para `activity_execution_segments`.
   - Precargar en Gantt por lote.
   - Evitar fetch por hover.

5. Evolucionar reportes y Excel.
   - Cambiar `assignment_rows` a `target_kind`/`target_id`.
   - Exportar assignments por fila visible.

6. Incorporar metadata de opciones.
   - Exponer administracion controlada de metadata.
   - Implementar caso equipo -> familia.
   - Definir si familia se resuelve desde catalogo o se historiza.

## Que NO hacer

- No agregar `execution_segment_id` sin constraint que garantice exactamente un
  target.
- No guardar assignments reales apuntando al `planning_item_id` padre si la
  asignacion pertenece a un tramo real especifico.
- No usar solo IDs numericos en cache offline sin incluir el tipo de target.
- No romper la API actual de programados sin una transicion.
- No duplicar selects de codigo de equipo y familia cuando la familia deriva del
  equipo.
- No crear un `resource_select` antes de decidir si existira una entidad maestra
  real de recursos/equipos.
- No resolver metadata solo en reportes si la UI operacional sigue obligando al
  usuario a ingresar datos duplicados.
