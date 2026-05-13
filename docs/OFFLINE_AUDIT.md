# mineria-mvp - Offline Audit

Fecha: 2026-05-10

## Objetivo
Documentar el estado actual offline/online de la plataforma, identificar en qué casos aparece el mensaje:

`No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; vuelve a intentar cuando recuperes conexion.`

y definir un plan para evolucionar a una experiencia full offline-online (offline-first con sincronizacion robusta).

## Mensaje de red: origen y disparadores actuales

- Origen del mensaje:
  - `src/lib/networkStatus.ts` (`NETWORK_ERROR_MESSAGE`)
- Se dispara hoy en estos casos:
  - `assertBrowserOnline()` cuando `navigator.onLine` es `false`.
    - Uso directo en login y solicitud de acceso: `src/app/login/page.tsx`
    - Uso directo en callback de auth: `src/app/auth/callback/page.tsx`
    - Uso directo en acciones admin (usuarios): `src/app/(app)/admin/users/page.tsx`
    - Uso directo en fetch de planning/catalogo: `src/app/(app)/page.tsx`
  - Errores de red detectados por regex (`failed to fetch`, `fetch failed`, etc.).
    - Traduccion a `NETWORK_ERROR_MESSAGE` en auth fetch wrapper:
      - `src/lib/authClient.ts` (`resilientAuthFetch`)
  - Flujos que usan `getRequestErrorMessage()` en planning:
    - Si el error es de red, retorna ese mensaje.

## Matriz actual offline/online por flujo

### 1) Autenticacion (login + callback + provider)
- Lectura offline:
  - `AuthProvider` intenta usar perfil cacheado (`readProfileCache`) si no hay red.
- Escritura offline:
  - No soportada para login/request-access/callback (requieren red).
- Comportamiento actual:
  - Login y request access fallan de forma explicita offline con mensaje de red.
  - Callback puede fallar offline al sync de perfil.
  - Si ya existe sesion/perfil cacheado, parte de la UX puede cargar con fallback local.
- Riesgo:
  - Sesion inicial depende de red para validar/sincronizar estado en varios casos.

### 2) Planificacion (home)
- Lectura offline:
  - Catalogo: fallback a IndexedDB (`readCatalogCache`) si falla fetch.
  - Items por fecha: fallback a IndexedDB (`readPlanningCache`) si falla fetch.
- Escritura offline:
  - Soportada para `POST/PATCH/DELETE` de planning items.
  - Cola local en `localStorage` (`PLANNING_MUTATION_QUEUE_KEY`).
  - Reintento automatico en eventos `online`, `focus`, e intervalo.
- Resolucion de sincronizacion:
  - Reintenta en orden.
  - Errores reintentables (red/sesion) quedan pendientes.
  - Conflictos pasan a estado `conflict` y requieren accion del usuario.
  - Existe UI de estado pendiente en barras Gantt (`sync_status: "pending"`).
- Estado:
  - Este es el modulo mas cercano a offline-first real.

### 3) Catalogo de planificacion (admin)
- Lectura offline:
  - En home, se usa cache local si falla fetch.
- Escritura offline:
  - No soportada (create/update/delete exige conexion).
- Estado:
  - Offline-read parcial, offline-write no disponible.

### 4) Reportes
- Lectura offline:
  - No hay cache offline de reportes.
- Escritura offline:
  - No aplica (consulta).
- Estado:
  - Totalmente online-dependiente.

### 5) Administracion de usuarios
- Lectura offline:
  - No hay cache local de lista de usuarios.
- Escritura offline:
  - No soportada.
- Estado:
  - Totalmente online-dependiente.

## Brechas para “full offline-online”

- Falta un contrato unificado de sincronizacion (versionado, idempotencia y politica de conflictos) para todos los modulos, no solo planning.
- Falta estrategia de sesion offline claramente definida (qué puede hacer un usuario autenticado sin nueva validacion remota).
- Falta store local unificado por dominio (hoy hay mezcla IndexedDB + localStorage + estado en memoria).
- Falta observabilidad operativa de sincronizacion (metricas, trazas y debugging de cola).
- Falta coverage de pruebas sistematicas de red intermitente y reconexion.

## Propuesta tecnica por fases

### P0 - Estabilidad y visibilidad (corto plazo)
- Estandarizar estados UX de conectividad:
  - `offline`, `online`, `syncing`, `sync-error`, `conflict`.
- Centralizar mensajes de error/red por dominio.
- Instrumentar contador local de pendientes y timestamp de ultima sync exitosa.
- Crear test manual guiado de escenarios:
  - sin red al cargar
  - sin red al guardar
  - reconexion con cola pendiente
  - conflicto de sincronizacion

### P1 - Offline-first de datos operacionales (planning extendido)
- Migrar cola de mutaciones de `localStorage` a IndexedDB (transaccional).
- Normalizar envelope de mutacion:
  - `id`, `entity`, `method`, `payload`, `createdAt`, `retryCount`, `status`, `lastError`.
- Asegurar idempotencia extremo a extremo con `client_mutation_id` consistente.
- Mejorar merge local-remoto para evitar saltos visuales y duplicados.

### P2 - Offline-read transversal (reportes/admin)
- Reportes:
  - cachear ultimo dataset por filtro (o snapshots diarios clave).
  - definir marca clara “datos en cache”.
- Admin:
  - cache de solo lectura de usuarios para consulta en terreno.
  - mantener operaciones de escritura bloqueadas offline con UX explicita.

### P3 - Sync robusta y observabilidad
- Motor de sync unico por dominio con prioridades y backoff exponencial.
- Resolucion de conflictos asistida (UI con diff y opcion conservar local/remoto).
- Telemetria:
  - tasa de exito de sync
  - tiempo medio a sincronizacion
  - cantidad de conflictos por tipo

## Definicion de “full offline-online” para este producto

Se considera logrado cuando:
- El usuario autenticado puede consultar y registrar planificacion sin red.
- Toda escritura offline queda persistida localmente y visible de inmediato.
- La reconexion sincroniza automaticamente sin duplicar registros (idempotencia).
- Los conflictos se detectan y se presentan con accion concreta de resolucion.
- Modulos no transaccionales (reportes/admin) degradan con cache legible y mensajes claros.

## Recomendacion de siguiente implementacion

Priorizar P0 + inicio de P1 en planning:
- mover cola de mutaciones a IndexedDB,
- estandarizar estados de sync en UI,
- y cerrar un set de pruebas de reconexion/conflicto.

