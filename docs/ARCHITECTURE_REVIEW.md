# Auditoria tecnica de arquitectura industrial

Ultima actualizacion: 2026-05-16

## Resumen ejecutivo

La plataforma tiene un cimiento funcional y razonablemente consistente para una aplicacion operacional: Next.js App Router, Supabase Auth/Postgres/Realtime, separacion progresiva `routes -> services -> repositories`, IndexedDB para continuidad offline, heartbeat centralizado y Service Worker acotado. La direccion arquitectonica es buena: evita depender solo de `navigator.onLine`, no cachea APIs criticas en el Service Worker y usa `client_mutation_id` para reducir duplicados en cola offline.

Para criterio industrial, todavia no esta completa. Los riesgos principales estan en confiabilidad operacional, pruebas, observabilidad, despliegue y endurecimiento de seguridad. La app ya resuelve varios problemas dificiles del modo offline, pero necesita formalizar contratos, automatizar validaciones, instrumentar fallos y cerrar brechas de produccion antes de considerarse una base estable de largo plazo.

## Top 5 riesgos

1. Cobertura de tests insuficiente para flujos criticos offline/sync/auth/realtime.
2. Observabilidad limitada: logs de consola y audit log de negocio, pero sin metricas, trazas, alertas ni correlacion.
3. Service role en backend con validacion aplicativa: correcto en server-only, pero exige disciplina fuerte porque bypassa RLS.
4. Offline parcial: hard reload, chunks App Router y navegacion offline completa siguen siendo riesgos operacionales.
5. Deploy/produccion poco formalizado: sin CI visible, sin vercel/deploy config, sin smoke automatizado ni estrategia de rollback documentada.

## Top 5 proximos pasos

1. Crear suite de pruebas E2E para login, planning online, planning offline, reconexion, conflictos y snapshots.
2. Agregar observabilidad industrial: eventos de conectividad, heartbeat, cola, conflictos, errores API y realtime con dashboard/alertas.
3. Formalizar pipeline CI/CD con `lint`, `tsc --noEmit`, build, migraciones revisadas y smoke post deploy.
4. Reducir riesgo de service role con boundary mas explicito, auditoria de endpoints y pruebas de autorizacion por rol.
5. Definir contrato offline PWA/App Router para hard reload, chunks, rutas criticas y comportamiento esperado por vista.

## 1. Estrategia online/offline

**Estado actual segun codigo**

- Estrategia documentada en `docs/OFFLINE.md` y `docs/OFFLINE_ONLINE_STRATEGY.md`.
- `networkStatus.ts` centraliza conectividad.
- IndexedDB (`mineria-offline-store`) guarda perfil, catalogo, planning por fecha, snapshots y cola.
- `site-shell.tsx` intercepta navegacion lateral offline y renderiza `OfflineRouteContent`.
- Planning soporta escritura offline mediante cola; dashboard/reportes/admin usuarios tienen lectura degradada.

**Buenas practicas actuales**

- Fuente central de conectividad.
- Separar datos offline de Cache Storage.
- Mostrar ultima sincronizacion en snapshots.
- Mantener UX binaria y honesta: online/offline.
- Definir matriz de cobertura por flujo.

**Que esta bien**

- Buen criterio al no prometer offline-first total.
- Fallback local en vistas operacionales.
- Cola offline acotada al dominio mas importante.
- Documentacion tecnica reciente y alineada al codigo.

**Brechas o riesgos**

- Hard reload offline no esta resuelto de forma completa.
- Algunas vistas tienen fallback degradado, no flujo offline completo.
- Riesgo de UI stale si no se comunica claramente antiguedad de datos.

**Recomendaciones**

- Convertir la matriz offline en criterios de aceptacion por ruta.
- Agregar pruebas manuales y E2E por flujo offline.
- Definir SLA de frescura de snapshot por vista.

**Prioridad:** alta.

## 2. Heartbeat y deteccion de conectividad

**Estado actual segun codigo**

- `networkStatus.ts` usa `navigator.onLine` y heartbeat a `/api/health`.
- Timeout: `2000 ms`.
- Intervalo: `5000 ms`.
- Estado visible: `online` / `offline`.
- Evita heartbeats simultaneos con `heartbeatInFlight` y `heartbeatPromise`.

