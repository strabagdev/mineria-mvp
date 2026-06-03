# Arquitectura interna oficial

Ultima actualizacion: 2026-05-22

## 1. Proposito

Este documento define la organizacion interna que debe seguir la plataforma para evolucionar como sistema industrial mantenible. Es una guia normativa para nuevas funcionalidades, cambios de dominio y refactors incrementales.

La plataforma ya tiene una direccion arquitectonica valida:

- Next.js App Router para UI y API routes.
- Capas `src/server/services` y `src/server/repositories`.
- Fronteras iniciales en `src/server/auth`, `src/server/db` y `src/server/realtime`.
- Infraestructura offline con IndexedDB, Service Worker y monitoreo de conectividad.

El objetivo no es rehacer la aplicacion. El objetivo es consolidar esos limites y evitar que nuevos modulos mezclen presentacion, acceso a proveedores, reglas operacionales y sincronizacion en el mismo archivo.

## 2. Regla de dependencia

El flujo normal de dependencias es:

```text
UI / presentation
  -> application hooks / use cases
    -> API routes
      -> services / domain logic
        -> repositories
          -> provider adapters
            -> infrastructure
```

Las dependencias deben apuntar hacia adentro del dominio de la aplicacion y hacia abajo en el flujo anterior. Un nivel superior puede llamar al nivel inmediato inferior o a contratos estables expuestos por el modulo. Un nivel inferior no debe depender de componentes UI.

## 3. Capas permitidas

### 3.1 UI / presentation

Ubicaciones actuales:

- `src/app/**/page.tsx`
- `src/app/**/layout.tsx`
- `src/components/**`

Responsabilidades permitidas:

- Componer vistas, layouts, estados visuales y accesibilidad.
- Recibir data ya preparada para render.
- Manejar interacciones de formulario y navegacion.
- Delegar fetch, mutaciones, sincronizacion y reglas operacionales a hooks o use cases cuando el flujo no sea trivial.

`page.tsx` puede vivir con:

- seleccion de componentes de pantalla;
- estado estrictamente visual;
- wiring entre hooks de aplicacion y componentes;
- parametros de ruta y presentacion de loading/error;
- orquestacion pequena mientras no replique dominio ni infraestructura.

`page.tsx` no debe vivir con:

- reglas autoritativas de negocio;
- queries directas a proveedores de datos;
- clientes Supabase u otros SDK de persistencia;
- colas offline implementadas ad hoc;
- transformaciones complejas reutilizables de dominio;
- construccion de contratos API repetidos en multiples pantallas;
- suscripciones realtime especificas cuando puedan encapsularse en un hook/adaptador.

### 3.2 Application hooks / use cases

Ubicacion recomendada para nuevos modulos:

```text
src/modules/<module>/application/
  use-<feature>.ts
  <feature>.use-case.ts
  <feature>.client.ts
```

Mientras la estructura actual se consolida, se permiten hooks cerca de su modulo si mantienen el limite y no mezclan UI con infraestructura.

Responsabilidades:

- Orquestar necesidades de una vista o caso de uso cliente.
- Centralizar fetches hacia API routes.
- Coordinar cache local, pending states y refresh cuando aplique.
- Exponer comandos y queries consumibles por UI.
- Convertir errores tecnicos en estados de aplicacion que la UI pueda mostrar.

No deben:

- implementar reglas autoritativas que solo existen en frontend;
- consultar tablas/provider SDK directamente;
- convertirse en duplicado de los services server-side.

### 3.3 API routes

Ubicacion:

- `src/app/api/**/route.ts`

Responsabilidades:

- Ser el borde HTTP de la plataforma.
- Aplicar auth guards y scope requerido antes de lecturas o escrituras sensibles.
- Parsear request y devolver response shape estable.
- Ejecutar validacion de contrato de entrada cuando corresponda.
- Delegar workflows y reglas a services.

No deben:

- contener reglas operacionales extensas;
- consultar Supabase directamente salvo excepcion documentada y temporal;
- mezclar presentacion UI;
- cambiar response shapes sin tratarlo como cambio de contrato.

Excepcion temporal permitida:

- una route existente puede seguir usando un provider directo mientras se migra el limite, pero debe quedar identificada en revision tecnica y no debe ser el patron para codigo nuevo.

### 3.4 Services / domain logic

Ubicacion:

- `src/server/services/**`
- ubicacion modular futura: `src/modules/<module>/server/services/**`

Responsabilidades:

- Reglas y workflows de dominio.
- Orquestacion server-side entre repositories, auditoria y policies.
- Idempotencia, invariantes operacionales y decisiones de negocio.
- Modelar resultados de negocio, no detalles HTTP.

Un service puede:

- pedir datos a repositories;
- escribir audit logs;
- componer operaciones de dominio;
- mapear rows de persistencia a resultados de aplicacion.

Auditoría actual:

- Los services llaman `writeAuditLog` para mutaciones de negocio.
- `audit_logs` guarda `action`, `entity_type`, `entity_id`, `before_data`,
  `after_data` y `metadata`.
- La lectura admin se expone por `GET /api/audit-events` y se presenta en
  `/admin/audit` y en el timeline del programado.
- Ver `docs/architecture/audit.md`.

Un service no debe:

- depender de React ni componentes;
- devolver `NextResponse` como contrato principal;
- depender de detalles de pagina;
- consultar SDK de proveedor si existe repository/adaptador apropiado.

### 3.5 Repositories

Ubicacion:

- `src/server/repositories/**`
- ubicacion modular futura: `src/modules/<module>/server/repositories/**`

Responsabilidades:

- Lecturas y escrituras de persistencia.
- Queries, joins, filtros y mapeo cercano al storage.
- Encapsular el provider activo de DB.

Un repository puede conocer:

- nombres de tablas;
- SQL o query APIs;
- detalles de indices o columnas;
- provider activo como Supabase mientras sea el adaptador vigente.

Un repository no debe:

- decidir permisos de UI;
- renderizar errores HTTP;
- contener workflows amplios entre dominios;
- ser llamado directamente desde componentes UI.

### 3.6 Provider adapters

Ubicaciones actuales:

- `src/server/auth/**`
- `src/server/db/**`
- `src/server/realtime/**`
- `src/lib/authClient.ts` mientras la frontera cliente de auth se consolida
- `src/lib/supabaseServer.ts` como wiring actual del provider server-side

Responsabilidades:

- Encapsular SDKs y protocolos de proveedores.
- Reducir dependencia directa de Supabase u otro proveedor desde capas superiores.
- Exponer operaciones de infraestructura con semantica de la plataforma.

Adapters esperados a futuro:

- DB provider adapter.
- Auth provider adapter.
- Realtime adapter.
- Sync transport adapter.
- Integraciones externas.

### 3.7 Infrastructure

Ubicaciones actuales:

- `supabase/sql/**`
- `public/sw.js`
- `src/components/pwa-register.tsx`
- variables de entorno y wiring de provider
- infraestructura de cache local en `src/lib/localOfflineStore.ts`

Responsabilidades:

- Esquemas, migraciones, RLS y constraints.
- Service Worker y cache shell.
- Persistencia local y mecanica de conectividad.
- Configuracion operacional de proveedores.

Infraestructura no debe convertirse en dominio. Por ejemplo, IndexedDB y Realtime son medios de continuidad y propagacion; las reglas sobre que mutacion es valida siguen perteneciendo al dominio y backend.

## 4. Responsabilidad de carpetas actuales

| Ruta | Responsabilidad oficial |
|------|-------------------------|
| `src/app` | Rutas UI, layouts y bordes HTTP App Router. |
| `src/components` | Componentes visuales reutilizables o componentes de presentacion de dominio. |
| `src/providers` | Providers React transversales como sesion. |
| `src/lib` | Utilidades transversales, helpers compartidos y fronteras cliente existentes. No es un cajon para logica de dominio nueva. |
| `src/server/services` | Workflows y reglas server-side. |
| `src/server/repositories` | Persistencia y queries. |
| `src/server/auth` | Validacion de sesion, administracion de identidad y frontera del proveedor auth. |
| `src/server/db` | Frontera de cliente/adapter de base de datos. |
| `src/server/realtime` | Contratos y adapters realtime. |
| `supabase/sql` | Esquema actual, seguridad, constraints, seed y realtime del provider vigente. |

## 5. Flujo oficial de datos

### 5.1 Lectura

```text
Page/component
  -> hook/query application
    -> GET /api/<module>
      -> auth guard + input parsing
        -> service
          -> repository
            -> DB/provider
```

Reglas:

- Toda lectura sensible debe tener guard explicito en backend.
- La UI no debe depender de que un endpoint sea seguro solo porque lo llama una pantalla autenticada.
- Si la lectura usa snapshot offline, el hook/use case decide fallback; el endpoint remoto sigue protegido.

### 5.2 Escritura

```text
Form/component
  -> command/use case
    -> POST/PATCH/DELETE /api/<module>
      -> auth guard + payload validation
        -> service/domain rules
          -> repository transaction/write
            -> audit/realtime invalidation where applicable
```

Reglas:

- Frontend puede validar UX, pero backend y DB son la autoridad.
- Idempotencia y conflictos no deben depender solo de estado React.
- Response shape debe ser estable y versionable cuando exponga contratos consumidos por mas de una vista.

