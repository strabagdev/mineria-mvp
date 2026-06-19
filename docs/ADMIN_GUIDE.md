# Guia de administracion OPSAHEAD Mining

Esta guia describe las funciones administrativas existentes en el codigo actual de OPSAHEAD Mining. No documenta procesos externos ni funcionalidades no implementadas.

## Roles y permisos

El sistema usa tres roles:

- Administrador: administra usuarios, catalogos operacionales, campos configurables y catalogos de asignaciones. Tambien puede operar sobre la planificacion.
- Operativo: puede trabajar en la operacion diaria, crear/editar registros operacionales y guardar informacion operacional permitida.
- Visualizador: puede consultar informacion, pero no editar datos operacionales ni administrativos.

Ademas del rol, cada usuario tiene un estado de aprobacion y un estado activo/inactivo. Para entrar a las vistas protegidas, el perfil debe estar aprobado y activo.

## Administracion de usuarios

La administracion de usuarios esta disponible para administradores en la vista de usuarios y permisos.

Acciones disponibles:

- Crear usuarios directamente en Supabase Auth con nombre, correo, contrasena inicial y rol.
- Aprobar solicitudes pendientes.
- Cambiar el rol de un usuario.
- Activar o desactivar un usuario.
- Actualizar la contrasena de un usuario.

Estados de aprobacion:

- Pendiente: el usuario solicito acceso o existe como perfil no aprobado.
- Aprobado: el usuario puede usar el sistema si tambien esta activo.
- Rechazado: el acceso queda bloqueado.

Estado activo:

- Activo: el usuario puede entrar si esta aprobado.
- Inactivo: el usuario queda bloqueado aunque tenga rol y aprobacion.

Las acciones administrativas de usuarios quedan registradas en auditoria.

## Catalogo operacional

El catalogo operacional alimenta los formularios de planificacion y ejecucion.

Se administra desde la seccion Catalogo operacional, restringida a administradores.

Elementos configurables:

- Tipos de actividad.
- Tipos de interferencia.
- Detalles asociados a cada tipo.
- Niveles.

Los tipos pertenecen a una categoria:

- Actividad.
- Interferencia.

Cada tipo puede tener detalles. Por ejemplo, un tipo de interferencia puede tener varios motivos o descripciones detalladas.

Los niveles son una lista administrable separada. En el codigo actual no hay un catalogo maestro administrable de frentes; el frente se maneja como dato operacional en los registros.

## Tipos de asignacion

Las asignaciones permiten asociar recursos o informacion estructurada a programados, reales e interferencias.

El catalogo de asignaciones tiene tres niveles:

- Assignment types: tipo de asignacion, por ejemplo Equipo, Cuadrilla o Departamento.
- Fields: campos dentro del tipo, por ejemplo Codigo, Familia, Turno o Cantidad.
- Options: opciones para campos tipo select o multi select.

Un assignment type permite configurar:

- Nombre.
- Slug.
- Descripcion.
- Icono.
- Maximo de instancias.
- Orden.
- Estado activo/inactivo.

Un field permite configurar:

- Nombre.
- Slug.
- Tipo de input.
- Orden.
- Requerido.
- Activo/inactivo.
- Sufijo.
- Configuracion avanzada en JSON.

Tipos de campo soportados:

- Text.
- Number.
- Date.
- Boolean.
- Select.
- Multi select.

Las options existen solo para campos select o multi select. Cada opcion tiene label visible, value interno, orden, estado activo/inactivo y metadata JSON.

## Metadata de opciones

Las opciones de assignment fields pueden guardar metadata en formato JSON.

Ejemplo:

```json
{
  "familia": "Jumbo"
}
```

La metadata sirve para guardar datos asociados a una opcion sin crear otro selector duplicado. Por ejemplo, si el codigo de equipo ya conoce su familia, esa familia puede vivir en la metadata de la opcion del equipo.

La UI valida que la metadata sea JSON valido. Si no se informa metadata, se guarda como objeto vacio.

## Derivaciones

Los campos de asignacion pueden usar `config.derives` para completar campos destino a partir de la metadata de la opcion seleccionada.

Ejemplo para un campo Codigo:

```json
{
  "derives": {
    "familia": "metadata.familia"
  }
}
```

En este ejemplo:

- `familia` es el slug del campo destino dentro del mismo assignment type.
- `metadata.familia` se lee desde la opcion seleccionada en el campo Codigo.

Si el usuario selecciona una opcion con esta metadata:

```json
{
  "familia": "Jumbo"
}
```

el formulario completa automaticamente el campo destino cuyo slug es `familia`.

