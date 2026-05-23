# Contratos Offline por Modulo

Ultima actualizacion: 2026-05-23

Este documento formaliza el comportamiento offline actual por modulo. No define una reescritura del sistema offline; documenta el contrato operativo vigente y marca las evoluciones necesarias para una plataforma industrial mas robusta.

## Principios

- La fuente de verdad operacional es el backend.
- Los datos offline de negocio viven en IndexedDB mediante `src/lib/localOfflineStore.ts`.
- Cache Storage y el Service Worker son solo soporte de shell, rutas y assets; no son fuente de verdad de datos.
- Las APIs `/api/*` no se cachean en el Service Worker.
- La conectividad oficial se decide en `src/lib/networkStatus.ts`, combinando `navigator.onLine` con heartbeat a `/api/health`.
- La UI expone estado binario: `online` u `offline`.
- Solo planning soporta escritura offline eventual hoy.

## Clasificacion

| Clasificacion | Significado |
| --- | --- |
| `online-only` | Requiere backend disponible para leer o escribir. |
| `offline-read` | Puede leer datos locales previamente sincronizados. |
| `offline-write eventual` | Puede aceptar mutaciones locales y sincronizarlas despues. |
| `offline-cache only` | Muestra snapshot/cache local sin prometer consistencia actual. |
| `realtime-dependent` | Usa realtime para invalidar/refrescar, pero debe funcionar con fallback por fetch/cache. |

## Matriz por Modulo

| Modulo | Lectura offline | Escritura offline | Cache local | Sync | Realtime | Source of truth | Estado real |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Planning | Si, por fecha cacheada | Si, cola eventual | `planningByDate`, `planning-catalog` | Cola FIFO con reintentos | Si, Supabase Realtime | Backend | Offline-capable parcial |
| Catalogo planning | Si, ultimo catalogo | No | `keyval: planning-catalog` | Refresco online exitoso | No | Backend | Offline-read parcial |
| Reports | Si, snapshots por filtros | No | `reports-data-v1-*`, `reports-catalog-v1` | Refresco online exitoso | No | Backend | Offline-cache only |
| Dashboard | Si, snapshot agregado | No | `reports-data-v1-*` | Refresco online exitoso | No | Backend | Offline-cache only |
| Auth/session | Perfil local parcial | No | `auth-profile` | `/api/profile/sync` online | Supabase auth events | Auth provider/backend | Degradacion parcial |
| Realtime | No aplica como modulo de datos | No | No persiste eventos | Refetch tras evento | Si | Backend | Online-only con fallback |
| Mutation queue | Si, cola persistida | Si, solo planning | `planning-mutation-queue` | Reintento automatico | No | Backend tras confirmacion | Offline-write eventual |
| IndexedDB/local cache | Si | Si, segun clave | `mineria-offline-store` | Manual por modulo | No | Backend | Infra local |
| Service Worker/PWA | Shell parcial | No | Cache Storage `mineria-*` | Actualizacion SW/browser | No | App server | Shell-cache only |

## Almacenamiento Local

Base IndexedDB:

- Nombre: `mineria-offline-store`
- Version: `1`
- Stores: `keyval`, `planningByDate`

| Store | Clave | Contenido | Escritor principal | Expiracion actual |
| --- | --- | --- | --- | --- |
| `planningByDate` | `YYYY-MM-DD` | Items de planning para una fecha | Home planning tras GET exitoso | Sin TTL |
| `keyval` | `planning-catalog` | Catalogo de planning | Home planning tras GET exitoso | Sin TTL |
| `keyval` | `auth-profile` | Perfil aprobado/cacheado | `AuthProvider` tras sync exitoso | Sin TTL |
| `keyval` | `planning-mutation-queue` | Cola de mutaciones planning | Home planning ante cambios de cola | Sin TTL |
| `keyval` | `reports-catalog-v1` | Catalogo usado por reportes | Reports tras GET exitoso | Sin TTL |
| `keyval` | `reports-data-v1-*` | Snapshot de reportes por query | Reports/Dashboard tras GET exitoso | Sin TTL |
| `keyval` | `admin-users-v1` | Snapshot de usuarios admin | Admin users tras GET exitoso | Sin TTL |