**Buenas practicas actuales**

- No confiar solo en `navigator.onLine`.
- Probar conectividad real contra backend propio.
- Timeout corto y estado conservador hasta confirmar salud.
- Centralizar listeners.

**Que esta bien**

- La decision de considerar `backendOnline !== true` como offline reduce falsos online.
- Listeners centralizados para `online`, `offline`, `focus` y `visibilitychange`.
- `/api/health` no usa cache.

**Brechas o riesgos**

- Intervalo fijo sin backoff ni jitter.
- No hay metricas de latencia/fallos de heartbeat.
- Posible falso offline breve al inicio, conocido y documentado.

**Recomendaciones**

- Medir latencia y tasa de fallo del heartbeat.
- Agregar backoff/jitter si redes inestables generan demasiado ruido.
- Definir umbral de estabilidad antes de mostrar recuperacion online si hay flapping.

**Prioridad:** media.

## 3. IndexedDB y almacenamiento offline

**Estado actual segun codigo**

- `localOfflineStore.ts` crea DB `mineria-offline-store`, version `1`.
- Stores: `keyval` y `planningByDate`.
- Guarda catalogo, perfil, cola, snapshots genericos y planning por fecha.
- Usa wrappers simples `save*` / `read*`.

**Buenas practicas actuales**

- IndexedDB para datos offline estructurados.
- Versionado de claves.
- Separar datos de negocio del Service Worker.
- Manejar migraciones y corrupcion de cache.

**Que esta bien**

- Una capa local unificada, facil de auditar.
- Evita `localStorage` como storage activo para cola.
- Migracion legacy de cola hacia IDB.

**Brechas o riesgos**

- No hay estrategia de expiracion/retencion por tipo de snapshot.
- No hay manejo avanzado de migraciones IDB futuras.
- No hay verificacion de cuota o degradacion cuando IndexedDB falla.

**Recomendaciones**

- Definir TTL por snapshot y politica de limpieza.
- Documentar plan de versionado DB_VERSION.
- Agregar pruebas de fallo IDB/cuota/corrupcion.

**Prioridad:** media.

## 4. Service Worker / PWA

**Estado actual segun codigo**

- `public/sw.js` cachea shell minimo, assets y rutas criticas.
- Excluye `/api/*`.
- `PwaRegister` desregistra SW y limpia caches en desarrollo/localhost.
- En produccion registra `/sw.js`, activa waiting worker y precachea rutas criticas.

**Buenas practicas actuales**

- No cachear APIs autenticadas criticas.
- Scope claro del SW.
- Diferenciar desarrollo y produccion.
- Versionar caches y limpiar caches antiguas.

**Que esta bien**

- Responsabilidad acotada y comentarios explicitos.
- Cache network-first para rutas y assets static.
- Fallback `/offline`.

**Brechas o riesgos**

- App Router puede requerir chunks no cacheados para hard reload offline.
- No hay test automatizado de SW en build/start.
- Precache de rutas criticas depende de que el cliente pueda pedirlas online.

**Recomendaciones**

- Probar SW en `npm run build && npm run start`, no solo `next dev`.
- Definir contrato de hard reload offline.
- Agregar smoke E2E para offline con SW activo.

**Prioridad:** alta.

## 5. Snapshots locales

**Estado actual segun codigo**

- `reportsOfflineSnapshot.ts` maneja catalogo de reportes, reportes por filtro y admin users.
- Planning guarda items por fecha en `planningByDate`.
- UI muestra "Datos offline. Ultima sincronizacion" en vistas degradadas.

**Buenas practicas actuales**

- Envelope con `value` y `updatedAt`.
- Claves versionadas.
- Mensajes visibles de datos offline.

**Que esta bien**

- Snapshot separado de fetch normal.
- Fallback util en dashboard/reportes/admin.
- Ultima sincronizacion visible.

**Brechas o riesgos**

- No hay invalidacion formal por permisos/cambio de usuario.
- Snapshots pueden persistir mas de lo deseable en equipos compartidos.
- Falta cobertura de tests para lectura/escritura por vista.

**Recomendaciones**

- Namespacing de snapshots por usuario/tenant si la plataforma escala.
- TTL o limpieza en sign-out cuando aplique.
- Pruebas de snapshots vacios, viejos y corruptos.

