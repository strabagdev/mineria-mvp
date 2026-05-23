# Boundaries de Dominios Internos

Ultima actualizacion: 2026-05-23

Este documento define los limites internos de dominio de la plataforma. Su objetivo es evitar que nuevas funcionalidades crezcan como archivos dispersos o paginas monoliticas. Es una guia organizacional; no implica mover masivamente codigo existente ni cambiar comportamiento.

## Principio Rector

Cada dominio debe tener ownership claro de:

- conceptos de negocio que nombra;
- contratos API/DTO cuando aplique;
- hooks o clientes application que consume la UI;
- services server-side que aplican reglas;
- repositories que acceden a persistencia;
- politica offline/realtime si corresponde.

`src/app` debe componer pantallas y exponer API routes; no debe convertirse en el lugar donde vive el dominio completo.

## Mapa Actual vs Objetivo

| Dominio | Estado actual | Objetivo incremental |
| --- | --- | --- |
| Planning | Parcialmente modularizado en `src/modules/planning`; server aun en `src/server/services` y `src/server/repositories`; UI en `src/app/(app)/page.tsx` y `src/components/planning`. | Mantener `src/modules/planning` como centro del dominio cliente/contratos/sync/realtime; migrar server planning de forma gradual cuando convenga. |
| Catalogo planning | Integrado en planning: route propia, service/repository propios, UI en `CatalogSheet`. | Tratarlo como subdominio de planning mientras solo alimente actividades/interferencias/niveles. |
| Reporting | UI en `/reports` y `/dashboard`; logica y snapshots en `src/lib/reports*`; server en `reports.service/repository`. | Crear `src/modules/reporting` en una pasada futura para contracts, application client, offline snapshots y helpers de presentacion. |
| Auth/access | Cliente modularizado en `src/modules/auth/application`; provider React en `src/providers`; server boundary en `src/server/auth`; access rules en `access.service`. | Mantener auth provider/client facade; extraer access/profile types propios y reducir dependencia de tipos Supabase server cuando sea seguro. |
| Sync/offline | Planning sync en `src/modules/planning/sync`; IndexedDB y snapshots generales en `src/lib/localOfflineStore` y `reportsOfflineSnapshot`; PWA en `public/sw.js` y `pwa-register`. | Separar `src/modules/offline` o `src/modules/sync` cuando haya mas de un modulo con escritura eventual. Por ahora planning sync sigue dentro de planning. |
| Connectivity | `src/lib/networkStatus.ts`; consumido transversalmente por UI y offline. | Mantener como cross-cutting platform boundary; no duplicar probes ni listeners por dominio. |
| Audit | `src/lib/auditLog.ts` + `src/server/repositories/audit.repository.ts`; llamado desde services. | Crear boundary server `src/server/audit` o `src/modules/audit/server` cuando crezca; nunca llamar audit desde UI. |
| Realtime | Adapter planning en `src/modules/planning/realtime`; README en `src/server/realtime`. | Mantener adapters por dominio; si aparece mas realtime, crear contratos compartidos en `src/modules/realtime` o `src/server/realtime`. |
| Users/admin | UI en `/admin/users`; server en users service/repository; snapshots en reports offline helper. | Definir modulo `access-admin` o `users` si crecen permisos, auditoria y multi-faena. |

## Boundaries por Dominio

## Planning

Responsabilidad:

- Planificacion operacional diaria.
- Items programados y eventos reales.
- Gantt, turnos, duraciones, agrupacion y continuidad visual.
- Mutaciones offline eventuales de planning.
- Realtime de invalidacion para planning.

Archivos actuales:

- `src/app/(app)/page.tsx`
- `src/app/api/planning-items/route.ts`
- `src/app/api/planning-catalog/route.ts`
- `src/components/planning/**`
- `src/modules/planning/application/**`
- `src/modules/planning/contracts/**`
- `src/modules/planning/presentation/**`
- `src/modules/planning/realtime/**`
- `src/modules/planning/sync/**`
- `src/server/services/planning-items.service.ts`
- `src/server/services/planning-catalog.service.ts`
- `src/server/repositories/planning-items.repository.ts`
- `src/server/repositories/planning-segments.repository.ts`
- `src/server/repositories/planning-catalog.repository.ts`

Debe vivir aqui:

- DTOs de planning y catalogo planning.
- Clientes HTTP de planning.
- Helpers deterministicos de Gantt/turnos/agrupacion.
- Hooks presentation/application de planning.
- Sync queue de planning mientras sea la unica escritura offline eventual.
- Adapter realtime especifico de planning.

