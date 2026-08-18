# Local-first sync architecture

## Estado actual

OpsAhead opera con una base local-first inicial para planning:

- La UI hidrata planning primero desde IndexedDB mediante `PlanningLocalRepository`.
- En paralelo, si hay conectividad, consulta servidor con `fetchPlanningItems()`.
- La respuesta servidor se reconcilia con la outbox pendiente antes de actualizar la UI.
- El resultado reconciliado se persiste nuevamente en IndexedDB.
- Las escrituras de planning se reflejan localmente y se agregan a la outbox antes del push al servidor.
- El push de la outbox usa `/api/sync/push`, que delega en los handlers server-side actuales de planning para conservar permisos y validaciones.
- El pull incremental usa `/api/sync/pull?cursor=<cursor>` y aplica cambios remotos mediante `PlanningRemoteChangeApplier`.
- El cursor incremental se persiste por scope de usuario en IndexedDB.
- La cola durable de planning vive en `src/modules/planning/sync/planning-mutation-queue.ts` y se persiste mediante `src/modules/planning/sync/planning-mutation-queue-store.ts`.
- La UI sigue aplicando mutaciones pendientes como overlay defensivo con `applyPendingPlanningMutations()`.
- Supabase Realtime sigue activo a través de `src/modules/planning/presentation/use-planning-realtime.ts`; se usa como acelerador para disparar sync incremental.

En la Fase 1, `src/modules/planning/sync/use-planning-sync-coordinator.ts` extrae la coordinación de replay que antes estaba embebida en `src/app/(app)/page.tsx`. La página conserva la presentación y los mensajes, pero el coordinador toma responsabilidad por cargar outbox, persistirlo, evitar replay concurrente, responder a reconexión y ejecutar retries programados.

En la Fase 2, `src/modules/planning/local/planning-local-repository.ts` encapsula lectura/escritura por fecha y scope. `src/app/(app)/page.tsx` deja de llamar directamente `readPlanningCache()` y `savePlanningCache()` para planning.

## Arquitectura objetivo

```text
UI
→ IndexedDB
→ Outbox
→ SyncCoordinator
→ Push/Pull
→ API
→ PostgreSQL
```

La dirección final es que la UI consuma primero IndexedDB para dominios operacionales. El servidor seguirá siendo la fuente compartida y la autoridad final, pero no el primer salto de lectura/escritura de la experiencia local.

## Principios

1. Local-first para dominios operacionales.
2. IndexedDB como fuente inmediata.
3. Servidor como fuente compartida y autoridad final.
4. Outbox durable para escrituras.
5. Push idempotente.
6. Pull incremental por cursor.
7. Concurrencia explícita.
8. Realtime opcional, nunca fuente de verdad.
9. Scope obligatorio por usuario/contexto.
10. Estado de sincronización visible y comprensible.

## Estado por fase

```text
Fase 1 — SyncCoordinator / Outbox        COMPLETA
Fase 2 — IndexedDB-first planning        COMPLETA
Fase 3 — Push/Pull incremental           COMPLETA
Fase 4 — Atomicidad + sin Realtime       EN PROGRESO
Fase 5 — Migración Railway               PENDIENTE
```

## Decisiones arquitectónicas

### Adoptar local-first

OpsAhead se usa en contextos operacionales donde la conectividad puede degradarse. Local-first reduce la dependencia del roundtrip al servidor y permite que la operación continúe con estado explícito de sincronización.

### Vinema como referencia conceptual

Vinema valida patrones útiles para una experiencia offline-first: almacenamiento local inmediato, outbox durable, push idempotente y reconciliación posterior. OpsAhead reutiliza esos patrones, pero no copia código directamente porque sus dominios, permisos, APIs y modelo operacional son distintos.

### Realtime como opcional

Supabase Realtime queda desacoplado conceptualmente:

```text
Realtime
→ señal de cambio remoto
→ reconciliación/refresh
```

Realtime no debe ser fuente de verdad ni dependencia estructural del `SyncCoordinator`. En fases posteriores se podrá retirar o reemplazar sin reescribir la coordinación de outbox.

En Fase 3, Realtime dispara `syncPendingPlanningMutations()`. El camino de convergencia es el mismo con o sin evento Realtime: push pendiente si existe, pull incremental, aplicación en IndexedDB y actualización de UI desde el snapshot local.

En Fase 4, Realtime puede desactivarse con:

```text
NEXT_PUBLIC_ENABLE_PLANNING_REALTIME=false
```

El valor por defecto sigue siendo `true`. Con la bandera en `false`, no se abre la suscripción de Supabase Realtime, pero se conservan polling incremental cada 10 segundos y disparos por arranque autenticado, `online`, focus, `visibilitychange` visible y `pageshow`.

### Evitar polling de datasets completos