No existe hoy expiracion automatica, limpieza por version de schema local, compactacion de cola ni namespacing por tenant/faena. La frescura se comunica con `updatedAt` cuando la pantalla lo muestra.

## Contrato: Planning

**Clasificacion:** `offline-read`, `offline-write eventual`, `realtime-dependent`.

Datos cacheados:

- Items de planning por fecha en `planningByDate`.
- Catalogo operativo en `keyval: planning-catalog`.
- Mutaciones pendientes en `keyval: planning-mutation-queue`.

Lectura:

- Online: GET `/api/planning-items?date=...` y GET `/api/planning-catalog`.
- Al cargar correctamente, guarda snapshot local.
- Offline o error de red: intenta leer cache por fecha y catalogo local.
- Si no hay cache para la fecha, muestra error operativo; existe riesgo de mantener visualmente datos previos si no se limpia estado en todos los caminos.

Escritura:

- Online: intenta POST/PATCH/DELETE `/api/planning-items`.
- Offline, error de red o sesion invalida recuperable: encola mutacion local.
- Cada mutacion pendiente incluye `id`, `method`, `payload`, `createdAt`, `client_mutation_id` y estado opcional.
- Las mutaciones pendientes se renderizan de forma optimista con `sync_status: "pending"`.

Sincronizacion:

- Se dispara por cambios de red, intervalo de 30 segundos, cambios de sesion/token y cambios en cola.
- No sincroniza si no hay `access_token`, si ya esta sincronizando, si no hay pendientes retryables o si `isBrowserOffline()` retorna true.
- Procesa en orden.
- Errores retryables mantienen la mutacion y detienen el lote.
- Errores no retryables pasan a `status: "conflict"` con `lastError` y `lastTriedAt`.
- Tras sincronizar o detectar conflicto, refresca planning desde backend.

Conflictos:

- Conflictos posibles: solapes de eventos reales, registros eliminados/actualizados por otro usuario, cambios de catalogo entre el momento offline y la sincronizacion, sesion expirada.
- El sistema distingue conflictos no retryables, pero la resolucion actual es limitada: el usuario puede descartar conflictos; no existe merge guiado.

Expectativa de usuario:

- Puede consultar la ultima planificacion guardada de una fecha.
- Puede crear, editar o eliminar registros y verlos como pendientes.
- Al volver la conexion, la app intenta sincronizar automaticamente.
- La confirmacion final depende del backend.

## Contrato: Catalogo Planning

**Clasificacion:** `offline-read`, `online-only` para escritura.

Datos cacheados:

- Catalogo de categorias, tipos, detalles y niveles en `keyval: planning-catalog`.

Lectura:

- Online: GET `/api/planning-catalog`.
- Offline o error: fallback a `readCatalogCache`.
- Planning usa este catalogo local para mantener formularios y labels disponibles.

Escritura:

- Crear/editar/eliminar tipos, detalles o niveles requiere backend y usuario admin.
- No hay cola offline para cambios de catalogo.
- Si un admin intenta operar sin red, el cambio falla con mensaje de conectividad.

Riesgo:

- Una mutacion planning offline puede quedar basada en un catalogo local que luego cambio en backend; la validacion final ocurre al sincronizar.

## Contrato: Reports

**Clasificacion:** `offline-cache only`.

Datos cacheados:

- Catalogo auxiliar: `keyval: reports-catalog-v1`.
- Reporte por filtros: `keyval: reports-data-v1-${query}`.

Lectura:

- Online: GET `/api/reports?...` y GET `/api/planning-catalog`.
- Antes de pedir red, puede precargar snapshot local para evitar pantalla vacia.
- Offline o error de red: usa snapshot local si existe.

Escritura:

- No hay escritura operacional offline.
- La exportacion CSV/Excel usa las filas visibles actuales; puede operar sobre snapshot local.

Conflictos:

- No hay conflictos de escritura porque es lectura.
- Riesgo principal: snapshot obsoleto o filtros sin snapshot previo.

Expectativa de usuario:

- Puede consultar el ultimo reporte disponible para filtros ya sincronizados.
- Si cambia filtros a una combinacion no cacheada y no hay red, debe ver mensaje de ausencia de datos locales.

