# Auditoría

Ultima actualizacion: 2026-06-03

## Objetivo

La auditoría registra cambios y acciones de negocio relevantes para reconstruir
quien hizo que, sobre que entidad y con que datos. Es persistente y se consulta
desde pantallas admin.

No es observabilidad runtime:

- Auditoría: `audit_logs`, historico de acciones de negocio, admin-only.
- Observability: `recordOperationalEvent`, buffer runtime local, diagnostico de
  red/sync/realtime/auth; no es historico persistente de negocio.

## Flujo Actual

```text
server service
  -> writeAuditLog
    -> audit_logs
      -> GET /api/audit-events
        -> /admin/audit
        -> timeline en ficha de programado
```

Puntos clave:

- Los services escriben auditoría después de mutaciones relevantes.
- `writeAuditLog` vive en `src/lib/auditLog.ts`.
- La persistencia usa `src/server/repositories/audit.repository.ts`.
- La consulta usa `src/server/services/audit.service.ts`.
- La API de lectura es `GET /api/audit-events`.
- La pantalla global vive en `/admin/audit`.
- La ficha del programado muestra un timeline secundario para eventos del
  `planning_item`.

## Modelo

Tabla: `audit_logs`.

Campos principales:

- `action`: identificador tecnico estable del evento. Ej:
  `planning_item.updated`.
- `entity_type`: entidad auditada. Ej: `planning_item`.
- `entity_id`: id de entidad auditada cuando existe.
- `actor_user_id` / `actor_email`: usuario que ejecuta la accion.
- `before_data`: snapshot previo cuando aplica.
- `after_data`: snapshot posterior cuando aplica.
- `metadata`: detalles adicionales del evento. En UI se muestra como
  `Detalles del evento`.
- `created_at`: fecha/hora del evento.

Contratos de lectura:

- `src/modules/audit/contracts/audit.ts`.

La UI transforma labels tecnicos:

- `action` se muestra como texto humano.
- `before_data` se muestra como `Antes`.
- `after_data` se muestra como `Después`.
- `metadata` se muestra como `Detalles del evento`.
- La acción tecnica queda visible solo en detalle expandible como
  `Acción técnica`.

## Eventos Relevantes

Planning core:

- `planning_item.created`
- `planning_item.updated`
- `planning_item.deleted`
- `activity_execution_segment.created`
- `activity_execution_segment.updated`
- `activity_execution_segment.deleted`

Assignments:

- `planning_assignments.replaced`
- `assignment_type.created`
- `assignment_type.updated`
- `assignment_type.deleted`
- `assignment_field.created`
- `assignment_field.updated`
- `assignment_field.deleted`
- `assignment_field_option.created`
- `assignment_field_option.updated`
- `assignment_field_option.deleted`

Custom Fields historicos:

- `planning_custom_field.created`
- `planning_custom_field.updated`
- `planning_custom_field.deleted`
- `planning_custom_field_option.created`
- `planning_custom_field_option.updated`
- `planning_custom_field_option.deleted`
- `planning_custom_field_values.saved`

Estos eventos pueden existir solo en auditoria historica. Custom Fields no
forma parte del runtime ni de la arquitectura operacional vigente.

Usuarios:

- `user.created`
- `user.password_reset`
- `user.role_updated`
- `user.active_toggled`
- `user.approval_status_updated`

Catalogo planning:

- `catalog.detail.created`
- `catalog.detail.updated`
- `catalog.detail.deleted`

## Calidad Actual De Datos

Eventos enriquecidos:

- `planning_assignments.replaced` guarda `before_data`, `after_data`,
  labels denormalizados y `metadata.summary`.
- Los eventos historicos de Custom Fields pueden apuntar a entidades
  operacionales y guardar snapshots antiguos en `before_data`, `after_data` o
  `metadata`.
- Snapshots antiguos pueden contener `level` y `front`; son trazabilidad, no
  fuente funcional del modelo actual.

Limitaciones:

- Algunos eventos historicos anteriores al endurecimiento pueden tener datos
  pobres o acciones legacy.
- El timeline por programado solo ve eventos cuyo `entity_type/entity_id`
  apuntan al `planning_item`.
- No existe bus/outbox persistente ni garantias de entrega fuera de la escritura
  directa del service.

## Restricciones

- Lectura admin-only.
- UI global `/admin/audit` admin-only.
- Timeline en ficha del programado visible solo para admin.
- Online-only: no se cachean ni editan eventos de auditoria offline.
- No mezclar `audit_logs` con observability runtime.
- UI no consulta repositories/services; usa API.
- Services escriben auditoría; UI no llama `writeAuditLog`.

## Pendientes

- Timeline por otras entidades, como usuarios o catalogo.
- Filtros mas guiados en `/admin/audit`.
- Export de auditoría.
- Retención/limpieza y politica formal de datos.
- Multi-tenant/faena en `audit_logs`.
- Correlation ids para relacionar sync/replay con acciones persistidas.
- Outbox/eventos persistentes si se requieren integraciones o compliance fuerte.