**Prioridad:** media.

## 6. Offline queue y sincronizacion

**Estado actual segun codigo**

- Cola de planning en IndexedDB (`planning-mutation-queue`).
- Mutaciones POST/PATCH/DELETE usan `client_mutation_id`.
- Reintentos por estado de red, intervalo, cambios de sesion y cambios de cola.
- Conflictos pasan a `status: "conflict"`.
- Backend verifica `client_mutation_id` para evitar duplicar inserts.

**Buenas practicas actuales**

- Idempotencia por client mutation id.
- FIFO razonable.
- Separar errores retryables de conflictos.
- Persistir cola durable.

**Que esta bien**

- Buen diseno base para operacion intermitente.
- Optimistic items marcados como `pending`.
- Audit log en operaciones server-side exitosas.

**Brechas o riesgos**

- No hay backoff exponencial ni limite visible de reintentos.
- La resolucion de conflictos es basica.
- PATCH/DELETE requieren cuidado: la idempotencia es mas fuerte en create que en update/delete.

**Recomendaciones**

- Agregar metadata de intentos y backoff.
- Mejorar UI de conflictos con detalle accionable.
- Documentar contrato idempotente por metodo.
- Agregar pruebas E2E de duplicacion, reconexion y conflicto 409.

**Prioridad:** alta.

## 7. Realtime

**Estado actual segun codigo**

- Planning usa Supabase Realtime en cliente.
- Canal por fecha: `planning-items-${selectedDate}`.
- Escucha INSERT/UPDATE/DELETE en `planning_items` y `activity_execution_segments`.
- Refresca planning con debounce.
- No se suscribe si no hay sesion o si `isBrowserOffline()`.
- `src/server/realtime/README.md` reconoce necesidad futura de aislar contratos.

**Buenas practicas actuales**

- Canal scoped por contexto.
- Cleanup de canales y timers.
- Refetch despues de evento realtime para mantener estado canonico.

**Que esta bien**

- No intenta realtime offline.
- Remove channel en cleanup.
- Debounce evita recargas excesivas por rafagas.

**Brechas o riesgos**

- Acoplamiento directo UI-Supabase.
- No hay manejo visible de estado de suscripcion o errores del canal.
- No hay metricas de reconexion o lag realtime.

**Recomendaciones**

- Crear adapter/hook dedicado para realtime.
- Exponer estado de suscripcion para diagnostico.
- Agregar fallback documentado si realtime no esta disponible.

**Prioridad:** media.

## 8. Auth

**Estado actual segun codigo**

- Supabase Auth en cliente.
- API server valida Bearer token con `supabase.auth.getUser`.
- `AuthProvider` sincroniza perfil via `/api/profile/sync`, cachea perfil y maneja recuperacion.
- Roles: `admin` y `viewer`; approval status `pending`, `approved`, `rejected`; `active`.
- `ADMIN_EMAIL` permite bootstrap admin.

**Buenas practicas actuales**

- Validar token server-side para cada API.
- Separar sesion auth de perfil/autorizacion app.
- Cache local cuidadoso para continuidad offline.
- Bloquear flujos de login/registro sin conectividad.

**Que esta bien**

- `requireApprovedUser` y `requireAdminUser` centralizan autorizacion.
- Perfil cacheado evita loaders infinitos en redes malas.
- Mensajes claros para pending/rejected/inactive.

**Brechas o riesgos**

- Perfil cacheado puede permitir UX offline aunque permisos hayan cambiado hasta reconectar.
- Bootstrap por email requiere control operacional fuerte.
- No se observan rate limits o protecciones anti abuso en endpoints auth/request-access.

**Recomendaciones**

- Documentar semantica de permisos offline.
- Agregar rate limiting o proteccion de abuso en request-access/login-related APIs.
- Auditar sign-out y limpieza de datos locales por equipo compartido.

**Prioridad:** alta.

## 9. Backend: routes/services/repositories

**Estado actual segun codigo**

- API routes en `src/app/api`.
- Servicios en `src/server/services`.
- Repositories en `src/server/repositories`.
- `server-only` en servicios/repositorios sensibles.
- Planning tiene validaciones importantes en route/service y constraints SQL.

**Buenas practicas actuales**

