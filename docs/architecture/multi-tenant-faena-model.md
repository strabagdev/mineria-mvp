# Modelo Multi-Tenant / Multi-Faena

Ultima actualizacion: 2026-05-23

Este documento disena el modelo futuro para soportar multiples organizaciones, faenas/sitios y permisos por alcance operacional. No define una migracion inmediata ni modifica el schema actual. Su objetivo es fijar decisiones tecnicas antes de agregar modulos grandes sobre datos que hoy no tienen aislamiento formal.

## Diagnostico Actual

La plataforma ya tiene boundaries internos, repositories, services, auth guards, offline cache, mutation queue y realtime encapsulado parcialmente. Sin embargo, el modelo de datos sigue siendo single-tenant desde el punto de vista operacional.

Estado actual observado:

| Area | Estado actual | Riesgo multi-faena |
| --- | --- | --- |
| `profiles` | Perfil global por `user_id`, con `role`, `active` y `approval_status`. | Un usuario tiene rol global, no por organizacion/faena. |
| `planning_items` | Datos operacionales por fecha, turno, nivel y frente. | No existe `organization_id` ni `site_id`; todos los datos comparten espacio global. |
| `activity_execution_segments` | Ejecucion real asociada a actividad/grupo. | No hereda scope formal; reportes podrian mezclar faenas. |
| Catalogo planning | Catalogo global de tipos, detalles y niveles. | No distingue catalogo base, catalogo por organizacion ni overrides de faena. |
| Reports/dashboard | Agrega sobre planning y ejecucion por rango de fechas. | Sin filtro obligatorio por scope operacional. |
| Audit logs | Registra actor, accion, entidad y datos. | No tiene tenant/faena; dificil auditar acciones por sitio. |
| Realtime | Canales por fecha y filtros por `item_date`. | Un evento de una faena podria invalidar pantallas de otra. |
| IndexedDB | Claves globales (`planningByDate`, `planning-catalog`, `reports-data-v1-*`). | Cache local podria mezclar usuarios, organizaciones o faenas. |
| Auth/access | Guards por usuario aprobado/admin global. | No expresa membresia ni permisos por alcance. |

Conclusion: el desacople de proveedor ya avanzo, pero el aislamiento de datos aun no existe. Antes de implementar multi-faena real, todos los datos operacionales deben recibir un scope explicito y todas las lecturas/escrituras deben filtrar por ese scope desde repositories y guards.

## Objetivos del Modelo

- Aislar datos por organizacion y faena/sitio.
- Permitir usuarios con acceso a una o varias faenas.
- Mantener un modelo simple para operacion industrial, sin RBAC enterprise innecesario.
- Soportar catalogos compartidos y personalizacion gradual.
- Preparar RLS futura sin depender solo de la UI o de service role.
- Preparar IndexedDB, realtime y reportes para operar con scope.
- Permitir migracion incremental sin cortar la operacion actual.

## Entidades Recomendadas

### `organizations`

Representa una empresa, mandante, contratista principal o unidad juridica dueña de datos.

Campos recomendados:

| Campo | Tipo sugerido | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK estable. |
| `slug` | `text unique` | Identificador legible para URLs futuras. |
| `name` | `text` | Nombre visible. |
| `status` | `text` | `active`, `disabled`. |
| `created_at` | `timestamptz` | Auditoria basica. |
| `updated_at` | `timestamptz` | Auditoria basica. |

### `sites`

Representa una faena, mina, planta, proyecto o sitio operacional dentro de una organizacion.

Campos recomendados:

| Campo | Tipo sugerido | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK estable. |
| `organization_id` | `uuid` | FK a `organizations`. |
| `slug` | `text` | Unico por organizacion. |
| `name` | `text` | Nombre de faena. |
| `timezone` | `text` | Importante para turnos, fechas y reportes. |
| `status` | `text` | `active`, `disabled`, `archived`. |
| `created_at` | `timestamptz` | Auditoria basica. |
| `updated_at` | `timestamptz` | Auditoria basica. |

