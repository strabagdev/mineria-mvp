# Integrations Strategy

## Objetivo

Definir una estrategia modular para integrar sistemas externos sin acoplar la
plataforma a proveedores concretos. Esta etapa no habilita integraciones reales:
solo declara boundaries, contratos base y reglas para futuras implementaciones.

## Inventario Actual

| Integracion | Estado actual | Ubicacion | Observaciones |
| --- | --- | --- | --- |
| Supabase Auth | Activa | `src/lib/authClient.ts`, `src/modules/auth`, `src/server/auth` | Provider principal de sesion/autenticacion. |
| Supabase DB | Activa | `src/server/db/supabase.ts`, `src/server/repositories/*` | Repositorios server dependen del cliente Supabase. |
| Supabase Realtime | Activa | `src/modules/planning/realtime`, `src/server/realtime/README.md` | Usado para invalidar/refrescar planning. |
| IndexedDB/local offline | Activa | `src/lib/localOfflineStore.ts`, modulos offline/sync | No es externa, pero impacta integraciones con replay/idempotencia. |
| Observabilidad interna | Activa, local | `src/lib/observability` | Base para eventos operacionales sin proveedor externo. |
| Email/Resend | Prevista | Sin implementacion | Potencial canal para invitaciones, alertas y notificaciones. |
| Webhooks | Prevista | Sin implementacion | Inbound/outbound para automatizaciones o clientes externos. |
| Slack/Discord | Prevista | Sin implementacion | Alertas internas operacionales. |
| WhatsApp | Prevista | Sin implementacion | Mensajeria de terreno, requiere control de privacidad/costo. |
| Power BI/reporting exports | Prevista | Reporting module | Exportacion o refresh de datasets futuro. |
| Excel/SharePoint | Prevista | Reporting/export providers | Entrega documental corporativa. |
| ERP/API externas | Prevista | Sin implementacion | Integracion con produccion, turnos, activos o planificacion corporativa. |
| Sensores/IoT/eventos industriales | Prevista | Sin implementacion | Debe tratarse como ingestion/event streaming, no como UI directa. |
| Railway/Vercel env/deploy | Infra prevista/operativa | `.env.example`, docs | Manejo de env y runtime, sin adapter propio todavia. |

## Clasificacion de Integraciones

| Tipo | Ejemplos | Boundary propuesto |
| --- | --- | --- |
| Outbound notifications | Email, Slack, Discord, WhatsApp | `src/integrations/notifications` |
| Inbound webhooks | ERP, sensores, formularios externos | `src/integrations/webhooks` |
| Outbound webhooks | Eventos hacia clientes o automatizaciones | `src/integrations/webhooks` |
| Scheduled jobs | Reintentos, digest, refresh exports | `src/integrations/jobs` futuro |
| Reporting exports | CSV, Excel, Power BI, SharePoint | `src/integrations/exports` |
| Realtime/event streaming | Supabase Realtime, IoT streams | Modulo de dominio + adapter en `src/integrations/adapters` si cruza proveedor |
| Auth providers | Supabase Auth, futuros SSO/OIDC | `src/modules/auth` + adapter provider-neutral futuro |
| File/document integrations | SharePoint, Blob storage, S3-like | `src/integrations/exports` o `src/integrations/files` futuro |

## Estructura Objetivo

```txt
src/integrations/
  contracts.ts
  index.ts
  adapters/
  notifications/
    contracts.ts
  webhooks/
  exports/
```

La aplicacion y los modulos de dominio deben depender de contratos o servicios
internos. Los SDKs externos deben quedar dentro de adapters o boundaries server
existentes.

## Principios

1. Provider reemplazable: ningun modulo de dominio nuevo debe depender directo
   de un SDK externo si puede depender de un contrato interno.
2. Secretos server-only: tokens, API keys y service roles deben vivir en env
   server-side y nunca cruzar a UI, logs o snapshots offline.
3. Idempotencia primero: webhooks, jobs y entregas outbound deben aceptar una
   clave estable para reintentos seguros.
4. Errores estructurados: adapters deben devolver `IntegrationResult`, no
   exponer errores crudos de proveedores al dominio.
5. Observabilidad sin datos sensibles: registrar eventos, proveedor, resultado,
   retryability y correlacion; no registrar tokens, payloads completos ni emails.
