# AI Context for Agents

Ultima actualizacion: 2026-05-31

Guia compacta para agentes/LLMs que trabajan en `mineria-mvp`. Lee esto antes
de explorar el repo completo. El objetivo es reducir tokens, evitar cambios fuera
de boundary y preservar invariantes operacionales.

## 1. Resumen del proyecto

`mineria-mvp` es una plataforma web operacional para faena minera: autenticacion,
planificacion diaria, catalogos operativos, reportes/dashboard y administracion
basica de usuarios.

Enfoque principal:

- Continuidad operacional con red intermitente.
- Planificacion como flujo critico de terreno.
- Offline parcial y honesto: no promete PWA offline-first total.
- Backend como fuente de verdad; cache local solo sostiene continuidad.
- Arquitectura incremental: modularizar sin reescrituras masivas.

Modulos/areas principales:

- Auth/access: login, callback, perfil aprobado, roles `admin`/`viewer`.
- Planning: planificacion, Gantt, items programados y eventos reales.
- Planning catalog: categorias, tipos, detalles y niveles.
- Planning custom fields: campos configurables laterales al payload core.
- Planning assignments: catalogo e instancias online-only para grupos
  repetibles configurables.
- Reporting/dashboard: reportes operacionales y snapshots offline de lectura.
- Users/admin: usuarios, aprobacion, roles y snapshot offline degradado.
- Offline/sync: IndexedDB, cola planning, snapshots, conectividad.
- Realtime: invalidacion/refresco planning con Supabase Realtime.
- Observability/events/jobs/integrations: bases internas, aun ligeras.

## 2. Arquitectura resumida

Estilo: modular monolith sobre Next.js App Router + TypeScript + Supabase.

Flujo recomendado de dependencias:

```text
UI / presentation
  -> application hooks / use cases
    -> API routes
      -> services / domain logic
        -> repositories
          -> provider adapters
            -> infrastructure
```

Capas actuales:

- `src/app`: rutas App Router, paginas, layouts y API routes.
- `src/components`: UI reutilizable y componentes de presentacion de dominio.
- `src/modules/<domain>`: contracts, application, presentation, sync/realtime.
- `src/server/services`: workflows y reglas server-side.
- `src/server/repositories`: persistencia y queries.
- `src/server/auth`, `src/server/db`, `src/server/realtime`: boundaries provider.
- `src/lib`: utilidades transversales y fronteras cliente existentes; no usar
  como cajon para dominio nuevo.
- `src/events`: event bus in-process, no persistente.
- `src/jobs`: contratos/base de jobs, sin workers externos dedicados.
- `src/integrations`: contratos provider-neutral, sin integraciones reales aun.
- `supabase/sql`: schema, seed, RLS, constraints y realtime del provider actual.

Server/client:

- UI no debe importar SDKs de DB/provider directo.
- API routes aplican auth guards, parsean contratos y delegan a services.
- Services contienen decisiones de negocio, idempotencia y workflows.
- Repositories conocen tablas/queries, no UI ni HTTP.
- Provider adapters encapsulan Supabase u otros proveedores.

## 3. Reglas criticas e invariantes

No romper payload core de planning:

- `planning_items` y `activity_execution_segments` siguen siendo el core.
- Mantener contratos existentes de `/api/planning-items`.
- No meter custom fields dentro del payload core sin migracion formal.

Custom fields son laterales:

- Viven en `src/modules/planning-custom-fields`.
- Usan APIs/tablas separadas para definiciones, opciones y valores.
- No deben tocar Gantt, reporting, offline/sync ni realtime salvo tarea explicita.

Assignments son grupos repetibles laterales:

- Catalogo e instancias online-only en `src/modules/planning-assignments`.
- `assignment_types`, `assignment_fields` y `assignment_field_options` no son
  entidades prearmadas ni custom fields del programado.
- Las instancias viven fuera del payload core de `planning_items`.
- Las instancias viven en `planning_assignments` y `planning_assignment_values`;
  POST usa reemplazo transaccional lateral por programado.
