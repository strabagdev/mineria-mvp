# mineria-mvp - Offline Contract v1

Fecha: 2026-05-10
Estado: Draft operativo

## 1) Objetivo
Definir un contrato unico para comportamiento offline/online en la app:
- almacenamiento local,
- cola de mutaciones,
- estados de sincronizacion,
- politica de reintentos,
- manejo de conflictos,
- idempotencia.

## 2) Alcance v1
- Incluye: modulo de planificacion (lectura/escritura/sync).
- Incluye: convenciones comunes reutilizables para otros modulos.
- Excluye por ahora: offline-write en auth, reportes y admin.

## 3) Stores locales (fuente de verdad en cliente)

### 3.1 IndexedDB
- DB: `mineria-offline-store`
- Stores:
  - `keyval`
    - `planning-catalog`
    - `auth-profile`
    - `planning-mutation-queue`
  - `planningByDate`
    - key: `date` (`YYYY-MM-DD`)
    - value: snapshot de items + `updatedAt`

### 3.2 Regla de persistencia
- Toda lectura remota exitosa actualiza cache local.
- Toda mutacion offline se persiste antes de confirmar UI local.
- La cola de mutaciones pendiente se guarda en `IndexedDB`.

## 4) Contrato de mutacion offline

### 4.1 Envelope de cola
```ts
type PendingMutation = {
  id: string; // UUID local
  entity: "planning-item";
  method: "POST" | "PATCH" | "DELETE";
  payload: Record<string, unknown>;
  createdAt: string; // ISO
  status: "pending" | "syncing" | "conflict";
  retryCount: number;
  lastError?: string;
  lastTriedAt?: string; // ISO
  clientMutationId: string; // idempotencia extremo a extremo
};
```

### 4.2 Reglas
- `clientMutationId` es obligatorio en toda mutacion.
- Orden de ejecucion: FIFO por `createdAt`.
- No se descarta una mutacion por errores de red/sesion reintentable.
- Conflictos funcionales pasan a `status=conflict` y requieren accion del usuario.

## 5) Estados de sincronizacion (UI + dominio)

Estados normalizados:
- `online`
- `offline`
- `syncing`
- `pending-sync`
- `synced`
- `conflict`
- `sync-error`

Reglas:
- Si hay mutaciones `pending` y no hay red: `pending-sync`.
- Si hay proceso de envio activo: `syncing`.
- Si cola vacia y ultimo envio exitoso: `synced`.
- Si existe al menos un conflicto: `conflict`.
- Error no reintentable sin clasificar como conflicto: `sync-error`.

## 6) Politica de reintentos

Triggers:
- evento `online`
- evento `focus`
- intervalo periodico (actual: 30s)

Clasificacion:
- Reintentable: error de red, sesion invalida recuperable.
- No reintentable por negocio: conflicto de horario/solape, validacion dura.

Backoff recomendado (v2):
- intento 1: inmediato
- intento 2: 3s
- intento 3: 10s
- intento >=4: 30s (cap)

## 7) Politica de conflictos

Un conflicto ocurre cuando:
- backend retorna `409`, o
- mensaje clasificado como conflicto de planificacion.

Comportamiento:
- marcar mutacion como `conflict`
- conservar `lastError` y `lastTriedAt`
- no bloquear sincronizacion del resto de la cola
- exponer accion de usuario:
  - descartar conflicto, o
  - recrear manualmente con horario corregido

## 8) Idempotencia

Contrato:
- cliente envia `client_mutation_id` estable por mutacion.
- backend debe aceptar repetidos sin duplicar efecto.
- reconexion o reintento nunca debe crear registros duplicados.

## 9) Degradacion por modulo (v1)
- Auth:
  - offline-read parcial por perfil cacheado.
  - offline-write no soportado.
- Planning:
  - offline-read y offline-write soportados.
  - sync automatica con cola local.
- Reportes/Admin:
  - online-only por ahora.
  - objetivo siguiente: offline-read con sello de datos cacheados.

## 10) Observabilidad minima requerida
- `pendingCount`
- `conflictCount`
- `lastSuccessfulSyncAt`
- `lastSyncError`

## 11) Criterios de aceptacion v1
- Con red caída, usuario puede crear/editar/eliminar planning y ver estado pendiente.
- Tras reconexion, mutaciones pendientes se procesan automaticamente.
- No hay duplicados por reintentos.
- Conflictos quedan explicitamente marcados y accionables.

## 12) Decisiones ya implementadas
- Cola de mutaciones migrada de `localStorage` a `IndexedDB` con migracion legacy.
- Cache local de catalogo y planning por fecha operativo.

