# Audit Module

Modulo de contratos, cliente HTTP y presentacion de auditoria persistida.

## Que Es

Auditoría de negocio persistida en `audit_logs`.

Flujo:

```text
writeAuditLog
  -> audit_logs
  -> GET /api/audit-events
  -> /admin/audit
  -> timeline en ficha de programado
```

## Que No Es

No es observability runtime. Los eventos de runtime usan
`recordOperationalEvent` en `src/lib/observability` y sirven para diagnosticar
red, sync, auth y realtime. No reemplazan `audit_logs`.

## Estructura

- `contracts/audit.ts`: DTOs de eventos y query.
- `application/audit-events.client.ts`: cliente para `GET /api/audit-events`.
- `presentation/audit-events-display.ts`: labels humanos y formato JSON.
- `presentation/planning-audit-timeline.tsx`: timeline admin en ficha del
  programado.

Server:

- Escritura: `src/lib/auditLog.ts`.
- Repository: `src/server/repositories/audit.repository.ts`.
- Service: `src/server/services/audit.service.ts`.
- API: `src/app/api/audit-events/route.ts`.

## Reglas

- Lectura admin-only.
- Online-only.
- No llamar `writeAuditLog` desde UI.
- No mostrar acciones tecnicas en vistas principales.
- Si se muestra detalle tecnico, usar labels humanos:
  `Acción técnica`, `Antes`, `Después`, `Detalles del evento`.

## Documentacion

Ver `docs/architecture/audit.md`.