Polling completo degrada rendimiento, consume ancho de banda y no escala bien cuando planning, asignaciones, catálogo y otros dominios crezcan. Además mezcla detección de cambios con transporte de datasets completos.

### Pull incremental por cursor

Pull incremental sí es aceptable porque transporta cambios desde un cursor conocido y permite reconciliar IndexedDB sin descargar todo. También facilita tombstones, ordenamiento por revisión y sincronización multi-dispositivo.

## Outbox durable de planning

La outbox de planning conserva:

- scope por usuario;
- mutation id;
- operación;
- payload;
- status;
- attempts;
- lastError;
- lastAttemptAt;
- nextRetryAt;
- failureReason;
- conflictSnapshot;
- `expected_updated_at`;
- persistencia IndexedDB;
- FIFO/replay secuencial.

La implementación actual mantiene nombres de planning para evitar churn innecesario. Conceptualmente, `planning-mutation-queue.ts` es la outbox durable de planning. La generalización debe ocurrir cuando otro dominio necesite el mismo contrato.

## Contratos comunes

`src/modules/sync/sync-contracts.ts` define contratos neutrales iniciales:

- `SyncScope`
- `SyncMutation`
- `SyncMutationStatus`
- `SyncFailureReason`
- `SyncCoordinatorState`
- `SyncChange`
- `SyncPullResponse`
- `SyncPushMutation`
- `SyncPushResponse`

Planning todavía conserva `PendingPlanningMutation` porque su payload incluye detalles propios como `assignmentPayload`, `syncedPlanningItemId` y snapshots de conflicto.

## IndexedDB-first planning

Flujo anterior:

```text
API
→ estado React
→ snapshot IndexedDB
```

Flujo nuevo para planning:

```text
IndexedDB
→ estado UI

API
→ reconciliación con outbox
→ IndexedDB
→ estado UI
```

Planning lee snapshots locales en:

- `PlanningLocalRepository.readByDate()`.

Planning escribe snapshots locales en:

- `PlanningLocalRepository.replaceSnapshot()`;
- `PlanningLocalRepository.reconcileServerSnapshot()`;
- `PlanningLocalRepository.applyLocalMutation()`.

Planning aplica mutaciones pendientes como overlay en:

- `applyPendingPlanningMutations()` en `src/modules/planning/sync/planning-mutation-queue.ts`;
- reconciliación servidor + outbox en `PlanningLocalRepository`;
- composición de items visibles en `src/app/(app)/page.tsx` como defensa idempotente.

Al cambiar fecha, la pantalla intenta primero `readByDate(date, scope)`. Si no hay snapshot local y el navegador está offline, muestra:

```text
No hay datos disponibles sin conexión para esta fecha.
```

## Dependencias actuales

Sigue dependiendo de API:

- lectura remota completa por fecha con `GET /api/planning-items` para hidratación inicial/fallback y snapshots de conflicto;
- push de mutaciones por `/api/sync/push`, que internamente reutiliza `/api/planning-items`;
- pull incremental por `/api/sync/pull`;
- catálogo, cabecera operacional y asignaciones;
- validaciones finales de permisos y concurrencia.

Sigue dependiendo temporalmente de Realtime:

- señales de invalidación remota;
- disparo anticipado de sync incremental;
- polling incremental sigue convergiendo aunque Realtime no llegue.

Limitaciones conocidas:

- Las mutaciones core de `planning_items` con `tracking_type = 'programado'` y `client_mutation_id` usan `process_planned_item_sync_mutation()`, por lo que `create/update/delete + processed mutation + changelog` ocurren en una transacción PostgreSQL.
- La cabecera operacional dinámica de esos programados sigue sincronizándose desde TypeScript después del RPC para no duplicar todavía toda la lógica de dependencias/validación en SQL.
- Las operaciones `tracking_type = 'real'`, `activity_execution_segments`, `reconcile_real_execution_segments()` y asignaciones vinculadas todavía mantienen frontera transaccional propia. Para volverlas completamente atómicas con sync metadata hace falta una RPC específica que incluya segmentos, valores dinámicos, asignaciones y changelog en una sola unidad.
- Después de algunos pushes confirmados puede seguir usándose refresh completo de fecha para snapshots de conflicto o datos derivados que la respuesta actual no contiene de forma suficiente.
- La outbox general aún es planning-specific; se generalizará cuando otro dominio necesite el mismo contrato.
- Los tombstones remotos viven en `sync_changes`; no existe aún una tabla local separada de tombstones porque el applier remueve del snapshot por fecha.

## Push/Pull incremental

### Schema server-side

`supabase/sql/021_incremental_sync.sql` crea:

