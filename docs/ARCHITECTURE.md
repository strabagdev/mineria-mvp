# mineria-mvp - Arquitectura Breve

## Objetivo
MVP web para operacion minera con autenticacion, planificacion operacional y reportes.

## Stack
- Next.js (App Router) + TypeScript
- Supabase (Auth + Postgres + RLS + Realtime)
- UI basada en componentes locales en `src/components`

## Estructura
- `src/app`: rutas App Router, layouts y paginas
- `src/app/api`: endpoints server-side (users, reports, planning, profile sync, auth request access)
- `src/components`: componentes UI y dominio (planning, shell, cards, temas)
- `src/lib`: utilidades de negocio y acceso (auth, reportes, control de acceso, offline store)
- `supabase/sql`: schema, seed y seguridad/realtime

## Flujos principales
1. Usuario inicia sesion en `/login` y vuelve via `/auth/callback`.
2. La app valida acceso/rol y renderiza vistas en `src/app/(app)`.
3. Modulos principales:
   - Dashboard (`/dashboard`)
   - Planificacion (home `/`)
   - Reportes (`/reports`)
   - Admin de usuarios (`/admin/users`)
4. API routes usan Supabase server/client segun caso.

## Decisiones actuales
- Auth centralizado con Supabase.
- Seguridad por RLS en base de datos.
- Catalogos de planificacion pre-sembrados via SQL.
- Soporte PWA basico (`public/sw.js`, iconos, manifest); detalle offline y caché local en `docs/OFFLINE.md`.

## Convenciones de trabajo (token-friendly)
- Cambios pequenos por modulo/archivo.
- Cada tarea define: objetivo, alcance, criterio de exito.
- Cerrar cada bloque con mini handoff en `TASKS.md`.

