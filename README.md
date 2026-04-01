# Auth Base

Base minima en Next.js + Supabase Auth para arrancar un producto desde una autenticacion ya operativa.

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
NEXT_PUBLIC_SUPABASE_AUTH_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_AUTH_ANON_KEY=your-anon-key
SUPABASE_AUTH_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Perfil opcional
Si quieres mantener la sincronizacion del perfil autenticado en Supabase, ejecuta:

```sql
\i supabase/sql/001_schema.sql
```

Esto crea la tabla `profiles` usada por `/api/profile/sync`.

## Desarrollo

```bash
npm install
npm run dev
```

## Rutas
- `/login`
- `/auth/callback`
- `/`