Indice recomendado futuro:

```sql
unique (organization_id, slug)
```

### `memberships`

Relaciona usuarios con organizaciones. Define acceso base y administracion organizacional.

Campos recomendados:

| Campo | Tipo sugerido | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `organization_id` | `uuid` | FK a `organizations`. |
| `user_id` | `uuid` | FK logica a auth user / `profiles.user_id`. |
| `role` | `text` | `owner`, `org_admin`, `member`, `viewer`. |
| `status` | `text` | `pending`, `approved`, `suspended`, `rejected`. |
| `created_at` | `timestamptz` | Auditoria basica. |
| `updated_at` | `timestamptz` | Auditoria basica. |

Uso recomendado:

- `owner` y `org_admin` administran usuarios y configuracion de la organizacion.
- `member` puede operar segun permisos de faena.
- `viewer` puede leer segun permisos de faena.

### `site_memberships`

Relaciona usuarios con faenas especificas. Es la entidad clave para permisos operacionales.

Campos recomendados:

| Campo | Tipo sugerido | Notas |
| --- | --- | --- |
| `id` | `uuid` | PK. |
| `site_id` | `uuid` | FK a `sites`. |
| `user_id` | `uuid` | FK logica a auth user / `profiles.user_id`. |
| `role` | `text` | `site_admin`, `planner`, `operator`, `viewer`. |
| `status` | `text` | `approved`, `suspended`. |
| `created_at` | `timestamptz` | Auditoria basica. |
| `updated_at` | `timestamptz` | Auditoria basica. |

Uso recomendado:

- `site_admin`: administra catalogo local y usuarios del sitio.
- `planner`: crea/edita planificacion.
- `operator`: registra ejecucion real si el producto lo requiere.
- `viewer`: lectura operacional/reportes.

### Roles y permisos

Recomendacion inicial: roles enumerados por alcance, no tabla granular de permisos en la primera fase.

Motivo:

- La plataforma necesita robustez operacional, pero aun no muestra complejidad suficiente para un permission matrix completo.
- Roles por organizacion y faena cubren administracion, planning, operacion y lectura.
- Una tabla `permissions` puede agregarse despues si aparecen permisos finos por modulo, equipo, area o contratista.

Modelo recomendado:

| Alcance | Roles iniciales | Uso |
| --- | --- | --- |
| Organizacion | `owner`, `org_admin`, `member`, `viewer` | Gestion global de organizacion, usuarios y configuracion base. |
| Faena/sitio | `site_admin`, `planner`, `operator`, `viewer` | Acceso operacional a planning, reportes, catalogos y ejecucion. |
| Plataforma | `platform_admin` opcional | Soporte interno; no debe vivir como rol normal de negocio en `profiles.role`. |

## Diagrama Textual de Relaciones

```txt
auth.users
  1 ── 1 profiles
  1 ── * memberships
  1 ── * site_memberships

organizations
  1 ── * sites
  1 ── * memberships
  1 ── * planning_catalog_types
  1 ── * audit_logs

sites
  1 ── * site_memberships
  1 ── * planning_items
  1 ── * activity_execution_segments
  1 ── * operational_header_fields / options
  1 ── * reports scope
  1 ── * realtime channels scope

planning_items
  1 ── * activity_execution_segments

planning_catalog_types
  1 ── * planning_catalog_details
```

Relacion minima recomendada para datos operacionales:

```txt
planning_items.organization_id -> organizations.id
planning_items.site_id -> sites.id
activity_execution_segments.organization_id -> organizations.id
activity_execution_segments.site_id -> sites.id
activity_execution_segments.planning_item_id -> planning_items.id
audit_logs.organization_id -> organizations.id
audit_logs.site_id -> sites.id nullable
```

## Scope Recomendado para Datos Existentes