## Contrato: Dashboard

**Clasificacion:** `offline-cache only`.

Datos cacheados:

- Usa snapshots de reportes con filtros iniciales mediante `reports-data-v1-*`.

Lectura:

- Online: GET `/api/reports` con filtros iniciales.
- Offline: muestra ultimo snapshot agregado si existe.

Escritura:

- No aplica.

Riesgo:

- Comparte mecanismo con reportes, por lo que hereda falta de TTL, versionado y namespacing.

## Contrato: Auth/Session

**Clasificacion:** degradacion parcial; login y cambios de acceso son `online-only`.

Datos cacheados:

- Perfil de aplicacion en `keyval: auth-profile`.

Lectura:

- `AuthProvider` intenta recuperar perfil cacheado para reducir loaders indefinidos y permitir continuidad visual local.
- La sesion Supabase se recupera con `supabaseAuth.auth.getSession()` con timeout defensivo.
- Si hay perfil local sin sesion activa, la shell puede mostrar sesion local, pero no debe interpretarse como autenticacion online completa.

Escritura/autenticacion:

- Login, callback OAuth/email y solicitud de acceso requieren red.
- `/api/profile/sync` requiere token valido y backend disponible.
- Sign out llama a Supabase Auth y navega a `/login`.

Riesgo:

- Perfil local puede estar desactualizado respecto a permisos reales.
- Una sesion expirada puede dejar mutaciones planning pendientes hasta recuperar token.
- No existe contrato formal de "offline identity" ni token refresh offline garantizado.

## Contrato: Realtime

**Clasificacion:** `online-only`, `realtime-dependent` para invalidacion de planning.

Comportamiento:

- Usa Supabase Realtime desde `supabaseAuth`.
- Solo abre canal si hay `accessToken` y `isBrowserOffline()` es false.
- Canal por fecha: `planning-items-${selectedDate}`.
- Escucha INSERT/UPDATE/DELETE en `planning_items` y `activity_execution_segments`.
- Eventos programan refresh con debounce de 350 ms.
- Si la pestana esta oculta o la red cae, marca refresh diferido.

Contrato operativo:

- Realtime no es fuente de verdad.
- Realtime solo invalida/refresca.
- Si realtime falla, planning debe seguir funcionando mediante fetch manual, heartbeat y cache local.

Riesgo:

- Sigue acoplado a Supabase Realtime desde capa cliente/presentation.
- No hay adapter realtime formal ni estrategia de replay de eventos perdidos.

## Contrato: Mutation Queue

**Clasificacion:** `offline-write eventual`, acotado a planning.

Datos:

- Store: `keyval`
- Clave: `planning-mutation-queue`
- Legacy: migra una vez desde `localStorage: mineria.pendingPlanningMutations.v1`.

Garantias actuales:

- Persistencia local de la cola.
- Inyeccion de `client_mutation_id` para idempotencia en creacion.
- Reintentos automaticos.
- Estado `conflict` para errores no retryables.

No garantizado hoy:

- Backoff exponencial.
- Reintentos por prioridad.
- Locks cross-tab.
- Versionado de payloads.
- Namespacing por tenant/faena.
- Resolucion guiada de conflictos.
- Observabilidad durable de intentos.

## Contrato: IndexedDB/Local Cache

**Clasificacion:** infraestructura local compartida.

Responsabilidad:

- Persistir snapshots y cola.
- Adjuntar `updatedAt`.
- Exponer helpers por clave/fecha.

Fuera de alcance actual:

- TTL.
- Migraciones de schema versionadas mas alla de crear stores.
- Encriptacion local.
- Purga por usuario/tenant/faena.
- Deteccion de cuota agotada.
- Reparacion ante corrupcion.

## Flujo Operacional

### Se pierde internet

1. `networkStatus` recibe `offline`, falla heartbeat o detecta error de red.
2. El estado visible pasa a `offline`.
3. Planning intenta usar cache por fecha/catalogo; reportes/dashboard/admin usuarios usan snapshots.
4. Realtime no abre nuevos canales y no se considera fuente disponible.
5. Mutaciones planning se encolan si el usuario intenta escribir.

