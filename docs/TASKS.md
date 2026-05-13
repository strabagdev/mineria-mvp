# mineria-mvp - Task Board

Ultima actualizacion: 2026-05-12

## Como usar este archivo
- Mantener tareas chicas (max 1-2 horas).
- Una sola tarea en `Doing`.
- Al cerrar una tarea, dejar mini handoff de 3-5 lineas.

## Backlog
- [ ] Definir metricas clave del dashboard (fuente, formula, frecuencia).
- [ ] Revisar cobertura de validaciones en endpoints de `src/app/api/planning-*`.
- [ ] Agregar pruebas minimas de humo para login y flujo base autenticado.
- [ ] Documentar permisos/roles actuales y matriz de acceso por pantalla.
- [ ] Diseñar e implementar un Centro de Mensajes global para la app (reemplazar/elevar las barras simples bajo el header por una bandeja robusta de notificaciones de sistema, sync, conflictos y errores).
- [ ] Offline navigation full-app - fase 3: reconciliacion de transiciones internas App Router + SW para evitar errores de red en cambio de ruta.
- [ ] Offline navigation full-app - fase 4: pruebas E2E/manuales por ruta (`/`, `/dashboard`, `/reports`, `/admin/users`, `/login`, `/offline`) en hard reload y navegacion interna.

## En curso
- [ ] Offline navigation full-app - fase 1: app shell offline para rutas internas
  - Objetivo: poder cambiar de seccion sin red sin caer en pantalla negra del navegador.
  - Alcance:
    - `public/sw.js`
    - `src/components/site-shell.tsx`
    - rutas fallback (`/offline`)
  - Rutas soportadas (fase 1):
    - `/`
    - `/dashboard`
    - `/reports`
    - `/admin/users`
    - `/offline`
  - Sub-hitos:
    - [~] Hito A: navegacion interna offline (App Router + shell) estable. Avance: removido desvio forzado a `/offline` en `src/components/site-shell.tsx` y habilitado registro de SW en local (`src/components/pwa-register.tsx`, antes se desregistraba en dev); falta validacion manual sin red.
    - [x] Hito A.1: snapshots offline para Dashboard/Reportes/Admin. Implementado con lectura local primero, refresh online posterior, estado de red degradada centralizado y sello de ultima sincronizacion.
    - [ ] Hito B: hard reload offline con fallback controlado por ruta.
  - Entregables:
    - [ ] Navegacion offline entre secciones sin `ERR_INTERNET_DISCONNECTED`. Validacion: prueba manual con DevTools en `Offline` + navegacion interna en rutas soportadas.
    - [ ] Hard reload offline con fallback de app shell por ruta. Validacion: prueba manual con `Offline` + hard reload en cada ruta soportada.
    - [ ] Mensajeria clara de estado offline (sin bloquear continuidad). Validacion: smoke E2E/manual verificando banner/estado visible y continuidad de uso.
  - Criterio de exito:
    - Desde una sesion ya iniciada, usuario navega sin red a rutas soportadas y siempre recibe UI controlada.
## Hecho
- [x] Auditoria offline/online + plan full offline-first (2026-05-10)
  - Objetivo: mapear exactamente el comportamiento sin conectividad y definir/ejecutar una estrategia para operar 100% offline con sincronizacion confiable al recuperar red.
  - Alcance inicial:
    - Mensaje de red: `src/lib/networkStatus.ts`
    - Flujos auth: `src/app/login/page.tsx`, `src/app/auth/callback/page.tsx`, `src/providers/auth-provider.tsx`, `src/lib/authClient.ts`
    - Flujos planificacion offline: `src/app/(app)/page.tsx`, `src/lib/localOfflineStore.ts`, endpoints `src/app/api/planning-*/route.ts`
  - Casos detectados donde aparece hoy el mensaje:
    - Login y solicitud de acceso cuando `assertBrowserOnline()` detecta `navigator.onLine = false`.
    - Callback de autenticacion al intentar sincronizar perfil sin red.
    - Errores de red en llamadas auth de Supabase via `resilientAuthFetch` (`failed to fetch`, `fetch failed`, etc.).
    - Errores de red al resolver sesion inicial en login (`getSession`) y en operaciones de planificacion que usen `getRequestErrorMessage`.
  - Entregables:
    - [x] Matriz offline por flujo (auth, catalogos, planificacion, reportes, admin). Ver `OFFLINE_AUDIT.md`.
    - [x] Definicion de contrato de datos offline (cache local, cola de mutaciones, conflictos, reintentos). Ver `OFFLINE_CONTRACT.md`.
    - [x] Plan tecnico por fases (P0 estabilidad, P1 offline escritura/lectura, P2 sync robusta, P3 observabilidad). Ver `OFFLINE_PHASE_PLAN.md`.
    - [~] Implementacion fase prioritaria acordada. Avance: cola de mutaciones migrada de `localStorage` a `IndexedDB` con migracion automatica legacy.
    - [x] Pruebas E2E/manuales en escenarios sin red, red intermitente y reconexion. Evidencia en `OFFLINE_TEST_REPORT.md` (incluye gap conocido en hard reload offline sin SW fallback).
    - [x] Definir alcance UX/tecnico del Centro de Mensajes (prioridades, severidad, persistencia, descartes, historial y accionables). Ver `MESSAGE_CENTER_SCOPE.md`.
  - Criterio de exito:
    - Usuario puede seguir operando planificacion sin red.
    - Al volver la conexion, la sincronizacion es automatica, idempotente y con manejo explicito de conflictos.
    - Mensajeria de estado clara: offline, pendiente de sync, sincronizado, conflicto.
- [x] Crear `ARCHITECTURE.md` y `TASKS.md` para reducir contexto en sesiones nuevas. (2026-05-10)

## Plantilla de nueva tarea
```md
### Titulo corto
- Objetivo:
- Alcance (archivos/rutas):
- Criterio de exito:
- Estado: Todo | Doing | Done
```

## Mini handoff (ultima sesion)
- Se crearon documentos base de arquitectura y tablero de trabajo.
- El objetivo es arrancar chats nuevos con contexto corto y consistente.
- Siguiente paso sugerido: tomar una tarea del backlog y ejecutarla en un solo bloque.
