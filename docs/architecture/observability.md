# Observabilidad Interna

Ultima actualizacion: 2026-05-24

La observabilidad inicial de Mineria MVP es una capa local, ligera y sin proveedores externos. Su objetivo es diagnosticar problemas operacionales durante desarrollo y preparar una futura integracion con drains, dashboards o alertas sin acoplar la aplicacion a una plataforma especifica.

No es auditoría de negocio. La auditoría persistida vive en `audit_logs` y se
documenta en `docs/architecture/audit.md`.

## Arquitectura

Fuente principal: `src/lib/observability/`

| Archivo | Responsabilidad |
| --- | --- |
| `events.ts` | Tipos de eventos operacionales, niveles y metadata permitida |
| `logger.ts` | Registro estructurado, saneamiento basico y buffer circular en memoria |
| `index.ts` | API publica de la capa |

La API principal es:

```ts
recordOperationalEvent({
  level: "info" | "warn" | "error",
  name: "sync.replay_started",
  source: "planningMutationQueue",
  metadata: { pendingCount: 2 }
});
```

## Politicas

- No se envian eventos a servicios externos.
- No se persisten grandes volumenes.
- El buffer en memoria retiene los ultimos 150 eventos.
- En desarrollo se escribe a `console.info`, `console.warn` o `console.error`.
- En produccion se mantiene el buffer, pero no se escribe ruido a consola.
- Metadata con claves sensibles (`token`, `authorization`, `password`, `secret`, `email`) se filtra.
- No se registran payloads de mutaciones, tokens ni datos personales.

## Diferencia Con Auditoría

| Tema | Observability runtime | Auditoría |
| --- | --- | --- |
| API principal | `recordOperationalEvent` | `writeAuditLog` |
| Persistencia | Buffer local en memoria | Tabla `audit_logs` |
| Objetivo | Diagnosticar estado tecnico/operacional | Reconstruir cambios de negocio |
| Ejemplos | red, sync, realtime, fallback auth | planning, assignments, custom fields, usuarios |
| UI actual | Sin panel dedicado | `/admin/audit` y timeline del programado |
| Acceso | Interno/runtime | Admin-only |
| Offline | Puede registrar degradaciones locales | Consulta online-only |

Regla practica: si quieres saber por que la app degrado o fallo, usa
observability. Si quieres saber quien cambio un dato de negocio y que cambio,
usa auditoría.

## Eventos instrumentados

| Evento | Fuente | Nivel tipico | Metadata |
| --- | --- | --- | --- |
| `network.status_changed` | `networkStatus` | `info`/`warn` | estado anterior/siguiente, razon, health status |
| `network.heartbeat` | `networkStatus` | `info`/`warn` | evento heartbeat, razon, estado actual |
| `network.request_failed` | `networkStatus` | `warn` | razon |
| `indexeddb.transaction_failed` | `localOfflineStore` | `error` | store, modo, fase |
| `sync.queue_loaded` | mutation queue store | `info` | conteo, storage |
| `sync.queue_persisted` | mutation queue store | `info` | conteo total y conflictos |
| `sync.legacy_queue_migrated` | mutation queue store | `info` | conteo migrado |
| `sync.replay_started` | planning mutation queue | `info` | pendientes/conflictos |
| `sync.replay_failed` | planning mutation queue | `warn` | retryable, metodo, indice |
| `sync.conflict_detected` | planning mutation queue | `warn` | metodo, indice |
| `sync.replay_finished` | planning mutation queue | `info`/`warn` | synced, next queue, flags |
| `realtime.subscription_started` | realtime adapter | `info` | fecha |
| `realtime.subscription_status` | realtime adapter | `info`/`warn` | fecha, status |
| `realtime.subscription_stopped` | realtime adapter | `info` | fecha |
| `realtime.refresh_deferred` | realtime hook | `info` | fecha, pestana oculta |
| `realtime.refresh_failed` | planning page | `warn` | fecha |
| `auth.session_recovery_started` | AuthProvider | `info` | - |
| `auth.session_recovery_finished` | AuthProvider | `info` | si hay sesion |
| `auth.session_recovery_failed` | AuthProvider | `warn` | razon |
| `auth.profile_sync_failed` | AuthProvider | `warn` | status/razon |
| `auth.offline_profile_used` | AuthProvider | `info` | razon |
| `offline.cache_used` | planning page | `info` | dataset |
| `offline.cache_miss` | planning page | `warn` | dataset |
| `offline.snapshot_saved` | reports snapshots | `info` | dataset |
| `refresh.failed` | planning page | `warn` | objetivo |

## Panel interno

No se creo panel `/system/status` ni dashboard visual en esta tarea. La razon: el buffer actual es suficiente como base tecnica, y exponer una ruta nueva requiere decidir permisos, alcance de datos y experiencia administrativa. Queda preparado mediante `getOperationalEvents()` para una vista futura.

## Riesgos actuales

1. El buffer es por runtime/pestana; no hay agregacion cross-tab ni historico.
2. Los eventos no sobreviven reload.
3. La severidad aun no esta conectada a alertas ni SLA.
4. Algunos errores siguen naciendo desde strings de UI, no desde codigos tipados.
5. Realtime status depende de los estados emitidos por Supabase.
6. En produccion no hay sink externo, por lo que solo sirve para diagnostico local si se expone luego.

## Roadmap

### Corto plazo

- Crear panel admin seguro para leer `getOperationalEvents()`.
- Agregar filtros por nivel, source y nombre de evento.
- Incorporar correlation ids para sync batches.

### Mediano plazo

- Conectar sinks opcionales: endpoint interno, Vercel logs o drains.
- Definir eventos canonicos por modulo.
- Agregar metricas agregadas: tiempo offline, sync latency, conflictos por dia.

### Largo plazo

- Alertas operacionales.
- Retencion controlada y sampling.
- Integracion con observabilidad externa cuando el producto lo requiera.