Soporte actual:

- La derivacion ocurre al cambiar un campo select.
- El destino puede ser text.
- El destino puede ser select, buscando primero por value y luego por label.
- Si falta el campo destino, falta la metadata o no hay opcion compatible, no se muestra error y no se escribe nada.
- No hay soporte de derivacion hacia multi select en esta fase.

## Custom fields

Los custom fields permiten agregar campos operacionales sin cambiar el esquema base de programados y reales.

Un custom field tiene:

- Nombre.
- Icono.
- Tipo.
- Aplicacion: Programado, Real o Ambos.
- Requerido.
- Orden.
- Estado activo/inactivo.

Tipos soportados:

- Select.
- Multi select.
- Number.
- Text.
- Date.
- Boolean.

Los campos select y multi select tienen opciones con label visible, value interno, orden y estado activo/inactivo.

Uso operacional:

- Los custom fields activos aparecen en formularios operacionales segun su configuracion de aplicacion.
- Los valores historicos de campos u opciones inactivas pueden seguir mostrandose cuando ya existen datos guardados.
- Los reportes cargan valores de custom fields para filas visibles.

## Reportes y Excel

Los administradores acceden a los mismos reportes operacionales que el resto de usuarios aprobados, con la capacidad adicional de administrar catalogos y usuarios desde sus secciones correspondientes.

Los reportes combinan:

- Programados.
- Reales.
- Interferencias.
- Custom fields.
- Asignaciones.

Las asignaciones son target-aware: una fila programada muestra sus propias asignaciones y una fila real o interferencia muestra las asignaciones de su propio segmento. No se heredan asignaciones entre programado y real.

Exportacion Excel:

- Se genera una sola hoja llamada `Detalle operacional`.
- Los custom fields se exportan como columnas dinamicas.
- Las asignaciones se exportan como columnas dinamicas por tipo de asignacion y campo.

Formato de columnas de asignaciones:

```text
{Tipo de asignacion} - {Campo}
```

Ejemplos:

- `Equipo - Codigo`.
- `Equipo - Familia`.
- `Cuadrilla - Turno`.

Si hay varias instancias del mismo tipo/campo, los valores se separan con `; `. Esto permite filtrar por equipo, familia, cuadrilla u otros campos derivados en Excel.

## Reinicio operacional

En el codigo actual no existe una funcion administrativa de reinicio operacional masivo.

Lo que si existe:

- Eliminacion puntual de programados.
- Eliminacion puntual de segmentos reales/interferencias.
- Eliminacion puntual de elementos de catalogo cuando no tienen dependencias.
- Reemplazo completo de asignaciones de un target al guardar el formulario de asignaciones.

Advertencias:

- Eliminar un programado puede estar bloqueado si ya tiene segmentos reales asociados.
- Eliminar un segmento real o interferencia elimina ese registro especifico.
- Eliminar opciones, campos o tipos puede estar bloqueado si ya tienen uso o dependencias.
- No hay en la UI actual un boton que borre toda la operacion de un periodo.
- No se debe simular un reinicio borrando datos directamente en base sin revisar dependencias, auditoria, reportes y caches offline.

## Buenas practicas

- Mantener slugs estables despues de que un campo, tipo u opcion ya esta en uso.
- Evitar duplicar campos cuando un dato puede derivarse desde metadata.
- Usar metadata para datos asociados a una opcion, como familia de equipo, departamento o atributos descriptivos.
- Usar `config.derives` solo cuando el campo origen y el campo destino pertenecen al mismo assignment type.
- Probar una derivacion con pocas opciones antes de cargar un catalogo grande.
- Preferir desactivar campos u opciones antes que eliminarlos cuando ya pudieron haber sido usados.
- No modificar catalogos en medio de una operacion activa sin criterio operacional, porque los formularios, reportes y usuarios conectados pueden estar usando esas definiciones.
- Revisar orden, nombres visibles y slugs antes de publicar un catalogo para uso diario.
- Evitar cambiar el significado de una opcion existente; si cambia el significado operacional, crear una opcion nueva suele conservar mejor la trazabilidad.

## Inconsistencias o limites detectados

- No hay reinicio operacional masivo implementado como funcionalidad administrativa.
- No hay catalogo maestro de frentes administrable en el codigo actual; solo niveles aparecen como lista administrable.
- La pantalla de custom fields muestra el encabezado `Programado`, aunque el modelo permite configurar aplicacion a Programado, Real o Ambos.
- Las derivaciones de assignments son client-side y no soportan destino multi select.
- El guardado offline de asignaciones reales/interferencias esta bloqueado; requiere conexion.
