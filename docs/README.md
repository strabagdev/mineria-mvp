# Auth Base

Ultima actualizacion: 2026-05-13

Base minima en Next.js + Supabase Auth para arrancar un producto desde una autenticacion ya operativa.

## Convencion de documentos
- `TASKS.md` = estado vivo de ejecucion y handoff.
- Resto de archivos `.md` = referencia estable (arquitectura, decisiones, auditorias, reportes).

## Indice
- `README.md` (este archivo): vision rapida del proyecto.
- `ARCHITECTURE.md`: arquitectura y decisiones de alto nivel.
- `TASKS.md`: backlog, trabajo en curso, hecho y mini handoff.
- `OFFLINE.md`: documentacion unica de offline/conectividad (almacenamiento, matriz por flujo, contrato planning, fases, pruebas, gaps, archivos clave).
- `MESSAGE_CENTER_SCOPE.md`: alcance UX/tecnico del centro de mensajes.
- `architecture/audit.md`: auditoría persistida, flujo `writeAuditLog` ->
  `audit_logs` -> `/admin/audit` y timeline de programado.

## Incluye
- Login con email y password
- Creacion de usuario
- Magic link
- Callback de autenticacion
- Sincronizacion opcional de perfil en tabla `profiles`
- Pagina inicial limpia despues de iniciar sesion

## Variables de entorno
Crea `.env.local` en la raiz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAIL=admin@empresa.com
```

Para Vercel, configura las mismas variables en cada ambiente que corresponda
(`Production`, `Preview` y/o `Development`) antes de desplegar:

- `NEXT_PUBLIC_SUPABASE_URL`: URL publica del proyecto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publica usada por el cliente web
  y validacion de sesiones. Es la unica variable publica oficial para la clave.
- `SUPABASE_SERVICE_ROLE_KEY`: clave privada usada solo por el servidor. Nunca
  debe exponerse con prefijo `NEXT_PUBLIC_`.
- `ADMIN_EMAIL`: correo bootstrap del administrador, si aplica.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` es una convencion antigua y no se usa como
fallback. Las variables `NEXT_PUBLIC_*` quedan incorporadas en el bundle durante
el build: despues de agregarlas o cambiarlas en Vercel, ejecuta un redeploy.

## Base de datos
Para preparar Supabase, ejecuta los SQL en este orden:

```sql
\i supabase/sql/001_schema.sql
\i supabase/sql/002_seed_catalog.sql
\i supabase/sql/003_security_realtime.sql
\i supabase/sql/004_planning_custom_fields.sql
\i supabase/sql/005_planning_custom_field_icons.sql
\i supabase/sql/006_assignment_catalog.sql
\i supabase/sql/007_planning_assignments.sql
\i supabase/sql/008_assignment_type_icons.sql
\i supabase/sql/009_operator_role.sql
\i supabase/sql/010_target_aware_assignments.sql
\i supabase/sql/011_operational_header.sql
\i supabase/sql/012_operational_header_hardening.sql
\i supabase/sql/013_drop_planning_custom_fields.sql
\i supabase/sql/014_drop_level_front_legacy.sql
\i supabase/sql/015_drop_planning_items_level_residual.sql
\i supabase/sql/016_operational_header_grouping_order.sql
\i supabase/sql/017_reconcile_real_execution_segments.sql
\i supabase/sql/018_update_planning_items_valid_range.sql
```

Esto crea el esquema actual, carga catalogos iniciales, habilita RLS/realtime,
agrega Asignaciones y Cabecera Operacional, y retira las estructuras legacy
eliminadas al cierre de H5. Tambien deja disponible `grouping_order` para
ordenar la agrupacion Gantt sin alterar el orden visual general. La migracion
017 agrega la reconciliacion atomica de tramos reales editados y la 018 alinea
el CHECK SQL de programados con la regla de inicio de turno.

## Desarrollo

```bash
npm install
npm run dev
```

## Rutas
- `/login`
- `/auth/callback`
- `/`
