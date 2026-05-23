# Estrategia online/offline

Ultima actualizacion: 2026-05-16

Este documento describe como la plataforma maneja conectividad, modo offline, snapshots locales, almacenamiento y recuperacion online. Complementa `docs/OFFLINE.md` y debe mantenerse alineado con la implementacion real.

## 1. Objetivo

La plataforma es una herramienta industrial operacional para faena minera. Su estrategia online/offline busca:

- Mantener informacion operacional visible cuando la red se corta o esta degradada.
- Evitar falsos estados online cuando el navegador reporta conectividad pero el backend no responde.
- Sostener una UX estable en redes lentas, intermitentes o con reconexiones parciales.
- Permitir trabajo offline controlado en planificacion, con cola local y sincronizacion posterior.
- Separar claramente shell/cache PWA de datos de negocio, que viven en IndexedDB.

El objetivo no es prometer una PWA offline-first completa para todos los flujos, sino continuidad operacional razonable con informacion local y estados honestos.

## 2. Fuente de verdad de conectividad

La fuente central esta en `src/lib/networkStatus.ts`.

Senales usadas:

- `navigator.onLine`: senal rapida del navegador. Sirve para detectar desconexion evidente, pero no garantiza que el backend este disponible.
- Heartbeat contra `/api/health`: prueba real contra la aplicacion. Es la senal que confirma estado operacional online.
- Timeout de heartbeat: `2000 ms`.
- Intervalo de heartbeat: `5000 ms`.
- Estado central visible: `online` u `offline`.

`navigator.onLine` no basta porque puede devolver `true` aunque el DNS, proxy, VPN, backend, Supabase o la ruta a la app esten fallando. Por eso el sistema solo considera la plataforma online cuando el heartbeat a `/api/health` responde OK.

Los componentes no deben crear probes propios. Deben usar:

- `subscribeNetworkStatus`
- `getNetworkStatusSnapshot`
- `isBrowserOffline`
- `assertBrowserOnline`
- `probeNetworkRestored` solo desde capas de soporte que ya encapsulan snapshots/recuperacion.

## 3. Estado operacional

La UI expone un semaforo binario:

- `online`: el backend respondio OK a `/api/health`.
- `offline`: no hay conectividad del navegador, fallo el heartbeat, el heartbeat hizo timeout o todavia no se ha confirmado online.

Internamente existe `backendOnline: boolean | null`. Ese `null` funciona como estado inicial/desconocido, pero no es un estado visible. Mientras no haya confirmacion positiva del backend, `getCurrentOperationalStatus()` devuelve `offline`.

Esto evita estados ambiguos para operadores: el semaforo visual sigue siendo binario.

## 4. Flujo de heartbeat

El heartbeat se inicializa desde `ensureNetworkListeners()` cuando algun consumidor usa la capa central de red.

Disparadores:

- Carga inicial si `navigator.onLine` no es `false`.
- Evento `online` del navegador.
- `focus` de ventana.
- `visibilitychange` cuando el documento vuelve a `visible`.
- Intervalo periodico mientras el heartbeat esta activo.
- Errores de red detectados por `isNetworkRequestError`.

Comportamiento:

- Si `navigator.onLine === false`, se cancela heartbeat activo y el estado pasa a `offline`.
- Si `/api/health` responde OK, el estado central pasa a `online`.
- Si `/api/health` responde no OK, falla o excede timeout, el estado pasa a `offline`.
- Si ya hay un heartbeat en vuelo, se reutiliza la promesa para evitar probes simultaneos.
- En desarrollo se registran logs informativos; en produccion se silencian.

## 5. Almacenamiento local

La capa local vive en IndexedDB mediante `src/lib/localOfflineStore.ts`.

Base:

- DB: `mineria-offline-store`
- Version: `1`
- Stores: `keyval` y `planningByDate`

Contenido principal:

| Store | Clave | Contenido |
| --- | --- | --- |
| `keyval` | `planning-catalog` | Catalogo operativo de planning |
| `keyval` | `auth-profile` | Perfil de usuario sincronizado/cacheado |
| `keyval` | `planning-mutation-queue` | Cola offline de mutaciones planning |
| `keyval` | `reports-catalog-v1` | Catalogo usado por reportes/dashboard |
| `keyval` | `reports-data-v1-*` | Snapshots de reportes por filtros |
| `keyval` | `admin-users-v1` | Snapshot de usuarios admin |
| `planningByDate` | `YYYY-MM-DD` | Items planning por fecha |

Vistas con snapshots offline:

- Home/planning: catalogo e items por fecha.
- Dashboard: ultimo snapshot de reportes agregado.
- Reportes: catalogo y reporte por filtros.
- Admin usuarios: ultimo listado de usuarios.
- AuthProvider: perfil cacheado para continuidad local.