- No reintroducir `entity_reference` ni `configurable_entities`.

Offline cubre operacion, no administracion completa:

- Escritura offline eventual existe hoy solo para planning.
- Catalogo/admin/users/reportes son online-only para escritura.
- Reportes/dashboard/admin users tienen lectura degradada desde snapshot.

No fetch por hover:

- Evitar requests por hover o interacciones ambiguas.
- Fetch en carga, submit, cambio explicito de filtro/fecha o refresh controlado.

Realtime desacoplado:

- Supabase Realtime solo desde adapter/hook de planning.
- Realtime invalida/refresca; no es fuente de verdad.
- La app debe seguir funcionando con fetch/cache si realtime falla.

Observability central:

- Usar `recordOperationalEvent` desde `src/lib/observability`.
- Eventos operacionales esperados deben ser `info`/`warn`, no errores rojos.
- No loguear tokens, emails, authorization, passwords, payloads sensibles.

Queue idempotente:

- Mutaciones planning offline llevan `client_mutation_id`.
- No eliminar ni renombrar ese campo.
- Backend debe tolerar reintentos sin duplicar inserts.
- Procesar FIFO razonable; conflictos no retryables no deben bloquear todo.

Connectivity central:

- No crear probes propios ni fetch directo a `/api/health` desde componentes.
- Usar `src/lib/networkStatus.ts`.
- `navigator.onLine` no basta; heartbeat a `/api/health` decide online real.

Service Worker limitado:

- No cachear `/api/*`.
- No usar Cache Storage como fuente de datos de negocio.
- Datos de negocio offline viven en IndexedDB.

Auth portability:

- UI usa facade `src/modules/auth/application/auth-client.ts`.
- No importar `supabase.auth.*` desde paginas/componentes.
- No cambiar login/session/callback/token strategy sin tarea dedicada.

Contracts:

- Cambios de response shape son cambios de contrato.
- DTOs compartidos deben vivir en `contracts/` del modulo cuando exista.
- Mantener compatibilidad de imports legacy si el README del modulo lo indica.

## 4. Offline/sync resumido

Fuente local principal:

- IndexedDB `mineria-offline-store` via `src/lib/localOfflineStore.ts`.
- Stores: `keyval`, `planningByDate`.
- Cache Storage/SW solo para shell/assets/rutas, no datos de negocio.

Claves/datasets relevantes:

- `planningByDate: YYYY-MM-DD`: items planning por fecha.
- `keyval: planning-catalog`: catalogo operativo.
- `keyval: auth-profile`: perfil cacheado.
- `keyval: planning-mutation-queue`: cola offline planning.
- `keyval: reports-catalog-v1`: catalogo reporting.
- `keyval: reports-data-v1-*`: snapshots reportes/dashboard.
- `keyval: admin-users-v1`: snapshot usuarios admin.

Planning offline:

- Lectura: GET online guarda cache; red fallida/offline lee cache por fecha.
- Escritura: POST/PATCH/DELETE se encolan si no hay red o error retryable.
- Replay: al cargar cola, reconectar, intervalo, cambio de sesion/token.
- Conflicto: no retryable queda `status: "conflict"` con `lastError`.
- Exito: elimina mutacion aceptada y refresca backend/cache.

Fallbacks:

- AuthProvider puede usar perfil local para continuidad visual.
- Reports/dashboard/admin users muestran ultimo snapshot si existe.
- Si no hay snapshot, mostrar ausencia de datos locales, no datos inventados.

Operational states:

- UI visible usa semaforo binario `online`/`offline`.
- Modelo enriquecido vive en `src/lib/operationalState.ts`.
- Errores esperados por red/fallback son estado operacional, no crash.

## 5. Estructura importante del repo

Lee primero:

- `docs/AI_CONTEXT.md` (este archivo).
- `docs/architecture/internal-architecture.md`.
- `docs/architecture/domain-boundaries.md`.
- `docs/architecture/offline-contracts.md`.
- `docs/OFFLINE_ONLINE_STRATEGY.md`.
- `src/modules/README.md`.