### Falla backend con navegador aparentemente online

1. Heartbeat a `/api/health` falla o expira.
2. La app trata el estado como `offline`.
3. Las lecturas usan fallback local cuando existe.
4. Las escrituras planning se guardan en cola si el error es retryable.

### Expira auth o no hay token

1. Lecturas protegidas no pueden confirmarse contra backend.
2. AuthProvider puede mostrar perfil local si existe.
3. Planning puede aceptar cola local si esta offline.
4. La sincronizacion queda detenida hasta disponer de `access_token`.

### Hay mutaciones pendientes

1. La cola se persiste en IndexedDB.
2. Planning muestra contador/estado y render optimista de registros pendientes.
3. La cola se reintenta cuando red/sesion lo permiten.
4. Conflictos quedan marcados y requieren accion del usuario.

### Vuelve la conexion

1. Heartbeat confirma `/api/health`.
2. Shell limpia vistas offline renderizadas localmente.
3. Planning intenta sincronizar cola.
4. Pantallas con snapshots refrescan datos online al recibir cambio de red.
5. Planning realtime puede volver a suscribirse si hay token.

## Inconsistencias y Riesgos Actuales

1. No hay TTL ni politica de expiracion por modulo.
2. No hay namespacing por usuario, tenant o faena en IndexedDB.
3. Planning tiene escritura offline, pero catalogo no; una mutacion puede depender de catalogo obsoleto.
4. Realtime esta formalmente desacoplado de la fuente de verdad, pero tecnicamente sigue acoplado a Supabase en cliente.
5. No hay lock cross-tab para la cola; dos pestanas podrian intentar sincronizar.
6. No hay versionado de payloads offline; cambios futuros de DTO pueden afectar colas antiguas.
7. No hay schema versioning funcional de snapshots mas alla de claves `*-v1`.
8. Los snapshots de reports/dashboard/admin pueden mostrarse obsoletos sin una politica uniforme de frescura maxima.
9. Offline navigation evita parte del problema con `OfflineRouteContent`, pero hard reload offline sigue siendo parcial en App Router.
10. La deteccion inicial puede mostrar offline hasta que el heartbeat confirme online.

## Recomendaciones Futuras

### Corto plazo

- Declarar en cada modulo nuevo su politica: `online-only`, `offline-read`, `offline-write eventual` u `offline-cache only`.
- Agregar metadata comun a snapshots: `schemaVersion`, `userId`, `tenantId/faenaId` futuro, `expiresAt` opcional.
- Limpiar explicitamente estados visuales cuando no existe cache para la fecha/filtro solicitado.
- Centralizar tipos de cola planning fuera de `page.tsx`.
- Documentar mensajes UX estandar para offline, pending-sync, conflict y sync-error.

### Mediano plazo

- Crear un `sync engine` interno con backoff, locks cross-tab, metricas y politicas por modulo.
- Versionar payloads de mutaciones offline.
- Introducir resolucion guiada de conflictos para planning.
- Separar realtime en adapter/hook formal con contrato provider-agnostic.
- Agregar observabilidad de cola: intentos, errores, latencia de sync y descartes.

### Largo plazo

- Namespacing multi-tenant/multi-faena en IndexedDB.
- Politicas de retencion y purga por faena, usuario y sensibilidad.
- Soporte offline industrial serio por modulo, con contratos de consistencia y reconciliacion.
- Event log local por modulo para replay controlado.
- Cifrado local si se almacenan datos sensibles de operacion o usuarios.

## Confirmacion de Capacidades Actuales

Realmente offline-capable hoy:

- Planning lectura por fecha ya cacheada.
- Planning escritura eventual para POST/PATCH/DELETE de items.
- Cola de mutaciones planning persistida.

Degradacion parcial:

- Catalogo planning como lectura local.
- Reports con snapshots.
- Dashboard con snapshot.
- Admin usuarios con snapshot.
- Auth/session con perfil local cacheado.
- Navegacion offline dentro de shell ya cargada.

Online-only:

- Login, callback y solicitud de acceso.
- Mutaciones de catalogo.
- Mutaciones de usuarios/admin.
- Realtime.
- Cualquier lectura sin snapshot/cache local previo.

