# mineria-mvp - Plan Tecnico por Fases (Offline)

Fecha: 2026-05-10

## P0 - Estabilidad y visibilidad
- Objetivo: estandarizar estados y reducir incertidumbre operativa.
- Entregables:
  - estados unificados (`offline`, `syncing`, `pending-sync`, `conflict`, `synced`, `sync-error`)
  - mensajes de red normalizados por dominio
  - telemetria minima cliente (`pendingCount`, `conflictCount`, `lastSuccessfulSyncAt`)
  - protocolo de pruebas manuales de red intermitente/reconexion
- Estado: en progreso

## P1 - Offline-write robusto en planning
- Objetivo: asegurar escritura offline confiable e idempotente.
- Entregables:
  - cola en IndexedDB (sin dependencia de `localStorage`)
  - migracion legacy automatica
  - envelope de mutacion estandar con `client_mutation_id`
  - reintento ordenado + manejo de conflictos
- Estado: en progreso (cola IndexedDB completada)

## P2 - Offline-read transversal
- Objetivo: degradacion elegante fuera de planning.
- Entregables:
  - cache de reportes (ultimo dataset por filtros clave)
  - cache lectura para admin/users
  - sello visual de “datos cacheados”
- Estado: pendiente

## P3 - Sync avanzada y observabilidad
- Objetivo: resolver conflictos y monitorear salud de sincronizacion.
- Entregables:
  - motor de sync con backoff exponencial y prioridades
  - acciones guiadas de resolucion de conflictos
  - metricas de sync (exito, tiempo, conflictos por tipo)
- Estado: pendiente

