# mineria-mvp - Offline y conectividad

Ultima actualizacion: 2026-05-13  
Documento unico: sustituye `OFFLINE_AUDIT.md`, `OFFLINE_CONTRACT.md`, `OFFLINE_PHASE_PLAN.md` y `OFFLINE_TEST_REPORT.md`.

## 1. Resumen

- **Objetivo del MVP:** continuidad en faena con señal intermitente (planificación con cola, lecturas degradadas con caché), no una PWA offline-first total.
- **Capa local:** casi todo persiste en **una misma IndexedDB** (`mineria-offline-store`) via `src/lib/localOfflineStore.ts`.
- **Capa de red:** Service Worker (`public/sw.js`) orientado a shell y assets; **no** sustituye IndexedDB para datos de negocio. En `next dev` / `localhost` el SW se limpia (ver `src/components/pwa-register.tsx`).

## 2. Almacenamiento local (fuente unica)

Base: **`mineria-offline-store`**, version `1`.

| Store IDB | Contenido | Clave | Escritura tipica |
|-----------|-----------|-------|------------------|
| `keyval` | Catálogo operativo planning | `planning-catalog` | Tras GET `/api/planning-catalog` OK (`saveCatalogCache`) |
| `keyval` | Perfil de usuario | `auth-profile` | Tras `/api/profile/sync` OK (`saveProfileCache`) |
| `keyval` | Cola mutaciones planning | `planning-mutation-queue` | Cada cambio en cola (`savePendingPlanningMutations`) |
| `keyval` | Snapshots reportes / admin | Claves versionadas (`reports-catalog-v1`, `reports-data-v1-*`, `admin-users-v1`, etc.) | `src/lib/reportsOfflineSnapshot.ts` (`saveKeyValueCache` / `readKeyValueCache`) |
| `planningByDate` | Items planning por día | `date` = `YYYY-MM-DD` | Tras GET `/api/planning-items?date=...` OK (`savePlanningCache`) |

**Migración legacy:** la cola antigua en `localStorage` se lee una vez en `src/app/(app)/page.tsx` y se migra a IDB; luego se borra la clave legacy. La cola **activa** vive en IndexedDB, no en `localStorage`.

**Fuera de IndexedDB (no datos de negocio):**

- `sessionStorage`: bandera de recarga tras cambio de SW (`pwa-register.tsx`).
- **Cache Storage** (`mineria-*`): HTML shell y rutas precacheadas según `public/sw.js`.

## 3. Matriz por flujo (estado actual)

### Autenticación (login, callback, `AuthProvider`)

- Lectura: perfil cacheado en IDB si aplica; sesión Supabase sigue dependiendo de red en varios casos.
- Escritura offline: login / solicitud de acceso / callback **no** soportados sin red (mensajes explícitos, `assertBrowserOnline` donde corresponde).

### Planificación (`/`)

- Lectura: catálogo e ítems por fecha con fallback a IDB (`readCatalogCache`, `readPlanningCache`).
- Escritura offline: POST/PATCH/DELETE encolados; reintento en `online`, `focus` e intervalo.
- **Nota de producto:** si no hay caché para una fecha y no hay red, el estado de ítems puede quedar desalineado con la fecha mostrada en el hero (último lote cargado no se limpia en todos los errores). Corregir en código si se prioriza.

### Catálogo admin (modal en home)

- Lectura: mismo caché de catálogo que planning.
- Escritura: requiere red.

### Dashboard, reportes, admin usuarios

- Lectura offline **degradada:** último snapshot en IDB (`reportsOfflineSnapshot.ts`); mensaje de “última sincronización” / modo offline según pantalla.
- Escritura: operaciones de mutación requieren red.

## 4. Contrato de mutaciones planning (v1)

Resumen operativo (detalle de tipos en código: `PendingPlanningMutation` en `page.tsx`):

- Cada mutación offline tiene identificador local y **`client_mutation_id`** para idempotencia con el backend.
- Orden: FIFO razonable por creación; reintentos en errores de red / sesión recuperable.
- Conflictos (p. ej. 409): estado `conflict` y acción de usuario; no bloquear el resto de la cola.
- Tras éxito remoto, refrescar vista y persistir caché del día.

Estados UX deseables (referencia, no obligación de enum único en UI): `online`, `offline`, `syncing`, `pending-sync`, `synced`, `conflict`, `sync-error`.

## 5. Roadmap por fases (seguimiento)

| Fase | Objetivo | Estado (2026-05-13) |
|------|-----------|---------------------|
| **P0** | Estados/mensajes de conectividad coherentes; pruebas manuales guía reconexión | En progreso / iterativo |
| **P1** | Cola planning en IDB + migración legacy + idempotencia | **Hecho** (cola en IDB + migración) |
| **P2** | Offline-read fuera de planning (snapshots) | **Parcial:** dashboard, reportes, admin usuarios con snapshots y UI |
| **P3** | Backoff unificado, resolución de conflictos guiada, telemetría | Pendiente |

Trabajo transversal abierto: navegación entre rutas sin red (shell + SW + alineación URL/router). Detalle de tareas: `TASKS.md` sección offline.

## 6. Pruebas manuales registradas

Ambiente original de la corrida: `next dev` en `http://localhost:3000`, herramienta externa.

| Caso | Resultado |
|------|-------------|
| Login sin red | Mensaje de error de conexión esperado |
| Crear planning sin red | Registro pendiente + contador + barra `pendiente` |
| Reconexión con cola | Sincronización automática, desaparece pendiente |
| Hard reload sin red | **Gap:** error de navegador si no hay SW/HTML en caché; en producción con SW mejora solo parcialmente (chunks `/_next/` no pasan por el SW actual) |

Validaciones de repo: `npm run lint` y `npm run build` OK al momento del informe.

**Recomendación:** repetir smoke crítico en **`npm run build` + `npm run start`** (no `localhost` si se quiere SW activo, según `pwa-register.tsx`).

## 7. Gaps y riesgos conocidos

1. **Hard reload offline:** no prometer cobertura total en App Router sin estrategia explícita de caché de chunks.
2. **Navegación shell offline** con `history.pushState` vs App Router: riesgo de desalinear URL, `usePathname()` y contenido montado (ver análisis en código: `site-shell.tsx`).
3. **Gantt / fecha sin caché:** posible UI engañosa hasta corregir vaciado de ítems o filtro por `selectedDate`.
4. **`isBrowserOffline()` vs `isBrowserDisconnected()`:** criterios distintos entre shell y snapshots (`reportsOfflineSnapshot.ts`).

## 8. Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/lib/localOfflineStore.ts` | IndexedDB unificada |
| `src/lib/reportsOfflineSnapshot.ts` | Snapshots reportes/admin/dashboard |
| `src/lib/networkStatus.ts` | Señales de conectividad, healthcheck, mensajes |
| `src/app/(app)/page.tsx` | Planning + cola + caché por fecha |
| `src/providers/auth-provider.tsx` | Sesión + perfil cacheado |
| `src/components/site-shell.tsx` | Navegación offline lateral |
| `public/sw.js` | Shell / rutas / assets (excluye `/api/` y `/_next/` del control actual) |
| `src/components/pwa-register.tsx` | Registro SW y precache de rutas críticas en producción |
