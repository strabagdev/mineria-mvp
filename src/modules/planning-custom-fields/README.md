# Planning Custom Fields

Campos configurables laterales para programados y eventos reales. El core sigue
viviendo en `planning_items` y `activity_execution_segments`; los valores
dinamicos se guardan mediante APIs separadas.

Incluye:

- Definicion de campos (`planning_custom_fields`).
- Opciones de catalogo para `select` y `multi_select`.
- Valores asociados a `planning_item_id`, `execution_segment_id` o
  `activity_group_id`.

No toca Gantt, reportes, offline/sync ni realtime en esta etapa.

## Decision de modelo

La implementacion previa `resource_*` no se sigue expandiendo para esta
necesidad. Esta funcionalidad usa el modelo explicito de campos configurables:
campos, opciones y valores. Si quedan migraciones o archivos `resource_*` en
alguna rama, deben tratarse como experimento descartado y no como modelo activo
para programados.
