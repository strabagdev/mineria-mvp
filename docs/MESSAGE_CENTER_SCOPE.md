# mineria-mvp - Alcance Centro de Mensajes (v1)

Fecha: 2026-05-10

## Objetivo
Reemplazar barras simples por un Centro de Mensajes global, accionable y persistente para estados operativos.

## Tipos de mensaje
- `system`: estado de conectividad, mantenimiento.
- `sync`: pendientes, sincronizando, sincronizado.
- `conflict`: conflictos de datos.
- `error`: errores operativos no bloqueantes.
- `success`: confirmaciones relevantes (opcional, bajo volumen).

## Severidad
- `info`, `warning`, `error`, `critical`.

## Prioridad visual
1. `critical/error`
2. `conflict`
3. `sync`
4. `info/success`

## Comportamiento
- Bandeja global accesible desde header.
- Badge con contador de no leidos.
- Mensajes fijados cuando:
  - hay conflictos sin resolver,
  - hay sync-error persistente.
- Auto-dismiss solo para informativos.
- Todos los mensajes clave deben ser accionables.

## Acciones iniciales
- `Reintentar sync`
- `Ver pendientes`
- `Descartar conflictos`
- `Ir a detalle` (cuando aplique)

## Persistencia
- Persistir en cliente (IndexedDB) mensajes de `sync/conflict/error`.
- TTL sugerido:
  - `info/success`: 24h
  - `sync/error/conflict`: hasta resolucion manual

## Integraciones iniciales
- Fuente actual: `PlanningStatusStrip` + estados de `page.tsx`.
- Paso 1: adaptar a un store de mensajes central.
- Paso 2: render global en layout/header.

## Criterio de exito
- Usuario entiende estado operativo sin leer logs.
- Puede resolver conflictos y reintentos desde una sola bandeja.
- Se reduce dependencia de mensajes efimeros bajo el header.

