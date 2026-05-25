# IndexedDB y Local Offline Store

Ultima actualizacion: 2026-05-24

Este documento inventaria el almacenamiento local actual de la plataforma. No cambia el contrato funcional vigente: documenta el schema existente, las claves actuales y el camino seguro para evolucionar IndexedDB sin romper datos offline ya guardados.

## Schema actual

| Campo | Valor |
| --- | --- |
| DB name | `mineria-offline-store` |
| DB version | `1` |
| Archivo principal | `src/lib/localOfflineStore.ts` |
| Stores | `keyval`, `planningByDate` |
| Migraciones IDB actuales | Solo creacion defensiva de stores en `onupgradeneeded` |

### Store `keyval`

| Clave actual | Dataset | Contenido | Modulo lector/escritor | Compatibilidad |
| --- | --- | --- | --- | --- |
| `planning-catalog` | `planning.catalog` | Catalogo de categorias, tipos, detalles y niveles | Home planning, catalogo planning | Legacy activa |
| `auth-profile` | `auth.profile` | Perfil de aplicacion cacheado | `AuthProvider` | Legacy activa |
| `planning-mutation-queue` | `planning.mutationQueue` | Cola de mutaciones planning pendientes | Planning mutation queue store | Legacy activa |
| `reports-catalog-v1` | Reports catalog snapshot | Catalogo auxiliar de reportes | Reports | Legacy activa |
| `reports-data-v1-${query}` | Reports data snapshot | Respuesta de reportes por filtros | Reports/Dashboard/OfflineRouteContent | Legacy activa |
| `admin-users-v1` | Admin users snapshot | Listado de usuarios admin | Admin users/OfflineRouteContent | Legacy activa |

Todos los registros `keyval` se guardan como:

```ts
{
  key: string,
  value: unknown,
  updatedAt: string
}
```

### Store `planningByDate`

| Clave actual | Dataset | Contenido | Modulo lector/escritor | Compatibilidad |
| --- | --- | --- | --- | --- |
| `YYYY-MM-DD` | `planning.byDate` | Items de planning para una fecha | Home planning | Legacy activa |

Los registros `planningByDate` se guardan como:

```ts
{
  date: string,
  items: unknown,
  updatedAt: string
}
```

## LocalStorage y SessionStorage

| Storage | Clave | Uso | Estado |
| --- | --- | --- | --- |
| `localStorage` | `mineria.pendingPlanningMutations.v1` | Cola planning legacy previa a IndexedDB | Se migra una vez a `keyval: planning-mutation-queue` y luego se elimina |
| `sessionStorage` | `mineria-sw-controller-reload-v2` | Evita reload infinito al cambiar controlador Service Worker | No contiene datos de negocio |

No se detectan otros usos activos de `localStorage` para datos de negocio.

## Cache Storage

El Service Worker usa Cache Storage solo para shell/rutas/assets. No cachea APIs de negocio ni reemplaza IndexedDB.

| Cache | Uso |
| --- | --- |
| `mineria-*` | Caches de shell/assets/rutas criticas; se limpian en desarrollo/localhost desde `PwaRegister` |

## Mejoras seguras aplicadas en ID 13

- Constantes exportadas para DB, version, stores, keys y datasets en `src/lib/localOfflineStore.ts`.
- Helpers puros para construir claves con scope futuro:
  - `hasOfflineStorageScope`
  - `buildOfflineStorageKey`
  - `buildPlanningDateCacheKey`
- Compatibilidad con claves legacy cuando no hay scope real.
- Fallback de lectura desde clave scoped futura hacia clave legacy, para una transicion controlada.
- Soporte opcional de `OfflineStorageScope` en snapshots y cola, sin cambiar llamadas actuales.
- Tests de constantes y generacion de claves.

## Riesgos identificados

1. Las claves activas siguen siendo globales porque la app aun no entrega `userId`, `organizationId` y `siteId` como scope real.
2. No hay TTL ni expiracion automatica por dataset.
3. No hay limpieza por usuario/faena ni purga al cambiar de contexto operacional.
4. No hay migraciones formales por version de payload o snapshot.
5. La DB sigue en version `1`; subirla sin plan podria afectar caches offline existentes.
6. La cola planning no tiene lock cross-tab; dos pestanas podrian intentar sincronizar.
7. `reports-data-v1-*` depende de query string; cambios de filtros o serializacion pueden crear snapshots paralelos.
8. Hard reload offline sigue siendo parcial porque depende del shell/chunks disponibles en Cache Storage, no solo de IndexedDB.
9. No hay politica uniforme de frescura maxima; `updatedAt` se muestra cuando la UI lo soporta, pero no invalida datos.

## Roadmap recomendado

### Fase 1: Preparacion sin migrar datos

- Mantener DB version `1`.
- Seguir usando claves legacy hasta que exista scope operacional real.
- Agregar metadata comun a nuevos snapshots: `schemaVersion`, `dataset`, `updatedAt`, `expiresAt` opcional.
- Definir TTL por dataset sin borrar datos automaticamente todavia.

### Fase 2: Scope real multi-tenant/faena

- Pasar `OfflineStorageScope` desde auth/contexto operacional a planning, reports, dashboard y admin.
- Guardar nuevas entradas con prefijo `v2:user:{userId}:org:{organizationId}:site:{siteId}:...`.
- Mantener fallback legacy solo durante ventana de transicion.
- Mostrar mensaje operacional si se detectan datos legacy sin scope en un contexto scoped.

### Fase 3: Migraciones y limpieza

- Subir IndexedDB a version `2` solo con plan de migracion probado.
- Agregar store de metadata o manifest local por dataset.
- Implementar limpieza por TTL y por scope.
- Agregar comando/helper de purga segura por usuario/faena.
- Versionar payloads de mutaciones offline.

### Fase 4: Operacion offline industrial

- Lock cross-tab para la cola.
- Backoff durable y observabilidad de intentos.
- Politicas de retencion por sensibilidad de datos.
- Event log local por modulo si se requiere replay controlado.