| Tabla/dato | Scope futuro recomendado | Razon |
| --- | --- | --- |
| `profiles` | Global por usuario + perfil base. | Identidad no pertenece a una sola faena. |
| `memberships` | Organizacion. | Define pertenencia y rol administrativo. |
| `site_memberships` | Faena/sitio. | Define permisos operacionales reales. |
| `planning_items` | `organization_id` + `site_id`. | Dato operacional debe aislarse por faena. |
| `activity_execution_segments` | `organization_id` + `site_id`. | Debe compartir scope con planning y reportes. |
| `planning_catalog_types` | Global base + organizacion/sitio opcional. | Permite catalogo comun y personalizacion gradual. |
| `planning_catalog_details` | Hereda scope del tipo. | Evita detalles mezclados entre catalogos. |
| Cabecera Operacional | Sitio o catalogo base con overrides. | Nivel, Frente y otros ejes suelen ser especificos de faena. |
| `reports` | Query obligatoria por `organization_id` y `site_id`. | Evita reportes cruzados accidentales. |
| `audit_logs` | `organization_id` obligatorio cuando aplique, `site_id` nullable. | Auditoria debe filtrarse por alcance. |
| Offline cache | `user_id` + `organization_id` + `site_id` + version. | Evita mezcla local entre faenas/sesiones. |
| Realtime channels | `organization_id` + `site_id` + fecha. | Evita invalidaciones y eventos cruzados. |

## Alternativas para Catalogos

### Alternativa A: Catalogo global unico

Todos los tenants/faenas comparten `planning_catalog_types`,
`planning_catalog_details` y Cabecera Operacional.

Ventajas:

- Simple.
- Menos migracion.
- Facil de mantener para una operacion homogenea.

Desventajas:

- No refleja diferencias reales entre faenas.
- Cambios de catalogo pueden impactar a todos.
- Dificulta permisos de administracion por faena.

Veredicto: util solo como estado transitorio.

### Alternativa B: Catalogo por organizacion

Cada organizacion tiene su propio catalogo; todas sus faenas lo comparten.

Ventajas:

- Buen balance inicial.
- Permite personalizacion por cliente/empresa.
- Menos duplicacion que por faena.

Desventajas:

- Si una faena tiene cabeceras operacionales propias, se requieren excepciones.
- Los ejes operacionales mineros suelen ser mas locales que organizacionales.

Veredicto: buena base para tipos/detalles generales.

### Alternativa C: Catalogo por faena

Cada faena define tipos, detalles y Cabecera Operacional propios.

Ventajas:

- Aislamiento operacional claro.
- Permite administracion local.
- Evita interferencias entre sitios.

Desventajas:

- Duplicacion.
- Mas carga administrativa.
- Puede fragmentar reportabilidad corporativa.

Veredicto: recomendable para Cabecera Operacional y, si hay diferencias reales,
para overrides de tipos/detalles.

### Alternativa D: Catalogo global base + overrides por organizacion/faena

Existe un catalogo base de plataforma y cada organizacion/faena puede agregar, ocultar o renombrar elementos.

Ventajas:

- Escalable.
- Mantiene consistencia corporativa y flexibilidad operacional.
- Permite defaults para nuevas faenas.

Desventajas:

- Es mas complejo de consultar y auditar.
- Requiere modelo de precedencia.

Veredicto: modelo objetivo recomendado, implementable despues de una fase simple.

## Modelo Recomendado

Recomendacion: implementar en fases un modelo jerarquico simple:

```txt
organization -> sites -> operational data
```

Con estas decisiones:

- `profiles` sigue siendo perfil global de identidad/aprobacion base.
- `memberships` define acceso a organizacion.
- `site_memberships` define permisos de operacion por faena.
- `planning_items` y `activity_execution_segments` deben tener `organization_id` y `site_id` obligatorios.
- `reports` deben requerir scope explicito en backend, no solo en UI.
- `audit_logs` deben registrar `organization_id`, `site_id` cuando aplique, y actor.
- Catalogo:
  - Fase inicial: catalogo por organizacion para tipos/detalles; Cabecera Operacional por faena si hay diferencias reales.
  - Fase objetivo: catalogo base + overrides por organizacion/faena si aparecen diferencias recurrentes.