Rutas clave:

- `src/app/(app)/page.tsx`: pantalla planning principal y parte del wiring sync.
- `src/app/api/**/route.ts`: bordes HTTP.
- `src/components/planning/**`: UI/presentacion planning.
- `src/components/site-shell.tsx`: shell, navegacion offline, estado sesion.
- `src/components/offline-route-content.tsx`: vistas offline degradadas.
- `src/providers/auth-provider.tsx`: sesion, perfil cacheado, recuperacion.
- `src/lib/networkStatus.ts`: conectividad, heartbeat, errores de red.
- `src/lib/localOfflineStore.ts`: IndexedDB unificada.
- `src/lib/observability/**`: eventos operacionales locales.
- `src/modules/auth/application/**`: facade auth cliente.
- `src/modules/planning/**`: contracts, clients, sync, realtime, presentation.
- `src/modules/planning-custom-fields/**`: custom fields laterales.
- `src/modules/planning-assignments/**`: catalogo base de asignaciones repetibles.
- `src/modules/reporting/**`: contracts/helpers/offline snapshots reporting.
- `src/server/services/**`: reglas/workflows server.
- `src/server/repositories/**`: queries/persistencia.
- `src/events/**`: event bus in-process.
- `src/integrations/**`: contratos de integraciones futuras.
- `supabase/sql/**`: schema/RLS/seed/realtime.

Evitar tocar salvo tarea explicita:

- Config Supabase/env/auth provider.
- SQL/RLS/constraints.
- Payload core de planning.
- Keys IndexedDB legacy.
- Service Worker caching de APIs.
- Login/session flow.
- Imports legacy preservados por compatibilidad.

## 6. Patrones de implementacion

Para feature nueva:

- Ubicar dominio owner antes de editar.
- Si existe `src/modules/<domain>`, usar `contracts`, `application`,
  `presentation`, `sync` o `realtime` segun corresponda.
- UI compone y delega; no meter SDK provider ni reglas autoritativas.
- API route valida auth/input y delega a service.
- Service decide reglas, idempotencia y workflow.
- Repository encapsula persistencia y mapping cercano a tablas.
- Adapter encapsula proveedor externo o SDK.

Para contracts/DTOs:

- Response/request shapes compartidos en `contracts/`.
- Mantener nombres estables; tratar cambios como breaking.
- No duplicar DTOs parecidos en UI si ya existe contrato.

Para offline:

- Reutilizar `localOfflineStore` y helpers existentes.
- No crear localStorage nuevo para datos de negocio.
- Si se agrega escritura offline fuera de planning, documentar contrato primero.
- No disparar integraciones externas desde mutaciones offline hasta sync canonico.

Para observability:

- Evento pequeno, metadata sanitizada, source claro.
- `info`: ciclo normal.
- `warn`: degradacion operacional esperada/retryable.
- `error`: bug, fallo no esperado o perdida critica.

Para errores:

- No silenciar errores reales de auth/data.
- Tipar errores operacionales si el flujo esperado necesita distinguirlos.
- No convertir errores no-red en fallback offline.

## 7. Que ya esta resuelto

- Auth base con Supabase y facade cliente provider-neutral inicial.
- Auth portability documentada y parcialmente implementada.
- Perfil local cacheado para continuidad visual.
- Planning operacional con lectura cacheada por fecha.
- Cola offline planning en IndexedDB con migracion legacy desde localStorage.
- Idempotencia planning via `client_mutation_id`.
- Planning catalog con cache de lectura y CRUD online.
- Custom fields laterales para planning, sin tocar payload core.
- Catalogo, backend, formulario y detalle online-only de assignments repetibles
  por programado.