## 6. Reglas para nuevas funcionalidades

### 6.1 Estructura de archivos recomendada

Para un modulo nuevo `equipment-events`:

```text
src/app/(app)/equipment-events/page.tsx
src/app/api/equipment-events/route.ts
src/components/equipment-events/
  equipment-event-list.tsx
  equipment-event-form.tsx
src/modules/equipment-events/application/
  use-equipment-events.ts
  equipment-events.client.ts
src/server/services/equipment-events.service.ts
src/server/repositories/equipment-events.repository.ts
```

Mientras `src/modules` no sea adoptado para todo el repositorio, se puede mantener el patron actual de `src/server` y `src/components`, pero las responsabilidades anteriores siguen siendo obligatorias.

### 6.2 Naming

- API route: sustantivo de recurso, por ejemplo `planning-items`.
- Service: `<domain>.service.ts`.
- Repository: `<domain>.repository.ts`.
- Hook application: `use-<feature>.ts`.
- Cliente de API application: `<feature>.client.ts` si evita fetches dispersos.
- Componentes: nombres de presentacion claros; evitar `manager`, `helper` o `utils` genericos para dominio.

### 6.3 Dominio vs infraestructura

- Dominio nombra conceptos operacionales: turno, programacion, segmento real, conflicto.
- Infraestructura nombra mecanismos: Supabase, IndexedDB, fetch, WebSocket, Service Worker.
- Un service debe hablar primero en conceptos de dominio.
- Un adapter/repository traduce a mecanismos del proveedor.

### 6.4 Validaciones

- UI: validacion temprana para experiencia de usuario.
- API route: validacion de contrato, tipo y presencia de campos.
- Service/domain: reglas operacionales.
- DB: constraints criticas que protegen integridad concurrente.

No duplicar una regla compleja en UI y backend sin declarar cual version es autoritativa. La version server-side es la autoridad.

### 6.5 Auth guards y scopes

- Todo endpoint debe declarar su clasificacion: publico, autenticado, aprobado, admin o scope futuro tenant/faena.
- Reads operacionales, reportes, catalogos internos y usuarios deben tener guard explicito.
- Para nuevas entidades scoped, la autorizacion debe validar tenant/faena antes de consultar o mutar datos.
- No usar la presencia de una navegacion UI como control de seguridad.

### 6.6 Errores

- Route traduce errores a HTTP.
- Service devuelve resultados de negocio o errores tipados/semanticos.
- Repository propaga errores de persistencia con contexto minimo necesario.
- UI recibe estados accionables: no mezclar error de auth, conflicto, offline y error interno.

### 6.7 Offline y realtime

Antes de implementar un modulo, declarar:

| Pregunta | Decision requerida |
|----------|--------------------|
| Tiene offline read? | Snapshot, cache de entidad o no soportado. |
| Tiene offline write? | Outbox/mutation queue y policy de conflicto o no soportado. |
| Tiene realtime? | Invalidation/refetch, event merge o no soportado. |
| Cual es la fuente de verdad? | Backend remoto, dataset local temporal o workflow eventual. |

Reglas:

- No agregar logica offline ad hoc dentro de `page.tsx`.
- No crear una cola nueva por copia/pega sin contrato de sincronizacion.
- Realtime debe encapsularse en hooks/adapters cuando deje de ser wiring pequeno y local.
- Service Worker no reemplaza persistencia de negocio en IndexedDB.

## 7. Reglas de deuda tecnica

### Prohibiciones por defecto

- No crear paginas monoliticas con reglas, fetches, sync, realtime y UI en el mismo archivo.
- No acceder a Supabase directamente desde UI.
- No acceder a Supabase desde API routes salvo excepcion tecnica justificada y registrada.
- No duplicar reglas de dominio en frontend como unica implementacion.
- No crear fetches dispersos en varios componentes si pertenecen al mismo caso de uso.
- No agregar manejo offline por pagina sin una decision de contrato offline.
- No usar `src/lib` como destino automatico de cualquier logica nueva.

### Senales de que una pieza debe extraerse

Extraer antes de seguir agregando cuando:

- una pagina coordina mas de un workflow independiente;
- el mismo fetch o fallback offline aparece en mas de una vista;
- una regla se necesita en API y UI;
- una route acumula parsing, permisos, dominio, provider queries y response mapping;
- una dependencia de proveedor aparece fuera del borde de adapter/repository.

## 8. Ejemplos

### 8.1 Flujo correcto

Caso: listar eventos de equipo.

```text
equipment-events/page.tsx
  -> useEquipmentEvents()
    -> equipment-events.client.ts fetch GET /api/equipment-events
      -> route.ts requireApprovedUser(req)
        -> listEquipmentEvents()
          -> equipment-events.repository.ts
            -> active DB provider
```