- Realtime:
  - Canales y filtros por `site_id` + fecha.
  - Realtime sigue siendo invalidacion, no fuente de verdad.
- Offline:
  - Cache keys con `user_id`, `organization_id`, `site_id`, `schema_version`.
  - Mutation queue con scope embebido en cada mutacion.

Esta decision evita sobreingenieria de permisos granulares al inicio, pero deja una ruta clara hacia RBAC mas fino si la operacion lo exige.

## Cambios Futuros por Capa

### Schema

Tablas nuevas futuras:

- `organizations`
- `sites`
- `memberships`
- `site_memberships`

Columnas futuras:

| Tabla | Columnas |
| --- | --- |
| `planning_items` | `organization_id uuid not null`, `site_id uuid not null` |
| `activity_execution_segments` | `organization_id uuid not null`, `site_id uuid not null` |
| `planning_catalog_types` | `organization_id uuid null`, `site_id uuid null`, `scope text` si se adopta overrides |
| `planning_catalog_details` | scope heredado por FK al tipo |
| Cabecera Operacional | `organization_id uuid null`, `site_id uuid null` si se adopta scope multi-faena |
| `audit_logs` | `organization_id uuid null`, `site_id uuid null` |

Indices futuros:

```sql
planning_items(site_id, item_date, shift)
planning_items(site_id, activity_group_id, tracking_type)
activity_execution_segments(site_id, item_date, shift)
activity_execution_segments(site_id, activity_group_id, segment_order)
audit_logs(organization_id, site_id, created_at desc)
memberships(organization_id, user_id)
site_memberships(site_id, user_id)
```

Unicidad futura a revisar:

- `planning_items_group_tracking_uidx` hoy es global por `activity_group_id`, `tracking_type`.
- Debe pasar a considerar `site_id` si los `activity_group_id` no son globalmente unicos.
- `planning_items_client_mutation_id_uidx` hoy es global; para offline multi-faena puede mantenerse global si el cliente genera UUID robusto, o cambiar a `(site_id, client_mutation_id)` si se desea scope local.
- `activity_execution_segments_group_order_uidx` debe incluir `site_id` si `activity_group_id` queda scoped por faena.

### Repositories

Regla futura:

- Todo repository operacional debe recibir `scope` explicito:

```ts
type OperationalScope = {
  organizationId: string;
  siteId: string;
};
```

Ejemplo objetivo:

```ts
listPlannedItemsByDate(scope, date)
createPlanningItem(scope, input)
listReportSourceRows(scope, filters)
listPlanningCatalog(scope)
```

Los repositories no deben inferir scope desde estado global ni desde la UI.

### Services

Los services deben:

- Validar permisos por accion y scope.
- Aplicar reglas de negocio dentro del scope.
- Pasar `scope` a repositories.
- Registrar audit logs con `organization_id` y `site_id`.

Ejemplo:

```txt
API route
  -> requireSitePermission(user, siteId, "planning.write")
  -> planning service
  -> planning repository con scope
```

### API Routes

Regla futura:

- Toda API operacional debe recibir o resolver `site_id` de manera explicita.
- No debe existir lectura sensible sin scope.
- Los status codes y response shapes pueden mantenerse, pero los filtros deben incluir scope en backend.

Rutas afectadas:

| Ruta | Cambio futuro |
| --- | --- |
| `/api/planning-items` | Requerir `site_id` y filtrar por scope. |
| `/api/planning-catalog` | Resolver catalogo por organizacion/faena. |
| `/api/reports` | Requerir `site_id` o scope autorizado multiple con decision explicita. |
| `/api/users` | Administrar usuarios por organizacion/faena, no global solamente. |
| `/api/profile/sync` | Retornar memberships y sitios autorizados. |