- Route handlers delgados.
- Servicios con reglas de negocio.
- Repositories encapsulando queries.
- Errores HTTP tipados/consistentes.

**Que esta bien**

- Separacion de capas existe y va en buena direccion.
- `server/db/supabase.ts` funciona como boundary de proveedor.
- Audit log en mutaciones relevantes.

**Brechas o riesgos**

- Algunas routes aun contienen mucha logica de validacion compleja.
- Respuestas de error suelen caer en status 500 para errores de auth/autorizacion.
- Falta contrato OpenAPI/typed API compartido.

**Recomendaciones**

- Mover validaciones complejas de route a servicios/helpers testeables.
- Normalizar errores: 401, 403, 409, 422, 500.
- Agregar tests unitarios de servicios criticos.

**Prioridad:** media.

## 10. Base de datos/Supabase

**Estado actual segun codigo**

- SQL versionado en `supabase/sql`.
- Constraints para rangos, roles, categorias y tracking.
- Indices por fecha, shift, Cabecera Operacional, categoria, grupos y mutation id.
- RLS habilitado en tablas principales.
- Realtime publication para planning y execution segments.

**Buenas practicas actuales**

- Constraints en DB para invariantes criticas.
- Indices para filtros frecuentes.
- RLS para accesos directos desde clientes autenticados.
- Replica identity para DELETE realtime cuando se necesita payload.

**Que esta bien**

- Buen uso de constraints de dominio.
- Indices para consultas operacionales.
- Unique `client_mutation_id` para planning items.
- Exclusion constraint indicada para solapes en segmentos.

**Brechas o riesgos**

- Backend usa service role, por lo que RLS no protege errores de logica server.
- No se ve herramienta formal de migraciones con historial aplicado/rollback.
- No hay tipos generados de Supabase para TypeScript.

**Recomendaciones**

- Adoptar flujo formal de migraciones Supabase.
- Generar tipos DB y usarlos en repositories.
- Revisar politicas RLS para futuras operaciones directas de cliente.

**Prioridad:** alta.

## 11. Seguridad

**Estado actual segun codigo**

- Tokens Bearer requeridos en APIs protegidas.
- Admin endpoints usan `requireAdminUser`.
- Supabase service role se usa solo server-side.
- Audit log para operaciones de planning/admin.
- No se cachean `/api/*` en SW.

**Buenas practicas actuales**

- Principio de menor privilegio.
- Validacion server-side.
- Auditoria de mutaciones.
- Proteccion de secretos y no exponer service role al cliente.

**Que esta bien**

- `server-only` reduce riesgo de importar secretos al cliente.
- `env.ts` exige variables server necesarias.
- Aprobacion de usuarios separada de auth.

**Brechas o riesgos**

- Service role amplio en repositories.
- Falta rate limiting.
- Falta CSP/security headers visibles.
- Errores pueden exponer mensajes internos de Supabase en algunos casos.
- `.env.local` existe en el workspace; no se evalua su contenido aqui, pero debe protegerse siempre.

**Recomendaciones**

- Agregar headers de seguridad en Next/Vercel.
- Rate limiting para auth request, users admin y mutaciones.
- Sanitizar errores externos antes de devolverlos.
- Revisar permisos de service role y rotacion de secretos.

**Prioridad:** alta.

## 12. Observabilidad/logs/monitoreo

**Estado actual segun codigo**

- Logs de consola en desarrollo para network heartbeat y SiteShell.
- `writeAuditLog` registra mutaciones en tabla `audit_logs`.
- Errores de audit log se envian a `console.error`.
- No se observa integracion con Sentry, OpenTelemetry, Vercel Observability u otro APM.

**Buenas practicas actuales**

- Logs estructurados por request.
- Correlation IDs.
- Metricas de disponibilidad, latencia, errores y cola offline.
- Alertas por degradacion operacional.
- Audit trail separado de observabilidad tecnica.

**Que esta bien**

- Audit log de negocio ya existe.
- Logs dev para conectividad ayudan durante construccion.

**Brechas o riesgos**

- Sin alertas para fallas de heartbeat/API/sync.
- Sin trazas de requests ni metricas de Supabase.
- Sin panel para colas pendientes/conflictos por usuario/faena.

**Recomendaciones**