Por que es correcto:

- la pantalla compone;
- el hook controla loading/error/cache;
- la route protege el borde HTTP;
- el service modela el caso de uso;
- el repository encapsula persistencia.

### 8.2 Flujo incorrecto

```text
equipment-events/page.tsx
  -> supabase.from("equipment_events").select(...)
  -> decide permisos en un if visual
  -> calcula reglas de conflicto
  -> guarda IndexedDB con una cola local propia
```

Por que es incorrecto:

- proveedor expuesto en UI;
- autorizacion no autoritativa;
- dominio duplicado y dificil de testear;
- offline inconsistente con el resto de la plataforma.

### 8.3 Route correcta vs route cargada

Route esperada:

```ts
export async function GET(req: Request) {
  await requireApprovedUser(req);
  const query = parseQuery(req);
  return NextResponse.json(await listDomainRecords(query));
}
```

Evitar:

```ts
export async function GET(req: Request) {
  const db = getProviderClient();
  // cientos de lineas de permisos, joins, reglas, conversiones y HTTP
}
```

## 9. Recomendaciones especificas para esta plataforma

### Planning

- Es el dominio operacional mas exigente y debe modularizarse primero.
- Reglas de turnos, segmentos reales, overlap e idempotencia deben quedar testeadas y fuera de paginas monoliticas.
- Offline queue y realtime planning deben migrar gradualmente a application hooks/services internos sin alterar comportamiento.

### Access y seguridad

- Todo endpoint read sensible debe usar guard backend explicito.
- Roles actuales se consolidan antes de ampliar a permisos scoped por tenant/faena.
- Audit log debe seguir escribiendose desde backend, no desde UI.

### Offline industrial

- IndexedDB es persistencia local de datos operacionales; Cache Storage es shell/assets.
- Cada modulo debe declarar soporte offline antes de agregar fallbacks.
- Snapshots deben prepararse para namespacing por usuario y scope operacional cuando exista multi-faena.

### Proveedores

- Supabase sigue siendo provider activo.
- Repositories, `server/auth`, `server/db` y `server/realtime` son la direccion de aislamiento.
- Codigo nuevo no debe aumentar el acoplamiento directo al provider fuera de esas fronteras.

## 10. Estado actual y transicion

La arquitectura actual ya contiene limites correctos, pero no todos los modulos estan igualmente consolidados.

Estado reconocido:

- `src/server/services` existe y contiene workflows de dominio.
- `src/server/repositories` existe y encapsula muchas queries.
- `src/server/auth` existe como frontera de identidad y sesion.
- `src/server/db` existe como frontera de provider DB actual.
- `src/server/realtime` ya declara la necesidad de contratos realtime.
- Algunas routes y paginas historicas siguen conteniendo mas responsabilidades de las deseables.

Regla de transicion:

- Codigo nuevo sigue esta guia.
- Refactors existentes se hacen incrementalmente y con pruebas.
- No se debe bloquear una correccion acotada porque el modulo entero aun no fue reorganizado, pero tampoco se debe empeorar el acoplamiento.

## 11. Definition of Done arquitectonica

Un modulo o funcionalidad nueva esta arquitectonicamente terminada cuando:

1. Su responsabilidad de dominio esta clara y tiene carpeta/archivos coherentes.
2. La UI no llama directamente al provider de DB/Auth/Realtime fuera de una frontera permitida.
3. Los fetches de la vista estan centralizados en hook/use case/client application cuando el flujo no es trivial.
4. Las API routes tienen auth guard y scope declarado para cada read/write sensible.
5. Validacion UX, validacion HTTP, reglas de dominio y constraints de persistencia no se confunden.
6. Services modelan workflows y repositories modelan persistencia.
7. Errores de offline, auth, conflicto y fallo interno se distinguen.
8. Se declaro la decision offline/realtime del modulo.
9. Hay pruebas proporcionales al riesgo del cambio.
10. La funcionalidad agrega documentacion o actualiza la existente si introduce una convencion nueva.

## 12. Checklist de revision para PRs

- [ ] La pagina es composicion y no un nuevo hotspot monolitico.
- [ ] No se agrego acceso directo a Supabase desde UI.
- [ ] No se agrego acceso directo a Supabase en route sin excepcion documentada.
- [ ] Reads sensibles tienen guard backend.
- [ ] Reglas operacionales viven en service/domain y tienen pruebas cuando son criticas.
- [ ] Persistencia nueva pasa por repository/adaptador.
- [ ] Offline/realtime fue decidido explicitamente.
- [ ] Response shapes y contratos API se mantienen o se versionan.
- [ ] El cambio deja el modulo mas facil de extender que antes.
