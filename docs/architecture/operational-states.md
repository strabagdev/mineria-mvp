# Estados Operacionales

Ultima actualizacion: 2026-05-24

Este documento formaliza los estados operacionales implicitos actuales sin cambiar el comportamiento visible principal. La UI sigue usando el semaforo simple `online` / `offline`, pero el codigo ya cuenta con un modelo central para componer red, auth, cache, sync, conflictos y degradacion.

## Inventario actual

| Area | Estado implicito | Fuente actual | Comportamiento vigente |
| --- | --- | --- | --- |
| Red navegador | `offline` por `navigator.onLine === false` | `src/lib/networkStatus.ts` | Entra a modo offline y cancela heartbeat |
| Backend | backend inaccesible | Heartbeat `/api/health` no OK, timeout o error | La app lo trata como `offline` |
| Auth | auth requerida/expirada | Ausencia de `session?.access_token`, errores `Invalid session` | Bloquea sync online o encola si esta offline |
| Perfil local | sesion local degradada | `auth-profile` en IndexedDB sin sesion Supabase | Shell puede mostrarse con perfil local |
| Planning cache | offline con cache | `readPlanningCache`, `readCatalogCache` exitosos | Muestra datos locales y mensaje de ultima sync |
| Planning cache | offline sin snapshot | Falla fetch y no hay cache por fecha/catalogo | Muestra error operativo |
| Reports/dashboard/admin | lectura degradada | Snapshots `reports-data-v1-*`, `admin-users-v1` | Muestra ultimo snapshot disponible |
| Queue | sync pendiente | `pendingPlanningMutations.length > 0` | Tira de estado muestra pendientes |
| Queue | syncing | `queueSyncing === true` | Tira de estado muestra spinner/copy existente |
| Queue | conflicto | mutacion con `status: "conflict"` | Tira de estado permite descartar |
| Realtime | diferido/no disponible | hook no abre si no hay token/offline; difiere si tab oculta | Realtime no es fuente de verdad; se usa refetch |
| Refresh | fallo de refresh | catch de fetch/refetch | Mensaje de error o fallback local |

## Modelo central

Fuente: `src/lib/operationalState.ts`

### Semaforo compatible

```ts
type OperationalStatus = "online" | "offline";
```

Este tipo conserva compatibilidad con `networkStatus`, `SiteShell`, `subscribeNetworkStatus` y los indicadores actuales.

### Estados enriquecidos

```ts
type OperationalStateCode =
  | "online"
  | "offline"
  | "backend-unreachable"
  | "auth-required"
  | "offline-cache"
  | "offline-no-snapshot"
  | "sync-pending"
  | "syncing"
  | "sync-conflict"
  | "degraded-read"
  | "refresh-failed"
  | "realtime-deferred";
```

`buildOperationalState` recibe senales simples y devuelve:

- `primary`: estado prioritario para futura UX.
- `network`: semaforo `online/offline`.
- `states`: conjunto de estados derivados.
- `severity`: `nominal`, `info`, `warning` o `critical`.
- `canRead`, `canWriteOnline`, `hasPendingSync`, `hasConflict`.

## Centralizacion aplicada

- `networkStatus` ahora reutiliza el tipo `OperationalStatus` central.
- `SiteShell` deriva un `OperationalState` para su indicador existente y lo expone como `data-operational-state` / `data-operational-severity`.
- `PlanningStatusStrip` deriva un `OperationalState` desde errores, cache local, pendientes, syncing y conflictos, sin cambiar copy ni layout.
- Tests puros cubren online/offline, backend unreachable, offline cache, offline sin snapshot, sync pending/syncing/conflict y degraded-read.

## No cambiado intencionalmente

- Heartbeat y semantica `online/offline`.
- Endpoints.
- Queue/sync behavior.
- Realtime architecture.
- Copy visual importante.
- Diseno principal.
- Estrategia de cache offline.

## Riesgos detectados

1. `backend-unreachable` sigue colapsando visualmente a `offline`; el modelo lo distingue, la UX aun no.
2. `auth-required` puede significar login ausente, sesion expirada o perfil local sin token; falta separar esas causas.
3. `offline-cache` depende de senales por pantalla; no existe un manifest global de snapshots disponibles.
4. `offline-no-snapshot` aun no tiene UX diferenciada por modulo.
5. Realtime diferido existe dentro del hook, pero no se publica como estado global.
6. Refresh failures se expresan como strings de error; falta tiparlos por causa.
7. La severidad es derivada localmente, no una politica de producto validada.

## Roadmap

### Corto plazo

- Usar `OperationalState` para analytics/logs internos de fallos offline/sync.
- Separar `auth-required` en `auth-expired`, `auth-missing` y `offline-profile`.
- Estandarizar mensajes UX por `OperationalStateCode`.

### Mediano plazo

- Publicar un hook por modulo, por ejemplo `usePlanningOperationalState`.
- Agregar manifest local de snapshots para saber si existe cache antes de intentar leer cada pantalla.
- Exponer estado realtime diferido como lectura derivada, sin acoplarlo al proveedor.

### Largo plazo

- Centro operacional global con estados por modulo.
- Politicas de severidad y SLA de frescura por dataset.
- Observabilidad durable para sync, conflictos y degradacion.