### Auth / Access

El perfil global actual no basta para multi-faena.

Modelo futuro:

```txt
AppSession
  user
  profile
  organizations[]
  activeOrganizationId
  sites[]
  activeSiteId
  permissions for active scope
```

Guards futuros:

- `requireAuthenticatedUser`
- `requireApprovedUser`
- `requireOrganizationMembership`
- `requireSiteMembership`
- `requireSiteRole`
- `requireSitePermission`

El rol `admin` global actual debe migrar gradualmente a:

- `platform_admin` para soporte interno, si se necesita.
- `org_admin` para administracion de organizacion.
- `site_admin` para administracion de faena.

### RLS Futura

RLS deberia expresar el mismo modelo que los guards server.

Politicas futuras conceptuales:

```sql
exists (
  select 1
  from site_memberships sm
  join sites s on s.id = sm.site_id
  where sm.user_id = auth.uid()
    and sm.site_id = planning_items.site_id
    and sm.status = 'approved'
    and s.organization_id = planning_items.organization_id
)
```

Consideracion importante:

- Si API routes siguen usando service role, los guards server son obligatorios porque service role bypass puede saltarse RLS.
- El objetivo ideal es que cualquier bypass este concentrado y auditado, no disperso.

### Offline / IndexedDB

Las claves actuales son globales. Para multi-faena deben namespacerse.

Formato recomendado:

```txt
v2:{user_id}:{organization_id}:{site_id}:planning:{date}
v2:{user_id}:{organization_id}:{site_id}:planning-catalog
v2:{user_id}:{organization_id}:{site_id}:planning-mutation-queue
v2:{user_id}:{organization_id}:{site_id}:reports:{query_hash}
v2:{user_id}:profile
```

Cada mutacion offline debe incluir:

```ts
{
  scope: {
    organizationId: string;
    siteId: string;
  },
  client_mutation_id: string,
  method: "POST" | "PATCH" | "DELETE",
  payload: unknown
}
```

Reglas:

- No mezclar colas entre faenas.
- No replay de mutaciones si el usuario ya no tiene permiso sobre la faena.
- Mostrar pendientes por sitio activo.
- Preparar migracion desde claves v1 globales a v2 scoped.

### Realtime

Canal recomendado futuro:

```txt
planning:{organization_id}:{site_id}:{YYYY-MM-DD}
```

Filtros recomendados:

```txt
table=planning_items, filter=site_id=eq.{siteId}
table=activity_execution_segments, filter=site_id=eq.{siteId}
```

Para cambios por fecha:

- Mantener filtro por `item_date` cuando Supabase Realtime permita componer el filtro requerido.
- Si no se puede filtrar por `site_id` y `item_date` simultaneamente de forma suficiente, usar canal por sitio y filtrar fecha en callback antes de invalidar.

Contrato:

- Realtime solo invalida.
- Fetch posterior siempre aplica scope.
- No confiar en payload realtime para autorizacion.

### Reports

Reportes deben tener scope obligatorio:

| Caso | Recomendacion |
| --- | --- |
| Reporte de faena | `site_id` requerido. |
| Reporte organizacional agregado | Solo roles `org_admin`/`owner`; debe ser endpoint o parametro explicito. |
| Dashboard usuario operativo | Sitio activo por defecto. |
| Export CSV/Excel | Incluir metadatos de organizacion/faena en cabecera futura. |

Evitar que `/api/reports` retorne datos de multiples faenas por omision.

### Audit

Audit debe registrar:

- `organization_id`
- `site_id` cuando aplique
- `actor_user_id`
- `actor_role` o snapshot de scope opcional
- `entity_type`
- `entity_id`
- `metadata.scope`

Esto permite investigar incidentes operacionales por faena y no solo por usuario.

## Fases de Implementacion Futura

### Fase 0: Decisiones y compatibilidad