No debe vivir aqui:

- Logica generica de IndexedDB para toda la app.
- Reportabilidad agregada.
- Administracion de usuarios.
- Guards auth transversales.
- SDK Supabase directo en UI/presentation.

Dependencias permitidas:

- `src/lib/networkStatus` para conectividad.
- `src/lib/localOfflineStore` como infraestructura local existente.
- `src/modules/auth/application` solo via contexto/session consumida por UI.
- API routes protegidas.

Dependencias prohibidas:

- `supabase.from` o DB SDK desde UI.
- Realtime Supabase directo fuera del adapter `planning/realtime`.
- Escrituras offline ad hoc fuera de `planning/sync`.

## Catalogo Planning

Responsabilidad:

- Tipos, detalles y niveles usados por planning.
- Validacion de seleccion catalogo/tipo/detalle.
- CRUD admin de catalogo planning.

Archivos actuales:

- `src/app/api/planning-catalog/route.ts`
- `src/components/planning/catalog-sheet.tsx`
- `src/modules/planning/contracts/planning-catalog.ts`
- `src/modules/planning/presentation/use-planning-catalog-admin.ts`
- `src/server/services/planning-catalog.service.ts`
- `src/server/repositories/planning-catalog.repository.ts`

Debe vivir aqui:

- Contratos HTTP de catalogo planning.
- Reglas de CRUD catalogo.
- Normalizacion de labels/slugs de catalogo.

No debe vivir aqui:

- Catalogos de otros dominios futuros.
- Report filters genericos, salvo consumo como snapshot.

Dependencias permitidas:

- Auth admin/aprobado en API routes.
- Audit desde service.
- Repository catalogo.

Dependencias prohibidas:

- Queue offline de catalogo sin contrato propio.
- Mutaciones desde UI sin pasar por API route.

## Reporting

Responsabilidad:

- Reportes operacionales, dashboard y exportacion de filas.
- Agregaciones de planning real/programado/interferencias.
- Snapshots offline de lectura para reportes/dashboard.

Archivos actuales:

- `src/app/(app)/reports/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/api/reports/route.ts`
- `src/lib/reports.ts`
- `src/lib/reportsOfflineSnapshot.ts`
- `src/server/services/reports.service.ts`
- `src/server/repositories/reports.repository.ts`
- `src/components/metric-card.tsx`
- `src/components/offline-route-content.tsx` para vistas offline de dashboard/reportes.

Debe vivir aqui:

- DTOs/contratos de reportes.
- Helpers de filtros, labels, duraciones y CSV.
- Cliente HTTP de reportes.
- Snapshots offline especificos de reporting.
- Hooks application de reports/dashboard.

No debe vivir aqui:

- Reglas autoritativas de planning.
- Mutaciones operacionales.
- Cache local generica no especifica del dominio.

Dependencias permitidas:

- Planning como fuente de datos server-side via repositories/service, no via UI.
- Connectivity/offline snapshot infrastructure.
- Auth guards en API.

Dependencias prohibidas:

- Escritura a planning desde reporting.
- Uso directo de Supabase desde report pages.

## Auth / Access

Responsabilidad:

- Sesion de usuario.
- Login/callback/sign out cliente.
- Perfil aprobado de aplicacion.
- Roles `admin` / `viewer`.
- Guards server `authenticated`, `approved`, `admin`.

Archivos actuales:

- `src/modules/auth/application/**`
- `src/providers/auth-provider.tsx`
- `src/app/login/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/app/api/auth/request-access/route.ts`
- `src/app/api/profile/sync/route.ts`
- `src/server/auth/**`
- `src/server/services/access.service.ts`
- `src/server/services/profile.service.ts`
- `src/server/repositories/access.repository.ts`
- `src/server/repositories/profile.repository.ts`
- `src/lib/accessControl.ts`
- `src/lib/requireAuthUser.ts`
- `src/lib/authClient.ts` como adapter Supabase cliente actual.

Debe vivir aqui:

- Tipos propios `AppUser`, `AppSession`, `AppAuthProfile`.
- Facade cliente de auth.
- Validacion server de token/sesion.
- Reglas de acceso y perfil aprobado.

No debe vivir aqui:

- Reglas de planning/catalog/reporting.
- Estado visual de navegacion excepto provider/contexto.
- Realtime planning, aunque use token auth.

Dependencias permitidas:

- Provider Supabase dentro de adapters actuales.
- Repositories access/profile/users.
- Audit desde workflows server que cambian usuarios/perfiles.