- Instrumentar API routes y eventos offline/sync.
- Agregar correlation id por request.
- Crear dashboards: health, errores API, cola pendiente, conflictos, realtime reconnect.

**Prioridad:** alta.

## 13. Testing

**Estado actual segun codigo**

- Scripts disponibles: `lint`, `build`, `start`, `dev`.
- No hay scripts `test`, `e2e` ni configs Playwright/Vitest/Jest visibles.
- Validaciones manuales documentadas en `docs/OFFLINE.md`.

**Buenas practicas actuales**

- Unit tests para servicios puros y validadores.
- Integration tests para API routes.
- E2E para flujos operacionales.
- Tests offline con browser context y SW en produccion.
- Tests de seguridad/autorizacion.

**Que esta bien**

- `npm run lint` existe y pasa.
- TypeScript puede ejecutarse con `npx tsc --noEmit`.
- Hay documentacion de pruebas manuales iniciales.

**Brechas o riesgos**

- Ausencia de pruebas automatizadas para lo mas critico.
- Offline queue, conflict handling y auth dependen de regresion manual.
- No hay CI visible.

**Recomendaciones**

- Agregar Playwright para E2E criticos.
- Agregar unit tests de networkStatus, cola, validaciones de rangos y servicios.
- Incluir `tsc --noEmit` como script `typecheck`.
- Crear pipeline obligatorio antes de deploy.

**Prioridad:** alta.

## 14. Deploy/produccion

**Estado actual segun codigo**

- Next.js con `reactStrictMode`.
- Sin `vercel.json` visible.
- Sin `.github` visible.
- `.env.example` declara Supabase URL, publishable key, service role y admin email.
- PWA se desactiva en dev/localhost y solo opera en produccion/contexto seguro.

**Buenas practicas actuales**

- Ambientes separados dev/staging/prod.
- CI/CD con lint, typecheck, build y E2E smoke.
- Migraciones controladas.
- Rollback documentado.
- Validacion post deploy.

**Que esta bien**

- Config simple y compatible con Vercel/Next.
- Variables requeridas documentadas.
- PWA no contamina desarrollo local.

**Brechas o riesgos**

- No hay pipeline visible.
- No hay estrategia de migraciones/rollback documentada.
- No hay smoke de produccion ni healthcheck externo.
- No hay configuracion explicita de headers/cache/runtime.

**Recomendaciones**

- Crear checklist de release industrial.
- Agregar CI y preview/staging.
- Documentar migraciones Supabase y rollback.
- Configurar monitoreo de `/api/health`.

**Prioridad:** alta.

## 15. Riesgos operacionales

**Estado actual segun codigo**

- La app apunta a continuidad en faena con redes intermitentes.
- Usa datos locales y snapshots para evitar pantalla vacia.
- Cola offline mitiga perdida de cambios en planning.

**Buenas practicas actuales**

- Disenar para degradacion explicita.
- Evitar estados ambiguos.
- Mantener auditabilidad.
- Probar escenarios reales de baja conectividad.
- Definir procedimientos de soporte.

**Que esta bien**

- UX binaria online/offline.
- Snapshots con ultima sincronizacion.
- Mutaciones pendientes visibles.
- Audit log para operaciones relevantes.

**Brechas o riesgos**

- Usuarios pueden operar con datos stale si no entienden antiguedad/alcance.
- Conflictos requieren resolucion manual simple.
- No hay runbook operativo para caidas de Supabase, red local o despliegue fallido.
- No hay monitoreo de equipos con colas acumuladas.

**Recomendaciones**

- Crear runbooks de operacion offline, reconexion y conflicto.
- Agregar centro de mensajes global para sync/conflictos/errores.
- Medir colas pendientes por usuario y antiguedad.
- Definir politicas de datos stale por proceso operacional.

**Prioridad:** alta.

## Conclusion

La base arquitectonica es prometedora y ya incorpora varias decisiones correctas para una plataforma operacional: conectividad centralizada, almacenamiento local durable, Service Worker limitado, cola idempotente y capas server separadas. Para elevarla de MVP robusto a plataforma industrial, el foco debe moverse desde "funciona" hacia "es verificable, observable, operable y recuperable". Las prioridades inmediatas son pruebas, observabilidad, seguridad server-side, formalizacion de deploy y cierre de riesgos offline.
