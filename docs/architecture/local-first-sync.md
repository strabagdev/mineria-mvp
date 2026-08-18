# Local-first sync architecture

## Estado actual

OpsAhead opera con una base local-first inicial para planning:

- La UI hidrata planning primero desde IndexedDB mediante `PlanningLocalRepository`.
- En paralelo, si hay conectividad, consulta servidor con `fetchPlanningItems()`.
- La respuesta servidor se reconcilia con la outbox pendiente antes de actualizar la UI.
- El resultado reconciliado se persiste nuevamente en IndexedDB.
- Las escrituras de planning se reflejan localmente y se agregan a la outbox antes del push al servidor.
- La cola durable de planning vive en `src/modules/planning/sync/planning-mutation-queue.ts` y se persiste mediante `src/modules/planning/sync/planning-mutation-queue-store.ts`.
- La UI sigue aplicando mutaciones pendientes como overlay defensivo con `applyPendingPlanningMutations()`.
- Supabase Realtime sigue activo a través de `src/modules/planning/presentation/use-planning-realtime.ts`; se usa como señal de invalidación para reconciliar desde API hacia IndexedDB.

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
Fase 3 — Push/Pull incremental           PENDIENTE
Fase 4 — Multi-dispositivo sin Realtime  PENDIENTE
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

- lectura remota completa por fecha con `GET /api/planning-items`;
- push de mutaciones por `/api/planning-items`;
- catálogo, cabecera operacional y asignaciones;
- validaciones finales de permisos y concurrencia.

Sigue dependiendo temporalmente de Realtime:

- señales de invalidación remota;
- disparo de fetch servidor;
- reconciliación posterior hacia IndexedDB.

Limitaciones conocidas:

- Todavía no existe pull incremental por cursor.
- Después de un push confirmado se refresca la fecha completa cuando hace falta reconciliar IDs reales, reales derivados o conflictos. Esto se mantiene porque las respuestas actuales no siempre entregan todos los cambios derivados necesarios para reconciliar localmente con total seguridad.
- La outbox general aún es planning-specific; se generalizará cuando otro dominio necesite el mismo contrato.
- No hay tombstones persistentes separados; delete pendiente se representa como mutación en outbox y se aplica sobre el snapshot efectivo.

## Contrato objetivo push/pull

### Push futuro

Cada cambio enviado al servidor debería contemplar:

- `mutationId`;
- `domain` o `entity`;
- `operation`;
- `payload`;
- revisión base, inicialmente `expected_updated_at`;
- `scope`.

El push debe ser idempotente por `mutationId`.

### Pull futuro

Conceptualmente:

```text
GET /api/sync/pull?cursor=X
```

Respuesta conceptual:

```text
{
  "changes": [],
  "nextCursor": "cursor",
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

El JSON definitivo queda pendiente hasta definir dominios, scopes contextuales y formato de revisiones.
