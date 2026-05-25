# Auth Module

Ownership:

- Facade cliente de autenticacion.
- Tipos propios de sesion, usuario y perfil de aplicacion.
- Operaciones cliente de login, logout, callback y escucha de sesion.
- Contratos provider-neutral para adapters de autenticacion.
- Adapter Supabase actual como implementacion activa, sin cambiar comportamiento.

No debe contener:

- Reglas de planning/reporting.
- Permisos sensibles decididos solo en UI.
- Realtime de dominios operacionales.

Server auth/access sigue en `src/server/auth` y `src/server/services/access.service.ts` por transicion incremental.