6. Reintentos controlados: diferenciar fallas retryable/no retryable y evitar
   loops manuales dispersos.
7. Rate limiting futuro: dejar espacio para throttling por proveedor, canal,
   tenant/faena y tipo de evento.
8. Webhooks seguros: firma, timestamp tolerance, replay protection y validacion
   de schema antes de ejecutar negocio.
9. Offline consciente: cualquier integracion disparada desde mutaciones offline
   debe ejecutarse despues del sync canonico o con idempotencia fuerte.
10. Sin acoplar UI: los componentes no deben importar adapters externos.

## Foundations Creadas

- `src/integrations/contracts.ts`: tipos base para contexto, resultados,
  errores, descriptors e idempotencia.
- `src/integrations/notifications/contracts.ts`: contrato minimo para canales
  email/Slack/Discord/WhatsApp/webhook.
- `src/integrations/*/README.md`: ownership y reglas de crecimiento.

No se movio Supabase, realtime ni auth para evitar riesgo funcional. Esos
boundaries ya existen y pueden migrar progresivamente si aparece una necesidad
real de reemplazo.

## Estrategia Futura Por Canal

### Email

Crear un `NotificationProvider` server-only. Resend u otro proveedor debe quedar
como adapter. El dominio solo envia un `NotificationMessage` y recibe un
`IntegrationResult`.

### Mensajeria Operacional

Slack/Discord/WhatsApp deben compartir contrato de notificacion, con reglas por
canal para prioridad, costo, rate limit y privacidad. WhatsApp requiere especial
cuidado con datos personales y confirmaciones de entrega.

### Webhooks

Separar inbound y outbound. Inbound debe verificar firma, timestamp,
idempotencia y schema antes de tocar dominio. Outbound debe registrar intentos,
fallas retryable y recibos de entrega.

### Exportacion

Reporting debe entregar DTOs estables al provider de exportacion. Power BI,
Excel, CSV y SharePoint no deben modificar la logica de reporting ni sus filtros.

### IoT/Telemetria

Tratar eventos industriales como ingestion/event streaming. No conectar sensores
directamente a UI. Normalizar eventos, validar fuente, registrar correlacion y
persistir con idempotencia.

### ERP/API Externas

Crear adapters por proveedor y mapear hacia contratos internos. Evitar que nombres
de campos, errores o estados del ERP entren en componentes o servicios de dominio.

### Workers/Jobs

Cuando existan jobs, deben operar sobre contratos internos, emitir observabilidad
y documentar retry/backoff. No duplicar reglas de negocio dentro del scheduler.

## Riesgos Identificados

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Logica de negocio acoplada a provider | Migraciones caras y bugs por SDK | Contratos en `src/integrations` y adapters aislados. |
| Secretos dispersos | Filtracion o uso accidental en cliente | Env server-only y validacion central. |
| Reintentos manuales | Duplicados, loops, costos | `IntegrationResult`, retryable flag e idempotency keys. |
| Webhooks inseguros | Replay, spoofing, ejecucion indebida | Firmas, timestamp tolerance, schema validation. |
| Falta de idempotencia | Duplicacion de reportes/notificaciones/mutaciones | Claves estables por evento y provider. |
| Dependencia SaaS fuerte | Lock-in operacional | Provider-neutral contracts y adapters reemplazables. |
| Observabilidad pobre | Incidentes dificiles de diagnosticar | Eventos estructurados por provider/canal/resultado. |
| Offline dispara integraciones prematuras | Entregas con datos no canonicos | Ejecutar integraciones despues de sync confirmado. |

## Roadmap

1. Mantener Supabase en boundaries actuales y no moverlo sin una tarea especifica.
2. Cuando aparezca el primer email real, implementar un adapter en
   `src/integrations/adapters/resend` y usar `NotificationProvider`.
3. Antes de webhooks inbound, definir contrato de evento, verificacion de firma
   e idempotency store.
4. Antes de Power BI/Excel/SharePoint, definir `ExportProvider` y separar
   generacion de archivo de entrega externa.
5. Antes de IoT/ERP, definir contratos de ingestion y normalizacion por dominio.
6. Agregar observabilidad especifica por integracion cuando haya trafico real.

## No Cambios Funcionales

- No se agregaron proveedores reales.
- No se cambiaron endpoints actuales.
- No se cambio auth actual.
- No se cambio UI.
- No se agregaron dependencias.
