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

## Base de datos
Para preparar Supabase, ejecuta los SQL en este orden:

```sql
\i supabase/sql/001_schema.sql
\i supabase/sql/002_seed_catalog.sql
\i supabase/sql/003_security_realtime.sql
```

Esto crea el esquema actual, carga catalogos iniciales, habilita RLS y activa realtime para planificacion.

## Desarrollo

```bash
npm install
npm run dev
```

## Rutas
- `/login`
- `/auth/callback`
- `/`