- Definir tenant/faena inicial para datos existentes.
- Definir nombres finales: `site`, `faena`, `operation_site` o `mine_site`.
- Decidir si el usuario puede cambiar faena activa desde UI.
- Definir roles iniciales exactos.
- Definir si catalogo inicial sera por organizacion o faena.

Resultado esperado:

- Documento de decision aprobado.
- Sin cambios de DB todavia.

### Fase 1: Tablas base y backfill controlado

- Crear `organizations`, `sites`, `memberships`, `site_memberships`.
- Insertar organizacion/faena default para datos existentes.
- Crear membresias para usuarios aprobados actuales.
- Mantener `profiles.role` temporalmente para compatibilidad.

Resultado esperado:

- La plataforma sigue funcionando como single-site, pero con scope existente.

### Fase 2: Columnas de scope en datos operacionales

- Agregar `organization_id` y `site_id` nullable inicialmente a:
  - `planning_items`
  - `activity_execution_segments`
  - `audit_logs`
  - catalogos segun decision.
- Backfill con faena default.
- Crear indices compuestos.
- Validar conteos y reportes.
- Luego volver columnas `not null` en tablas operacionales.

Resultado esperado:

- Datos historicos quedan asignados a una faena.

### Fase 3: Repositories y services scoped

- Introducir tipo `OperationalScope`.
- Actualizar repositories para filtrar por `site_id`.
- Actualizar services para recibir scope y validar permisos.
- Mantener endpoints con response shape igual, agregando query/derivacion de scope.

Resultado esperado:

- La seguridad efectiva deja de depender de convenciones UI.

### Fase 4: Guards y session scope

- Extender `/api/profile/sync` para retornar organizaciones/faenas autorizadas.
- Crear guards `requireSiteMembership` y `requireSitePermission`.
- Migrar admin global a roles por organizacion/faena.
- Definir seleccion de faena activa en cliente.

Resultado esperado:

- El backend puede rechazar acciones fuera de scope.

### Fase 5: Offline scoped

- Versionar IndexedDB/local cache a v2.
- Namespacing por usuario/organizacion/faena.
- Incluir scope en mutation queue.
- Bloquear replay si scope ya no esta autorizado.
- Migrar o descartar caches v1 con mensaje operacional claro.

Resultado esperado:

- Operacion offline parcial no mezcla faenas.

### Fase 6: Realtime scoped

- Cambiar canales a scope por sitio.
- Filtrar invalidaciones por sitio y fecha.
- Confirmar RLS/realtime publication segun modelo final.

Resultado esperado:

- Eventos realtime de una faena no invalidan otra.

### Fase 7: RLS multi-tenant y hardening

- Agregar politicas por `site_memberships`.
- Revisar todo uso de service role.
- Auditar endpoints admin.
- Agregar tests de permisos por scope.

Resultado esperado:

- Aislamiento reforzado en DB y backend.

### Fase 8: Catalogo avanzado

- Si es necesario, migrar a catalogo base + overrides.
- Definir precedencia:

```txt
site override > organization override > global base
```

- Agregar flags `active`, `hidden`, `display_order` si la operacion los requiere.

Resultado esperado:

- Consistencia corporativa con flexibilidad operacional.

## Riesgos Identificados

### Datos existentes sin tenant

Riesgo: backfill incorrecto puede asignar datos historicos a una faena equivocada.

Mitigacion:

- Crear faena default explicita.
- Validar conteos antes/despues.
- Mantener logs de migracion.
- No borrar ni reescribir historicos sin respaldo.

### Mezcla de cache local

Riesgo: IndexedDB actual puede mostrar datos de otra faena o usuario tras cambio de scope.

Mitigacion:

- Namespacing v2.
- Purga por sign out.
- Incluir `scope` en snapshots y mutation queue.

### Reports cruzando faenas

Riesgo: agregaciones sin `site_id` pueden exponer datos sensibles.

Mitigacion:

- `site_id` obligatorio por defecto.
- Endpoint agregado organizacional separado o permiso explicito.
- Tests de autorizacion.