Los snapshots se actualizan luego de respuestas online exitosas. Se leen cuando la red esta offline, cuando una request falla por red o cuando el flujo necesita mantener informacion visible mientras se recupera conectividad.

## 6. Navegacion offline

Rutas/vistas con soporte offline actual:

- `/`: planificacion, con cache por fecha y cola de mutaciones.
- `/dashboard`: vista offline degradada desde snapshots.
- `/reports`: vista offline degradada desde snapshots.
- `/admin/users`: vista offline degradada desde snapshot de usuarios.
- `/offline`: pagina de fallback PWA.
- `/login`: disponible como shell, pero autenticacion nueva requiere red.

`src/components/site-shell.tsx` evita depender exclusivamente del router o del Service Worker cuando el usuario ya esta dentro de la app. Si `isBrowserOffline()` retorna true al hacer click en navegacion lateral:

- Se previene la navegacion normal.
- Se cambia `offlineView` local para renderizar `OfflineRouteContent`.
- La vista offline se alimenta de snapshots locales.
- Al volver `online`, `offlineView` se limpia.

Esto reduce errores del App Router y evita pedir chunks/rutas remotas durante navegacion offline. El hard reload offline sigue siendo un riesgo conocido si el shell o chunks necesarios no estan cacheados.

## 7. Service Worker / PWA

El Service Worker (`public/sw.js`) tiene responsabilidad acotada:

- Cachear shell minimo: `/`, `/login`, `/offline`, manifest e iconos.
- Cachear rutas criticas cuando la app lo solicita: `/dashboard`, `/reports`, `/admin/users`.
- Usar network-first para navegaciones shell.
- Usar network-first con fallback cache para `/_next/static/`.
- Usar cache-first para fuentes e imagenes.

Lo que NO debe hacer:

- No debe cachear `/api/*`.
- No debe ser fuente de verdad para datos de negocio.
- No debe interceptar mutaciones.
- No debe ocultar fallas del backend como si fueran datos frescos.

`/api/*` no se cachea porque las APIs criticas requieren autorizacion, datos actuales, validaciones server-side e idempotencia. Los datos offline viven en IndexedDB/snapshots, no en Cache Storage.

Diferencia desarrollo/produccion:

- En `next dev` o `localhost`, `PwaRegister` desregistra service workers y limpia caches `mineria-*`.
- En produccion y contexto seguro, registra `/sw.js`, activa workers en espera y precachea rutas criticas cuando hay red.

## 8. Cola offline y sincronizacion

Aplica principalmente a planificacion (`src/app/(app)/page.tsx`).

Operaciones que pueden quedar pendientes:

- `POST /api/planning-items`
- `PATCH /api/planning-items`
- `DELETE /api/planning-items`

Cada mutacion pendiente incluye:

- `id` local (`crypto.randomUUID()`).
- `method`.
- `payload`.
- `createdAt`.
- `status` opcional (`conflict` para conflictos no retryables).
- `client_mutation_id` inyectado en el payload si no existe.

La cola se guarda en IndexedDB con la clave `planning-mutation-queue`. Existe una migracion legacy desde `localStorage` (`mineria.pendingPlanningMutations.v1`) hacia IndexedDB.

Procesamiento:

- Al cargar cola desde IDB.
- Al cambiar estado de conectividad por `subscribeNetworkStatus`.
- En un intervalo de retry.
- Cuando cambia la sesion/token.
- Cuando cambia la cola.

Antes de enviar, `syncPendingPlanningMutations` valida sesion y `isBrowserOffline()`. Si la red esta offline, no intenta sincronizar.

Duplicacion:

- `client_mutation_id` permite idempotencia backend para inserts.
- Los repositorios/servicios server-side buscan registros por `client_mutation_id` antes de crear duplicados.
- Las mutaciones se procesan en orden y se eliminan de la cola solo cuando fueron aceptadas.

Conflictos:

- Errores retryables mantienen la mutacion en cola y detienen el lote.
- Errores no retryables pasan a `status: "conflict"` con `lastError` y `lastTriedAt`.
- El usuario puede descartar conflictos.

## 9. Realtime

El realtime actual usa Supabase Realtime desde `supabaseAuth`.

Cuando esta online:

- Se setea auth del canal con `session.access_token`.
- Se abre un canal `planning-items-${selectedDate}`.
- Se escuchan cambios en `planning_items` y `activity_execution_segments`.
- Los eventos programan un refresh de planning con debounce de `350 ms`.

Cuando esta offline:

- No se abre canal si no hay sesion o `isBrowserOffline()` retorna true.
- Si llega un evento mientras la pestana esta oculta o la red esta offline, se marca `pendingRealtimeRefreshRef`.
- Al recuperar foco/visibilidad, se intenta refrescar si habia cambios diferidos.

Al cambiar fecha, token o desmontar el componente:

- Se limpian timers.
- Se remueven listeners.
- Se llama `removeChannel(channel)`.

