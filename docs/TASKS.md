# mineria-mvp - Task Board

Ultima actualizacion: 2026-05-13

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
- [ ] Offline navigation: reconciliar App Router + SW (evitar errores en cambio de ruta); pruebas manuales por ruta. Contexto y gaps: `docs/OFFLINE.md`.

## Limpieza y consistencia del repo
- [x] Revisar archivo `.codex`.
  - Riesgo: bajo.
  - Hallazgo: esta trackeado por Git y existe como archivo vacio (0 bytes).
  - Reparacion aplicada: eliminado del repo y agregado `.codex` a `.gitignore`.
- [x] Revisar `src/lib/planning-options.ts`.
  - Riesgo: bajo.
  - Hallazgo: no se encontraron imports ni usos externos; solo referencias internas dentro del mismo archivo.
  - Confirmacion: el catalogo operativo viene desde `/api/planning-catalog` y cache local (`readCatalogCache` / `saveCatalogCache`).
  - Reparacion aplicada: eliminado por no tener uso real en la aplicacion.
- [x] Revisar consistencia de nombres en `src/lib`.
  - Riesgo: bajo.
  - Hallazgo: `planning-options.ts` es el unico archivo en kebab-case dentro de `src/lib`.
  - Reparacion aplicada: al eliminar `planning-options.ts`, ya no queda archivo kebab-case en `src/lib`.
- [x] Revisar `components.json`.
  - Riesgo: bajo.
  - Hallazgo: alias `hooks` -> `@/hooks` existe.
  - Hallazgo: `src/hooks/` no existe actualmente.
  - Observacion: no crear carpeta si no es necesaria; mantener solo como nota para futuros componentes shadcn/hooks.
- [x] Revisar `.gitignore` y `next-env.d.ts`.
  - Riesgo: bajo.
  - Hallazgo: `next-env.d.ts` esta ignorado en `.gitignore` y tambien en `eslint.config.mjs`.
  - Observacion: es una decision de equipo, no necesariamente un error; `tsconfig.json` lo incluye como archivo esperado.

## En curso
- [ ] Offline navigation (shell + SW + alineacion con App Router)
  - Objetivo: cambiar de seccion sin red sin pantalla negra; UI controlada con sesion ya iniciada.
  - Alcance principal: `public/sw.js`, `src/components/site-shell.tsx`, `/offline`.
  - Rutas objetivo: `/`, `/dashboard`, `/reports`, `/admin/users`, `/offline`, `/login`.
  - Progreso y criterios detallados: `docs/OFFLINE.md` (secciones 5, 6 y 7).
  - Pendiente destacado: validacion manual sin red; hard reload por ruta; mensajeria coherente en todas las vistas.

## Hecho
- [x] Auditoria offline/online + plan full offline-first (2026-05-10)
  - Objetivo: mapear exactamente el comportamiento sin conectividad y definir/ejecutar una estrategia para operar 100% offline con sincronizacion confiable al recuperar red.
  - Alcance inicial:
    - Mensaje de red: `src/lib/networkStatus.ts`
    - Flujos auth: `src/app/login/page.tsx`, `src/app/auth/callback/page.tsx`, `src/providers/auth-provider.tsx`, `src/lib/authClient.ts`
    - Flujos planificacion offline: `src/app/(app)/page.tsx`, `src/lib/localOfflineStore.ts`, endpoints `src/app/api/planning-*/route.ts`
  - Casos y mensajes de red: ver `docs/OFFLINE.md` y `src/lib/networkStatus.ts` (lista detallada ya no se duplica aqui).
  - Entregables:
    - [x] Documentacion offline unificada: matriz por flujo, almacenamiento local, contrato planning, fases, pruebas y gaps. Ver `docs/OFFLINE.md`.
    - [x] Cola de mutaciones planning en IndexedDB con migracion legacy desde `localStorage`.
    - [x] Pruebas manuales iniciales (login offline, planning pendiente, reconexion). Resultados y gaps: `docs/OFFLINE.md` seccion 6.
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
- Documentacion offline consolidada en un solo archivo `docs/OFFLINE.md` (eliminados `OFFLINE_AUDIT`, `OFFLINE_CONTRACT`, `OFFLINE_PHASE_PLAN`, `OFFLINE_TEST_REPORT`).
- `TASKS.md` y `docs/README.md` apuntan a `OFFLINE.md` para evitar duplicar matriz, contrato y pruebas.
- Siguiente paso sugerido: cerrar tareas abiertas de navegacion shell/SW usando `OFFLINE.md` como checklist.