- Reporting module inicial con contracts/presentation/offline.
- Dashboard/reportes/admin users con snapshots offline degradados.
- Observability local con buffer y eventos tipados.
- Event bus in-process para base futura, no critico.
- Integrations strategy con contratos provider-neutral, sin providers reales.
- Jobs/contracts base, sin workers separados.
- Operational states modelados en `src/lib/operationalState.ts`.
- Catalog page con administracion de catalogo planning, custom fields y
  definiciones de assignments.

## 8. Que todavia NO existe

- Audit trail formal completo y transversal.
- Multi-tenant/faena real aplicado end-to-end.
- Workers separados o queue persistente externa.
- Outbox/eventos persistentes con entrega garantizada.
- Realtime avanzado o provider-neutral completo.
- Resolucion guiada avanzada de conflictos offline.
- TTL/limpieza/versionado robusto de snapshots IndexedDB.
- Reportes avanzados/export providers externos.
- Offline, reportes y visualizacion Gantt de assignments.
- Integraciones reales (email, Slack, WhatsApp, ERP, Power BI, webhooks).
- Panel admin de observability.
- Offline-first total ni hard reload offline garantizado.
- Modulo users/admin completamente separado.
- Migracion auth fuera de Supabase.

## 9. Guia para agentes

Orden recomendado:

1. Leer `docs/AI_CONTEXT.md`.
2. Leer solo el documento de arquitectura relevante.
3. Buscar en `src/modules/<domain>` y README del modulo.
4. Revisar API route/service/repository si el cambio toca backend.
5. Hacer cambio incremental y localizado.
6. Validar con comandos locales.

Documentos fuente utiles:

- Arquitectura interna: `docs/architecture/internal-architecture.md`.
- Boundaries: `docs/architecture/domain-boundaries.md`.
- Planning assignments: `docs/architecture/planning-assignments.md`.
- Offline contracts: `docs/architecture/offline-contracts.md`.
- Estrategia online/offline: `docs/OFFLINE_ONLINE_STRATEGY.md`.
- IndexedDB: `docs/architecture/indexeddb-local-store.md`.
- Estados operacionales: `docs/architecture/operational-states.md`.
- Observability: `docs/architecture/observability.md`.
- Auth portability: `docs/architecture/auth-provider-portability.md`.
- Integrations: `docs/architecture/integrations-strategy.md`.
- Events: `docs/architecture/internal-events-strategy.md`.
- Modules overview: `src/modules/README.md`.

Comportamiento esperado:

- Preferir reutilizar modulo existente.
- Evitar crear logica paralela en `src/lib` o paginas.
- Minimizar cambios invasivos.
- No hacer refactors masivos para arreglos pequenos.
- Respetar imports legacy cuando el modulo los declara compatibles.
- Separar bugfix de redisenos arquitectonicos.
- Mantener UI y flujos de auth/session si no son el objetivo.

## 10. Como abordar cambios

Diagnostico primero:

- Identificar dominio owner y flujo actual.
- Encontrar llamadores con `rg`.
- Revisar tests cercanos y contratos.
- Confirmar si el caso es bug, deuda o nueva capacidad.

Cambio incremental:

- Editar el menor conjunto de archivos.
- Mantener boundaries y nombres existentes.
- Agregar tipos o helpers solo si reducen ambiguedad real.
- Agregar test enfocado cuando haya riesgo de regresion.

Validacion local recomendada:

```bash
git diff --check
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Browser/offline verification:

- Este repo pide aprobacion explicita antes de browser automation.
- Para rutina, preferir validacion local.
- Si se necesita simular offline visualmente, explicar por que y pedir permiso.

Handoff:

- Resumir archivos tocados.
- Decir que docs existentes se usaron.
- Reportar validaciones exactas.
- Nombrar riesgos/gaps pendientes sin exagerar.

## 11. Maintenance Rule

Update this file only when:
- architecture changes;
- boundaries change;
- operational invariants change;
- offline/sync behavior changes;
- new core modules appear.

Do NOT update for:
- visual tweaks;
- small bug fixes;
- CSS/layout;
- minor refactors.