Pendiente: aislar contratos realtime en una capa propia (`src/server/realtime/README.md` ya deja esa direccion) para reducir acoplamiento directo con Supabase Realtime desde UI.

## 10. Login/Auth y conectividad

Auth mezcla tres preocupaciones:

- Sesion Supabase.
- Perfil aprobado de la aplicacion.
- Estado real de conectividad.

Riesgo conocido: falso offline inicial. Al arrancar, `backendOnline` puede estar `null`, que visualmente se interpreta como `offline` hasta que el heartbeat confirme `/api/health`. Esto es deliberado para no prometer online sin prueba real, pero puede mostrar una transicion breve.

Mitigaciones actuales:

- `AuthProvider` lee perfil cacheado antes de forzar red agresivamente.
- `syncProfile` prefiere cache local si ya existe perfil.
- Si no hay cache y hay red operacional, llama `/api/profile/sync`.
- `assertBrowserOnline` bloquea login/callback/request-access cuando la capa central considera que no hay conectividad suficiente.
- Errores de red pasan por `isNetworkRequestError`, que marca offline y dispara heartbeat de recuperacion.
- Hay timers de guarda para evitar loaders indefinidos en redes lentas.

En login, `syncProfile` valida acceso llamando `/api/profile/sync`; si falla, se muestra mensaje operativo. Login nuevo y solicitud de acceso no son flujos offline.

## 11. Reglas de diseno

Reglas obligatorias para cambios futuros:

- No agregar probes manuales dispersos.
- No duplicar listeners `online`/`offline` fuera de la capa central, salvo responsabilidades PWA estrictamente locales.
- No hacer fetch directo a `/api/health` desde componentes.
- Usar siempre `src/lib/networkStatus.ts` como capa central de conectividad.
- No romper snapshots offline existentes.
- No depender solo de `navigator.onLine`.
- No cachear APIs criticas en Service Worker.
- Mantener UI online/offline binaria.
- No convertir Cache Storage en fuente de datos de negocio.
- No mutar cola offline sin persistirla en IndexedDB.
- No remover `client_mutation_id` de mutaciones planning.

## 12. Principio de conectividad

La plataforma distingue entre:

- conectividad del navegador (`navigator.onLine`)
- disponibilidad operacional real del backend (`/api/health`)

`navigator.onLine` solo indica si el navegador cree tener acceso a una red. No garantiza acceso real al backend, DNS, VPN, proxy o servicios internos.

Por eso la plataforma utiliza un heartbeat centralizado contra `/api/health` como fuente de verdad operacional.

Internamente puede existir un estado inicial `unknown/null` hasta completar el primer heartbeat, pero la UI sigue exponiendo únicamente:

- online
- offline

Esto evita:
- falsos online
- falsos offline iniciales
- probes manuales dispersos
- inconsistencias entre componentes

## 13. Checklist para futuros cambios

Antes de mergear cambios relacionados, revisar:

- [ ] Toca `networkStatus`?
- [ ] Toca Service Worker o `PwaRegister`?
- [ ] Toca IndexedDB/localOfflineStore?
- [ ] Toca snapshots offline?
- [ ] Toca realtime/Supabase channels?
- [ ] Toca auth/login/profile sync?
- [ ] Afecta cola offline?
- [ ] Agrega nuevos fetch/probes?
- [ ] Mantiene UI online/offline binaria?
- [ ] Mantiene lint y TypeScript?
- [ ] Fue probado con red normal, red lenta y offline?

## 14. Estado actual y pendientes

Implementado:

- Capa central de conectividad con heartbeat a `/api/health`.
- Semaforo visual binario online/offline en shell.
- IndexedDB unificada para catalogo, perfil, planning por fecha, snapshots y cola.
- Snapshots para planning, dashboard/reportes y admin usuarios.
- Cola offline de planning con `client_mutation_id`.
- Service Worker acotado a shell/assets y sin cache de `/api/*`.
- Realtime Supabase para planning cuando hay sesion y conectividad.
- Limpieza de Service Worker/caches en desarrollo y localhost.

Pendiente o parcial:

- Hard reload offline completo en App Router, especialmente chunks no cacheados.
- Navegacion offline con URL/router completamente alineados en todos los casos.
- Resolver UX de fechas sin cache para planning sin mostrar datos engañosos.
- Backoff unificado para sync offline.
- Resolucion guiada de conflictos.
- Capa formal para contratos realtime y desacople de Supabase en UI.
- Telemetria/observabilidad de eventos offline, sync y conflictos.

Riesgos conocidos:

- Falso offline breve al inicio hasta que `/api/health` confirma online.
- Redes cautivas/VPN/proxy pueden producir alternancia rapida de estado.
- Snapshots pueden estar desactualizados; la UI debe mostrar ultima sincronizacion cuando corresponda.
- APIs criticas no deben cachearse; hacerlo podria mostrar datos privados, stale o inconsistentes.

