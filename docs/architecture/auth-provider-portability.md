# Auth Provider Portability

## Objetivo

Preparar la arquitectura para una posible migracion futura de proveedor de
autenticacion sin reemplazar Supabase Auth ahora. El comportamiento actual de
login, callback, sesiones, permisos, perfiles y endpoints se mantiene.

## Estado Actual

| Area | Estado | Ubicacion |
| --- | --- | --- |
| Auth cliente | Facade propio con tipos `AppUser` y `AppSession` | `src/modules/auth/application` |
| Provider activo cliente | Supabase Auth | `src/lib/authClient.ts`, `supabase-auth-adapter.ts` |
| Provider React | Maneja sesion, perfil cacheado y sync `/api/profile/sync` | `src/providers/auth-provider.tsx` |
| Callback/login | Usa facade cliente existente | `src/app/login`, `src/app/auth/callback` |
| Server session validation | Valida Bearer token contra Supabase | `src/server/auth/auth-session.ts` |
| Admin APIs | Crea/borra/actualiza usuarios con Supabase Admin | `src/server/auth/auth-admin.ts` |
| Access/profile sync | Sincroniza perfil interno desde identidad auth | `src/server/services/access.service.ts` |
| Realtime auth | Usa token Supabase en adapter realtime planning | `src/modules/planning/realtime` |

## Cambios Seguros Aplicados

- Se agrego `AuthProviderAdapter` como contrato cliente provider-neutral.
- Se movio la implementacion Supabase cliente a `supabaseAuthAdapter`.
- `auth-client.ts` queda como facade estable y delega al adapter activo.
- `AppUser` y `AppSession` ahora aceptan `provider` opcional.
- Se agrego `src/server/auth/contracts.ts` con `AuthenticatedUser` y contratos
  server neutrales.
- `auth-session.ts` mapea el usuario Supabase a `AuthenticatedUser`.
- `access.service.ts` deja de depender del tipo `User` de Supabase y consume el
  contrato neutral.

No se cambiaron endpoints, UI, permisos, sesiones existentes ni el proveedor
activo.

## Acoplamientos Restantes A Supabase

| Acoplamiento | Ubicacion | Riesgo | Recomendacion |
| --- | --- | --- | --- |
| `access_token` en `AppSession` | UI, fetches, sync, reports | Nombre y semantica bearer provider-specific | Mantener por compatibilidad; agregar alias futuro `token` solo con migracion controlada. |
| Validacion Bearer via Supabase | `src/server/auth/auth-session.ts` | Otro provider podria usar cookies/JWT distinto | Crear `ServerAuthProviderAdapter` cuando haya migracion real. |
| Realtime requiere token Supabase | `planning-realtime-adapter.ts` | Realtime queda atado al provider actual | Mantener adapter realtime por dominio; desacoplar si cambia realtime provider. |
| Admin APIs Supabase | `src/server/auth/auth-admin.ts` | Create/delete/update tienen shapes provider-specific | Mantener boundary; mapear resultados neutros cuando se migre admin users. |
| `user_metadata` | Supabase adapter/session mapping | Metadatos no portables | Ya se mapea a `metadata`; evitar uso directo fuera de server auth. |
| Profile sync por email/id | `access.service.ts`, repositories | Otro provider puede entregar claims distintos | Mantener perfil interno como fuente de permisos. |
| Env vars Supabase | `.env.example`, `src/lib/env.ts` | Config acoplada al provider | Introducir env provider-neutral solo al migrar. |

## Arquitectura Objetivo

```txt
UI / AuthProvider
  -> auth-client facade
    -> AuthProviderAdapter
      -> SupabaseAuthAdapter actual
      -> Auth.js/Cognito/Keycloak adapter futuro

API routes
  -> requireApprovedUser / requireAdminUser
    -> server auth boundary
      -> ServerAuthProviderAdapter futuro
      -> access/profile service
        -> perfil interno y permisos de aplicacion
```

El proveedor de auth debe autenticar identidad y sesion. Los permisos
operacionales siguen perteneciendo al perfil interno de la plataforma.

## Capacidades Minimas Requeridas

- Obtener sesion actual en cliente.
- Login con email/password mientras esa UX exista.
- Logout.
- Escucha de cambios de sesion.
- Callback OAuth/email.
- Verificacion OTP si se mantiene magic link/invite.
- Token bearer o alternativa server-side equivalente.
- Validacion server-side de sesion.
- Admin create/delete/update o flujo alternativo de provisioning.

## Estrategia Futura Por Provider

### Auth.js

Conviene si se pasa a cookies server-side y multiples providers OAuth. Requiere
redisenar callback/session handling y posiblemente los fetches que hoy usan
`Authorization: Bearer`.

### Cognito

Conviene para AWS/enterprise con pools, MFA y administracion corporativa.
Requiere adapter JWT/JWKS, grupos/claims y provisioning admin distinto.

### Keycloak

Conviene para SSO corporativo self-hosted/OIDC. Requiere mapear claims, roles y
refresh/cookies sin depender de metadata Supabase.

### JWT Propio

No recomendado salvo necesidad fuerte. Aumenta responsabilidad de seguridad,
rotacion, revocacion, MFA y recuperacion.

### Cookies Server-Side

Mejoraria seguridad y reduciria tokens en cliente, pero implica cambiar fetches,
API guards, realtime auth y estrategia offline. No hacerlo sin tarea dedicada.

### SSO Corporativo

Mantener perfil interno como fuente de permisos. El SSO debe entregar identidad;
roles/faena/approval deben sincronizarse a tablas internas.

## Que NO Conviene Cambiar Todavia

- No renombrar `access_token` globalmente.
- No migrar a cookies server-side.
- No cambiar `/api/profile/sync`.
- No reemplazar Supabase Admin.
- No cambiar realtime auth.
- No cambiar login/callback ni session listener.
- No cambiar permisos ni approval workflow.

## Roadmap De Migracion

1. Mantener Supabase como adapter activo.
2. Eliminar imports directos de tipos Supabase fuera de adapters/boundaries.
3. Definir `ServerAuthProviderAdapter` cuando exista un provider candidato.
4. Agregar contract tests de auth client/server antes de cualquier migracion.
5. Introducir modo dual solo en ambiente de prueba.
6. Migrar perfil interno por `user_id` estable o tabla de identity links.
7. Migrar realtime/token strategy al final, despues de session validation.

## Riesgos

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Cambiar token semantics | Rompe fetches, sync, reports y realtime | Mantener `access_token` hasta migracion integral. |
| Perder metadata nombre/email | Perfiles incompletos | Normalizar a `AuthenticatedUser.metadata`. |
| Admin APIs no equivalentes | Crear usuarios deja de funcionar | Abstraer provisioning con adapter server. |
| Realtime acoplado | Migracion auth no basta | Tratar realtime como provider separado. |
| Sesiones existentes | Logout forzado o estados inconsistentes | No tocar storage/session runtime actual. |
| Permisos en provider externo | Roles divergentes | Perfil interno sigue siendo fuente de autorizacion. |

## Recomendacion

No reemplazar Supabase Auth ahora. La mejor decision es mantenerlo como provider
activo, pero continuar reduciendo imports directos y proteger el perfil interno
como fuente de permisos. Una migracion real debe empezar por contract tests y un
adapter server, no por cambios de UI o endpoints.
