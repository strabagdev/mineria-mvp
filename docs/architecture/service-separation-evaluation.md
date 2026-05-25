# Service Separation Evaluation

## Resumen Ejecutivo

La recomendacion actual es mantener Mineria MVP como modular monolith. La
plataforma ya gano boundaries internos suficientes para crecer sin separar
servicios todavia: `server/services`, `server/repositories`, modulos de dominio,
offline/sync, observabilidad, jobs, integraciones y event bus interno.

Separar servicios ahora agregaria costo operacional antes de tener senales
concretas de escala, aislamiento o confiabilidad que lo justifiquen. El siguiente
paso razonable no es microservicios: es workers/cron con contratos internos,
observabilidad e idempotencia.

## Principio Rector

Separar por evidencia operacional, no por anticipacion. Un servicio independiente
solo conviene cuando un dominio necesita ciclo de despliegue, runtime,
escalamiento, seguridad o confiabilidad claramente distintos al core.

## Matriz De Candidatos

| Dominio | Beneficio de separar | Costo / complejidad | Dependencia con core | Senales para separar | Senales para NO separar | Recomendacion |
| --- | --- | --- | --- | --- | --- | --- |
| Reporting / analytics | Aislar consultas pesadas, precomputar agregados, exports largos | Duplicacion de DTOs, cache, permisos, consistencia de datos | Alta: usa planning, usuarios, scopes futuros | Consultas lentas afectan UI/API, exports tardan mucho, necesidad de BI programado | Reportes siguen interactivos y livianos, mismos permisos, mismo DB | No separar ahora; primero modulo + jobs/cron |
| Sync/offline server-side | Reconciliacion robusta, replay canonico, conflictos centralizados | Alto: idempotencia, locks, colas, auditoria, conflictos | Muy alta: planning, auth, DB, offline contracts | Multiples clientes offline, conflictos frecuentes, replay necesita locks server-side | Cola actual es cliente-side y dominio principal es planning | No separar; primero sync engine interno |
| Integrations | Aislar SDKs externos, rate limits, retries, secretos | Medio/alto: queue, delivery store, monitoreo, seguridad | Media: consume eventos/DTOs, no deberia decidir dominio | Alto volumen de webhooks/notificaciones, proveedores inestables, retries durables | No hay integraciones reales todavia | Primer candidato futuro a worker, no servicio aun |
| Jobs/workers | Ejecutar tareas largas sin bloquear request runtime | Medio: runtime separado, locks, storage de intentos | Media: llama services/application | Jobs duran mucho, cron frecuente, necesita concurrencia controlada | Solo hay contratos, no jobs reales | Separar como worker antes que microservicio |
| Realtime gateway | Controlar fanout, filtros multi-faena, proveedor reemplazable | Alto: conexiones, auth, backpressure, multi-tenant leakage | Alta: auth, scopes, planning | Realtime crece a varios dominios o necesita gateway propio | Supabase realtime actual cubre invalidacion simple | No separar ahora; mantener adapter por dominio |
| Auth/identity | Aislar seguridad, SSO, auditoria de acceso | Muy alto: riesgo de seguridad, sesiones, RLS, soporte | Critica: todos los endpoints dependen de auth | Requisitos enterprise SSO/SCIM, compliance fuerte, proveedor propio | Supabase Auth funciona y ya esta encapsulado | No separar; fortalecer boundary auth |
| Audit/logging | Retencion, inmutabilidad, busqueda, compliance | Medio: storage append-only, ingestion, queries | Media: todos los services emiten audit | Volumen alto, retencion legal, consultas audit pesadas | Audit actual es simple y transaccional | No separar; primero outbox/audit module |
| File/document processing | Procesar archivos grandes, virus scan, conversiones | Medio: storage, jobs, permisos, lifecycle | Media: usuarios/reporting/imports | Archivos grandes, conversiones lentas, SharePoint/Excel frecuentes | No hay procesamiento documental real | Futuro worker especializado |

## Criterios De Decision

### Mantener En Modular Monolith

Mantener dentro del monolith cuando:

- El flujo comparte DB, auth, permisos y despliegue con el core.
- El runtime cabe en request/route normal.
- No hay volumen, duracion o aislamiento especial.
- El equipo necesita velocidad y consistencia de contratos.
- La falla del modulo se puede manejar con errores locales.
- El dominio aun esta cambiando y conviene refactor barato.

### Mover A Worker Separado

Mover primero a worker/cron cuando:

- La tarea es lenta, programada o retryable.
- Puede ejecutarse fuera del request path.
- Necesita locks, intentos, backoff o rate limits.
- Puede llamar services/application layers existentes.
- No necesita API publica propia.
- El problema principal es runtime/concurrencia, no ownership de dominio.

Ejemplos probables: exports pesados, notificaciones, retries de integraciones,
limpieza offline/cache, agregados programados.

### Mover A Servicio Independiente

Considerar servicio independiente solo cuando:

- Requiere despliegue y escalamiento separados del core.
- Tiene data ownership claro o storage especializado.
- Tiene SLA distinto.
- Debe aislar fallas de proveedores externos.
- Tiene contratos estables y versionados.
- El costo de red, auth entre servicios, observabilidad y CI/CD esta justificado.

Ejemplos futuros posibles: integration delivery service, analytics/reporting
service, document processing service.

### Usar Cola Persistente / Event Bus Externo

Evaluar cola persistente o event bus externo cuando:

- Los efectos deben sobrevivir reinicios.
- Hay multiples workers o consumidores.
- Se necesita retry duradero/dead-letter.
- Hay alto volumen de eventos.
- Se requiere backpressure.
- Se necesita desacoplar productores y consumidores entre deployments.

No usar infraestructura distribuida para reemplazar funciones directas,
transacciones locales o eventos de bajo volumen dentro del mismo proceso.

## Arquitectura Por Etapas

### Etapa 0: Actual

- Modular monolith.
- Next.js App Router para UI/API.
- Services/repositories server-side.
- Supabase como provider activo.
- Realtime adapter de planning.
- Offline/sync cliente.
- Observabilidad interna.
- Jobs e integrations como contratos.
- Event bus in-process no critico.

### Etapa 1: Modular Monolith Reforzado

- Completar boundaries server por dominio.
- Consolidar reporting application/server.
- Formalizar audit module.
- Mejorar sync/offline contracts y locks.
- Agregar correlation ids y scopes multi-tenant/faena.

### Etapa 2: Workers / Cron

- Activar jobs protegidos para tareas no criticas.
- Persistir job runs, intentos, locks e idempotency keys.
- Ejecutar exports, notifications, cleanup y agregados fuera del request path.
- Mantener services compartidos y contratos internos.

### Etapa 3: Servicios Especializados Con Evidencia

- Separar solo dominios con volumen/SLA/runtime claro.
- Empezar por integrations o document processing si aparecen proveedores externos
  lentos/inestables.
- Reporting/analytics podria separarse si las consultas o exports afectan al
  core.

### Etapa 4: Event-Driven Architecture

- Adoptar outbox/queue/event bus externo solo si hay multiples consumidores,
  necesidad de entrega durable o workers distribuidos.
- Mantener eventos de dominio pequenos, versionados y con scope tenant/faena.

## Impacto Por Dimension

| Dimension | Impacto si se separa prematuramente | Requisito antes de separar |
| --- | --- | --- |
| DB | Transacciones partidas, duplicacion de queries, ownership difuso | Definir data ownership, outbox, migraciones y consistencia |
| Auth | Tokens entre servicios, permisos duplicados | Contratos de auth service-to-service y scopes claros |
| Multi-tenant/faena | Riesgo de leakage entre sitios | Scope obligatorio en DB, eventos, jobs, cache y logs |
| Observabilidad | Incidentes mas dificiles de seguir | Correlation ids, traces/logs por servicio, alertas |
| Deployments | Mas pipelines y rollback coordinado | CI/CD por servicio y contratos versionados |
| Testing | Tests e2e mas costosos y mocks remotos | Contract tests, integration tests y fixtures compartidos |
| Costos | Infra extra, colas, monitoreo, runtime idle | Volumen o SLA que pague el costo |
| Operacion industrial | Mas puntos de falla en terreno/redes inestables | Degradacion clara, retries, runbooks y soporte offline |

## Que NO Separar Ahora

- Auth/identity: es demasiado critico y Supabase Auth ya esta encapsulado.
- Realtime gateway: el uso actual es invalidacion simple por planning.
- Sync/offline server-side: todavia falta formalizar engine interno y locks.
- Audit/logging: debe mantenerse cerca de transacciones hasta tener outbox.
- Reporting/analytics: ya se esta encapsulando; primero jobs/agregados si pesa.
- Jobs como microservicio: aun no hay jobs reales ni cola persistente.

## Que Podria Separarse Primero

1. Worker de jobs: primera separacion razonable si aparecen exports,
   notificaciones o limpieza programada con duracion/retries.
2. Integrations worker: si hay proveedores externos con rate limits, fallas o
   retries durables.
3. Document/file processing: si aparecen cargas Excel/CSV grandes,
   conversiones o entregas SharePoint.
4. Reporting/analytics service: solo si las consultas pesadas degradan el core o
   requiere storage/aggregates propios.

## Senales A Monitorear

- Duracion p95/p99 de API routes.
- Tiempo y volumen de reportes/exportaciones.
- Errores y retries de integraciones externas.
- Conflictos y volumen de sync offline.
- Uso de CPU/memoria durante exports o agregados.
- Numero de jobs simultaneos y duracion promedio.
- Incidentes por realtime cross-scope o invalidaciones excesivas.
- Necesidad de SSO/compliance/auditoria inmutable.
- Costos de infraestructura y tiempo de deploy.
- Dificultad de testear o desplegar cambios por acoplamiento.

## Riesgos De Microservicios Prematuros

- Duplicar reglas de dominio.
- Romper consistencia transaccional.
- Aumentar latencia y puntos de falla.
- Multiplicar secretos y configuracion.
- Forzar mocks y contract tests antes de tener contratos estables.
- Hacer mas dificil operar en escenarios industriales con conectividad parcial.
- Convertir problemas de modularidad en problemas de red.

## Recomendacion Final

Mantener el modular monolith como arquitectura principal. La plataforma esta en
el punto correcto para reforzar boundaries, no para distribuirlos. La primera
evolucion fuera del proceso principal deberia ser un worker/cron con persistencia
de intentos e idempotencia, no un microservicio.

Solo separar servicios cuando exista evidencia medible: tareas largas que afectan
el request path, proveedores externos inestables, volumen alto de eventos,
requisitos de SLA distintos o data ownership claro. Hasta entonces, la prioridad
debe ser completar scopes multi-tenant/faena, observabilidad, jobs persistentes,
outbox y contract tests dentro del monolith.