Dependencias prohibidas:

- Uso directo de `supabase.auth.*` desde paginas/componentes.
- Decidir permisos sensibles solo en UI.

## Users / Admin Access

Responsabilidad:

- Listado y administracion de usuarios.
- Creacion de cuentas.
- Reset de password.
- Activacion, rol y approval status.

Archivos actuales:

- `src/app/(app)/admin/users/page.tsx`
- `src/app/api/users/route.ts`
- `src/server/services/users.service.ts`
- `src/server/repositories/users.repository.ts`
- `src/server/auth/auth-admin.ts`
- Snapshot offline en `src/lib/reportsOfflineSnapshot.ts`.

Debe vivir aqui:

- Contratos de administracion de usuarios.
- Hooks/clients application para `/api/users`.
- Snapshot offline especifico de usuarios si se separa.

No debe vivir aqui:

- Auth session provider cliente.
- Reportes generales.
- Planning.

Dependencias permitidas:

- Auth admin boundary.
- Audit.
- Offline snapshot read-only.

Dependencias prohibidas:

- Mutaciones offline de usuarios.
- Acceso admin desde UI sin guard backend.

## Sync / Offline

Responsabilidad:

- Persistencia local.
- Mutation queues.
- Snapshot contracts.
- Reglas de replay/retry/conflict por modulo.

Archivos actuales:

- `src/modules/planning/sync/**`
- `src/lib/localOfflineStore.ts`
- `src/lib/reportsOfflineSnapshot.ts`
- `docs/architecture/offline-contracts.md`
- `public/sw.js`
- `src/components/pwa-register.tsx`
- `src/components/offline-route-content.tsx`

Debe vivir aqui:

- Infraestructura IndexedDB compartida.
- Contratos offline por modulo.
- Helpers de snapshots compartidos.
- Queue/replay cuando sea generico o por modulo.

No debe vivir aqui:

- Validaciones autoritativas de dominio.
- UI compleja de cada pagina.
- Service Worker como cache de APIs de negocio.

Dependencias permitidas:

- Connectivity.
- Domain-specific serializers/DTOs.
- API clients de cada modulo para replay.

Dependencias prohibidas:

- Crear nuevas queues copiadas sin contrato.
- Cachear `/api/*` en Service Worker.
- Guardar snapshots sin version/scope cuando se agregue multi-tenant.

## Connectivity

Responsabilidad:

- Estado operacional `online/offline`.
- Heartbeat a `/api/health`.
- Deteccion de errores de red.
- Eventos de recuperacion.

Archivos actuales:

- `src/lib/networkStatus.ts`
- `src/app/api/health/route.ts`
- consumidores en `SiteShell`, planning, reports/dashboard/admin, auth provider.

Debe vivir aqui:

- Probes centralizados.
- Helpers `isBrowserOffline`, `subscribeNetworkStatus`, `assertBrowserOnline`.
- Mensajes genericos de red.

No debe vivir aqui:

- Reglas de negocio.
- Fetches de dominio.
- Persistencia offline.

Dependencias permitidas:

- API health.
- Browser events.

Dependencias prohibidas:

- Probes manuales dispersos en componentes.
- Estados de conectividad alternativos no coordinados.

## Audit

Responsabilidad:

- Registro server-side de cambios sensibles.
- Actor, entidad, before/after y metadata.

Archivos actuales:

- `src/lib/auditLog.ts`
- `src/server/repositories/audit.repository.ts`
- usos desde services planning/users.

Debe vivir aqui:

- Escritura de audit log.
- Tipos de actor de aplicacion.
- Repository de audit.

No debe vivir aqui:

- UI.
- Reglas de negocio que determinan si una operacion es valida.
- Eventos realtime.

Dependencias permitidas:

- Services server-side.
- Repository audit.

Dependencias prohibidas:

- Llamadas desde componentes cliente.
- Escrituras de audit desde API route si existe service apropiado.

## Realtime

Responsabilidad:

- Suscripciones e invalidacion de datos vivos.
- Adapter del provider realtime activo.

Archivos actuales:

- `src/modules/planning/realtime/planning-realtime-adapter.ts`
- `src/modules/planning/presentation/use-planning-realtime.ts`
- `src/server/realtime/README.md`

Debe vivir aqui:

- Configuracion de canales.
- Eventos/tablas/filtros por dominio.
- Adaptadores provider-specific.
- Contratos de invalidacion/refetch.

No debe vivir aqui:

- Debounce visual si pertenece al hook presentation.
- Mutaciones offline.
- Reglas de dominio.

Dependencias permitidas:

- Auth token como input.
- Provider realtime dentro del adapter.

Dependencias prohibidas:

- `supabase.channel` directo desde paginas/componentes.
- Realtime como fuente de verdad sin fetch/refetch.

## Dependencias Permitidas Entre Dominios

```text
UI pages/components
  -> module presentation/application
  -> API routes
  -> server services
  -> server repositories
  -> provider adapters
```

Dependencias transversales permitidas:

- Cualquier UI puede consumir `useAuth`.
- Application hooks pueden usar `networkStatus` y clientes API.
- Services pueden usar `writeAuditLog`.
- API routes pueden usar guards auth/access.
- Repositories pueden usar `src/server/db`.
- Realtime adapters pueden usar provider realtime activo.

Dependencias prohibidas:

- UI -> Supabase DB/Auth/Realtime directo.
- UI -> repositories/services server.
- API route -> Supabase directo si existe repository/adaptador.
- Dominio A -> componentes internos de dominio B.
- Offline queue nueva sin contrato en `offline-contracts.md`.
- Service Worker -> APIs de negocio cacheadas.

## Deuda Actual Identificada

| Pieza | Deuda | Riesgo |
| --- | --- | --- |
| `src/app/(app)/page.tsx` | Sigue siendo hotspot de planning UI + parte de sync orchestration/forms. | Crecimiento futuro puede volverlo monolitico. |
| `src/lib/reports.ts` | Reporting domain en `lib`. | Nuevos reportes pueden dispersar helpers. |
| `src/lib/reportsOfflineSnapshot.ts` | Mezcla snapshots reports, catalog y admin users. | Ownership poco claro y versionado local dificil. |
| `src/lib/localOfflineStore.ts` | Infraestructura local generica sin namespace por dominio/tenant. | Multi-tenant/faena requerira migracion cuidadosa. |
| `src/lib/accessControl.ts` / `requireAuthUser.ts` | Re-export legacy de server access/auth. | Puede confundir ubicacion oficial de auth server. |
| `src/lib/auditLog.ts` | Audit server helper vive en `lib`. | `lib` mezcla utilidades cliente/servidor. |
| `src/components/offline-route-content.tsx` | Contiene vistas offline de varios dominios. | Puede crecer como pagina paralela no modular. |
| `src/components/planning/**` | Componentes de dominio fuera de `src/modules/planning`. | Aceptable por ahora, pero ownership debe seguir siendo planning. |
| Users/admin | No tiene modulo propio. | Crecimiento de permisos/multi-faena puede acoplarse a auth/report snapshots. |

## Reglas para Nuevos Modulos

1. Crear `src/modules/<domain>/` si el modulo tiene mas que una pantalla simple.
2. Separar `contracts`, `application`, `presentation`, `sync`, `realtime` segun necesidad real.
3. API routes se mantienen en `src/app/api`, pero delegan a services.
4. Server services/repositories pueden seguir en `src/server` durante la transicion.
5. Si el modulo necesita offline, actualizar `docs/architecture/offline-contracts.md`.
6. Si el modulo necesita realtime, crear adapter del dominio.
7. Si el modulo introduce proveedor externo, crear adapter y no exponer SDK en UI.

## Objetivo de Carpetas Futuro

No es obligatorio migrar ahora, pero el objetivo de largo plazo es:

```text
src/modules/planning/
  application/
  contracts/
  presentation/
  realtime/
  sync/
  server/        # futuro: services/repositories del dominio

src/modules/reporting/
  application/
  contracts/
  presentation/
  offline/

src/modules/auth/
  application/
  contracts/
  server/        # futuro o bridge a src/server/auth

src/modules/offline/
  infrastructure/
  contracts/

src/modules/connectivity/
  application/
```

La migracion debe ser por slices funcionales pequenos, con tests y sin cambios de comportamiento.

## Definition of Done Modular

Una nueva funcionalidad queda modularmente aceptable cuando:

1. Tiene dominio owner declarado.
2. No agrega SDK provider directo en UI.
3. No aumenta `src/lib` con logica de dominio salvo excepcion justificada.
4. Tiene contracts/DTOs si cruza HTTP.
5. Tiene policy offline/realtime explicita si aplica.
6. Usa services/repositories para persistencia server.
7. Mantiene errores de auth/offline/conflict diferenciados.
8. Agrega pruebas proporcionales al riesgo.

