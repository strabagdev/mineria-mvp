# Local-first sync architecture

## Estado actual

OpsAhead ya opera con una base offline parcial para planning:

- La UI lee planning desde API con `fetchPlanningItems()` en `src/app/(app)/page.tsx`.
- Cuando la lectura online funciona, la pantalla guarda snapshots en IndexedDB mediante `savePlanningCache()` desde `src/lib/localOfflineStore.ts`.
- En modo offline o ante errores transitorios, la pantalla lee snapshots con `readPlanningCache()`.
- Las escrituras de planning que no pueden llegar al servidor se guardan como mutaciones pendientes en IndexedDB.
- La cola durable de planning vive en `src/modules/planning/sync/planning-mutation-queue.ts` y se persiste mediante `src/modules/planning/sync/planning-mutation-queue-store.ts`.
- La UI aplica esas mutaciones pendientes como overlay sobre los datos visibles con `applyPendingPlanningMutations()`.
- Supabase Realtime sigue activo a través de `src/modules/planning/presentation/use-planning-realtime.ts`; hoy se usa como señal de invalidación para refrescar datos desde API.

En la Fase 1, `src/modules/planning/sync/use-planning-sync-coordinator.ts` extrae la coordinación de replay que antes estaba embebida en `src/app/(app)/page.tsx`. La página conserva la presentación y los mensajes, pero el coordinador toma responsabilidad por cargar outbox, persistirlo, evitar replay concurrente, responder a reconexión y ejecutar retries programados.

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
Fase 1 — SyncCoordinator / Outbox        EN PROGRESO
Fase 2 — IndexedDB-first                 PENDIENTE
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

## Preparación IndexedDB-first

Planning todavía lee desde API como camino normal en:

- `refreshPlanningItems()` en `src/app/(app)/page.tsx`.
- Cargas iniciales de planning que llaman `fetchPlanningItems()`.

Planning escribe snapshots IndexedDB en:

- `savePlanningCache()` desde `refreshPlanningItems()`.
- caches de catálogo con `saveCatalogCache()`;
- caches de asignaciones con `saveAssignmentTypesCache()` y `saveAssignmentsCacheForTarget()`.

Planning aplica mutaciones pendientes como overlay en:

- `applyPendingPlanningMutations()` en `src/modules/planning/sync/planning-mutation-queue.ts`;
- composición de items visibles en `src/app/(app)/page.tsx`.

Para que la Fase 2 invierta el flujo a `UI → IndexedDB`, falta:

- cargar primero el snapshot local aunque exista red;
- separar lectura local de fetch remoto;
- convertir refresh online en reconciliación contra store local;
- notificar a la UI desde cambios locales;
- persistir resultados remotos antes de pintar;
- mantener overlays de outbox sobre el store local o materializarlos en una vista derivada.

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