### Permisos globales insuficientes

Riesgo: `profiles.role = admin` no expresa administracion de faena ni organizacion.

Mitigacion:

- Migrar a `memberships` y `site_memberships`.
- Mantener rol global solo como compatibilidad temporal.

### Service role bypass

Riesgo: RLS futura no protege rutas que usan service role sin guards de scope.

Mitigacion:

- Centralizar DB access en repositories.
- Requerir scope y guard en services/API routes.
- Documentar excepciones.

### Realtime sin scope

Riesgo: eventos de una faena invalidan o revelan actividad de otra.

Mitigacion:

- Canales por sitio.
- Fetch scoped posterior.
- No usar payload realtime como verdad autorizada.

### Unicidades globales actuales

Riesgo: indices globales como `activity_group_id` o catalogo unico pueden bloquear datos validos en otra faena.

Mitigacion:

- Revisar constraints y unique indexes antes de hacer `site_id not null`.
- Incluir `site_id` en unicidades operacionales.

## Decisiones Sugeridas

1. Usar `organizations` y `sites` como nombres tecnicos, con copy UI "faena" cuando corresponda.
2. Mantener `profiles` como identidad base, no como fuente de permisos por faena.
3. Introducir `memberships` y `site_memberships` antes de agregar modulos grandes.
4. Hacer `site_id` obligatorio en datos operacionales.
5. Mantener catalogo simple al inicio: tipos/detalles por organizacion, niveles por faena.
6. Postergar permission matrix granular hasta que roles por scope no alcancen.
7. Tratar reportes multi-faena como capacidad privilegiada y explicita.
8. Versionar IndexedDB antes de habilitar multiples faenas reales.
9. Mantener Supabase como proveedor actual, pero no filtrar datos sensibles solo con convenciones UI.

## Preguntas Abiertas

- Cual sera la entidad comercial primaria: organizacion cliente, empresa contratista, mandante o unidad interna?
- Un usuario puede pertenecer a varias organizaciones o solo a varias faenas dentro de una organizacion?
- La UI debe permitir cambio manual de faena activa o la faena se determina por rol/URL?
- Los niveles (`NTI`, `NNM`, `SNV`) son globales, por organizacion o siempre por faena?
- Los frentes deben modelarse como catalogo formal por faena en el corto plazo?
- Deben existir reportes corporativos multi-faena desde el inicio o solo despues de tener permisos maduros?
- El modo offline debe permitir cambiar de faena sin conexion?
- Que datos deben purgarse localmente al cerrar sesion o cambiar de faena?
- Se requiere soporte para contratistas con acceso limitado a subset de frentes/niveles?
- Se requiere auditoria inmutable fuerte para cumplimiento operacional?

## Definition of Ready para Implementar Multi-Faena

Antes de tocar schema o RLS:

- Decision aprobada de modelo `organization` / `site`.
- Faena default definida para backfill.
- Roles por organizacion/faena definidos.
- Estrategia de catalogo inicial definida.
- Plan de migracion y rollback documentado.
- Tests de permisos por scope planificados.
- Politica offline scoped definida.
- Realtime scoped disenado.
- Reportes multi-faena explicitamente permitidos o bloqueados.

## Resumen Ejecutivo

La plataforma esta preparada arquitectonicamente para avanzar hacia multi-faena porque ya existen services, repositories, guards, DTOs, offline contracts y adapters. Pero aun no esta aislada a nivel de datos. El siguiente paso correcto no es implementar permisos finos de inmediato, sino introducir un scope operacional claro:

```txt
organization_id + site_id
```

Ese scope debe atravesar DB, repositories, services, API routes, auth session, IndexedDB, realtime y reportes. La estrategia recomendada es incremental: crear entidades base, backfill a una faena default, hacer repositories scoped, despues guards/RLS/offline/realtime scoped. Asi se mantiene compatibilidad operacional mientras se prepara la plataforma para crecer sin fragilidad.