- `sync_changes`: changelog con `sequence_id bigserial` como cursor monotónico, `scope_user_id`, `domain`, `entity_type`, `entity_id`, `operation`, `server_revision`, `occurred_at`, `payload`, `mutation_id` y `actor_user_id`.
- `sync_processed_mutations`: registro idempotente por `domain + scope + mutation_id`, con respuesta persistida para retries de create/update/delete.

Para planning, `scope_user_id` queda `null` porque el modelo funcional actual comparte planning globalmente entre usuarios autorizados con `records.view`. El endpoint filtra cambios globales y, cuando existan scopes contextuales reales, podrá sumar cambios propios del scope.

### Push

Cada cambio enviado al servidor debería contemplar:

- `mutationId`;
- `domain` o `entity`;
- `operation`;
- `payload`;
- revisión base, inicialmente `expected_updated_at`;
- `scope`.

Contrato actual:

```text
POST /api/sync/push
{
  "mutations": [
    {
      "mutationId": "...",
      "domain": "planning",
      "operation": "create | update | delete",
      "entityId": 123,
      "baseRevision": "updated_at anterior",
      "payload": {}
    }
  ]
}
```

`/api/sync/push` despacha cada mutación hacia el handler actual de planning. La idempotencia se resuelve en `/api/planning-items`: si `client_mutation_id` ya está en `sync_processed_mutations`, devuelve la respuesta persistida sin reaplicar.

Para `planning_items` programado, el handler termina llamando a:

```text
public.process_planned_item_sync_mutation(
  p_mutation_id,
  p_operation,
  p_actor_user_id,
  p_entity_id,
  p_expected_updated_at,
  p_payload
)
```

La función revisa idempotencia, aplica la mutación core, registra `sync_changes`, registra `sync_processed_mutations` y retorna la respuesta persistida. Si un retry llega después de perderse la respuesta original, retorna `sync_processed_mutations.response` sin volver a mutar ni duplicar changelog.

### Pull

Conceptualmente:

```text
GET /api/sync/pull?cursor=X
```

Respuesta conceptual:

```json
{
  "changes": [],
  "nextCursor": 123,
  "hasMore": false
}
```

Cada cambio debe poder representar:

- `upsert`;
- `delete` o tombstone;
- `domain`;
- `entity`;
- revisión del servidor;
- `payload`.

`PlanningRemoteChangeApplier` recibe esos cambios, detecta conflictos con outbox local pendiente, escribe IndexedDB y avanza el cursor con `saveSyncCursor("planning", cursor, scope)`.

## Validación sin Realtime

Con `NEXT_PUBLIC_ENABLE_PLANNING_REALTIME=false`, la convergencia depende de:

- outbox local;
- `SyncCoordinator`;
- `/api/sync/push`;
- `/api/sync/pull?cursor=<cursor>`;
- `PlanningRemoteChangeApplier`;
- IndexedDB por scope.

El costo lógico del polling es una request autenticada pequeña cada 10 segundos por cliente activo, más `0..N` cambios desde el cursor local. No descarga datasets completos.

Latencia esperada teórica:

- promedio aproximado: hasta la mitad del intervalo de polling, alrededor de 5 segundos;
- peor caso normal: alrededor de 10 segundos más request/reconcile;
- focus/resume/online/pageshow: casi inmediato, sujeto a red y procesamiento local.

No hay medición real registrada en esta documentación; debe medirse durante prueba de campo.

## Guía manual multi-dispositivo

Prueba sugerida:

```text
1. Configurar NEXT_PUBLIC_ENABLE_PLANNING_REALTIME=false y desplegar/reiniciar.
2. Abrir sesión con el mismo usuario X en notebook y teléfono.
3. Verificar que ambos estén online y en la misma fecha de planning.
4. Crear un registro desde teléfono.
5. Observar en notebook hasta que aparezca por pull incremental.
6. Editar el registro desde teléfono y observar actualización en notebook.
7. Eliminar el registro desde teléfono y observar tombstone/remoción en notebook.
8. Dejar notebook offline con cursor X.
9. Crear/editar/eliminar varios registros desde teléfono.
10. Volver notebook online y confirmar que recupera todos los cambios desde X en orden.
11. Repetir con una edición concurrente para confirmar 409 y estado Requiere atención.
12. Repetir revocando permiso de escritura antes del replay para confirmar 403 sin retry infinito.
```

## Criterio para retirar Realtime

Estado actual:

```text
NO APTO TODAVÍA
```

Razones:

- La convergencia sin Realtime está cubierta por polling incremental y tests unitarios, pero falta prueba manual/field test real con dos dispositivos.
- La atomicidad está cerrada para el core de `planning_items programado`, no para segmentos reales, cabecera operacional dinámica ni asignaciones.
- Falta un mecanismo de reparación/backfill para detectar cambios históricos sin `sync_changes` si una migración parcial o un error operacional lo requiere.

Realtime puede seguir funcionando como acelerador mientras esas fronteras se cierran.
