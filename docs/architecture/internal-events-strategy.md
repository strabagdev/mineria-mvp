# Internal Events Strategy

## Objetivo

Preparar una estrategia de eventos internos desacoplados para efectos
secundarios futuros como auditoria, observabilidad, notificaciones, reporting,
invalidaciones realtime, jobs e integraciones externas. Esta etapa no cambia
flujos existentes ni introduce infraestructura distribuida.

## Decision Actual

Se crea un event bus in-process en `src/events`. Es una base de arquitectura, no
una garantia de entrega. No persiste eventos, no reintenta handlers, no cruza
procesos y no reemplaza transacciones.

## Eventos Candidatos

| Evento | Motivo | Consumidores futuros |
| --- | --- | --- |
| `planning.item_created` | Registro operacional creado | Audit, realtime, reporting, notificaciones |
| `planning.item_updated` | Registro operacional actualizado | Audit, realtime, reporting |
| `planning.item_deleted` | Registro operacional eliminado | Audit, realtime, reporting |
| `sync.replay_completed` | Cola offline sincronizada | Observabilidad, jobs, resumen operacional |
| `sync.conflict_detected` | Conflicto no retryable | Observabilidad, message center, alertas |
| `report.generated` | Reporte consultado/generado | Audit, export jobs, observabilidad |
| `auth.session_changed` | Sesion recuperada, expirada o cerrada | Observabilidad, seguridad |
| `notification.requested` | Solicitud de entrega | Integrations, jobs |
| `integration.delivery_failed` | Provider externo fallo | Retry jobs, observabilidad |
| `cache.invalidated` | Dataset requiere refresh | Snapshots, reporting, realtime |
| `offline.snapshot_refreshed` | Snapshot local actualizado | Observabilidad, indicadores de frescura |

## Modelo

Cada evento contiene:

- `id`
- `name`
- `payload` tipado
- `metadata.sourceModule`
- `timestamp`
- `correlationId` opcional
- `causationId` opcional
- `idempotencyKey` opcional
- `actorId`, `organizationId`, `siteId` opcionales

La recomendacion es publicar payloads pequenos con identificadores, no objetos
grandes ni datos sensibles.

## Reglas

1. Los eventos no reemplazan logica transaccional critica.
2. No usar eventos para autorizacion, autenticacion o decisiones de seguridad.
3. No usar eventos cuando el caller necesita resultado sincronico garantizado.
4. Handlers con side effects deben ser idempotentes.
5. Handlers no deben depender de UI ni React.
6. Evitar dependencias circulares entre modulos.
7. Observabilidad es obligatoria para publish/failure.
8. No publicar tokens, secretos, emails, payloads completos o datos sensibles.
9. Para multi-tenant/faena, incluir scope antes de afectar datos compartidos.
10. Si el efecto debe sobrevivir reinicios, usar jobs/queue futura, no este bus.

## Integraciones Futuras

- Jobs: un handler puede crear jobs cuando exista persistencia/queue.
- Observability: el bus ya registra `event_bus.published` y
  `event_bus.handler_failed`.
- Integrations: notificaciones/webhooks deben pasar por `src/integrations`.
- Audit: debe adoptarse con cuidado para no perder atomicidad.
- Realtime: puede consumir eventos para invalidaciones despues de preservar el
  comportamiento actual.
- Reporting: puede invalidar snapshots o disparar exports cuando haya jobs.

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Side effects ocultos | Dificil diagnostico | Handlers explicitos y ownership por modulo. |
| Perdida de eventos | Efectos no ejecutados tras restart | No usar para flujos criticos hasta tener persistencia. |
| Duplicados | Notificaciones o jobs repetidos | Idempotency keys y handlers idempotentes. |
| Circular dependencies | Acoplamiento entre dominios | Contratos en `src/events`, handlers cerca del owner. |
| Transacciones partidas | Audit o integraciones inconsistentes | Mantener writes criticos en services/transacciones. |
| Datos sensibles en payload | Riesgo de privacidad | Payloads pequenos y metadata sanitizada. |

## Roadmap

1. Mantener bus in-process solo para pruebas y efectos no criticos.
2. Registrar handlers por modulo cuando haya un caso real y seguro.
3. Definir convencion de correlation/causation ids en API/service layer.
4. Agregar persistencia de outbox si audit, jobs o integraciones requieren
   entrega confiable.
5. Evaluar cola persistente antes de procesar eventos largos o externos.

## No Cambios Funcionales

- No se conectaron flujos existentes.
- No se cambiaron endpoints.
- No se cambio UI.
- No se agregaron dependencias.
- No se introdujo infraestructura distribuida.
