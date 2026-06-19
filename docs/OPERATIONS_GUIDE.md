# Guia funcional de operaciones

## Objetivo de la plataforma

La plataforma permite administrar la programacion operacional diaria, registrar la ejecucion real y documentar interferencias en una carta Gantt operacional. Tambien permite configurar catalogos, campos adicionales, asignaciones de recursos y reportes exportables.

El foco del sistema es comparar lo programado con lo ejecutado, mantener trazabilidad operativa y facilitar el analisis por fecha, turno, nivel, frente, categoria, tipo, campos configurables y asignaciones.

## Roles de usuario

### Administrador

El administrador puede:

- Crear, editar, activar/desactivar y eliminar elementos del catalogo operacional cuando no tienen dependencias bloqueantes.
- Administrar usuarios, roles, aprobaciones y bloqueo de cuentas.
- Consultar auditoria.
- Crear, editar y eliminar programados, reales e interferencias.
- Administrar campos configurables.
- Administrar tipos de asignacion, campos de asignacion y opciones.
- Ver reportes y exportar archivos.

### Operativo

El operativo puede:

- Crear, editar y eliminar registros operacionales cuando la vista lo permite.
- Registrar programados.
- Registrar reales e interferencias asociados a programados.
- Completar campos configurables de programados.
- Completar asignaciones en programados, reales e interferencias.
- Ver reportes y exportar archivos.

El operativo no puede administrar catalogos ni usuarios.

### Visualizador

El visualizador puede:

- Ingresar a vistas de operacion y reportes en modo lectura.
- Revisar programados, reales, interferencias, campos y asignaciones.
- Ver reportes y exportar archivos.

El visualizador no puede crear, editar ni eliminar registros operacionales. Tampoco puede administrar catalogos, usuarios o configuraciones.

## Programados

Un programado representa una actividad planificada para una fecha operacional.

Campos principales:

- Fecha.
- Horario de inicio y termino.
- Turno.
- Nivel.
- Frente.
- Categoria.
- Tipo.
- Detalle o descripcion.
- Notas.

Los programados se muestran en la carta Gantt en la capa "programado". Desde un programado se pueden registrar eventos reales o interferencias asociados al mismo grupo operacional.

En programados tambien pueden completarse:

- Campos configurables aplicables a planificacion.
- Asignaciones planificadas.

## Reales

Un real representa un evento ejecutado. En la UI aparece como "evento real" y se muestra en la capa real de la carta Gantt.

Los reales se registran asociados a un grupo/programado existente. Comparten la logica de fecha, turno, nivel, frente, categoria, tipo, descripcion y notas.

En reales se pueden completar asignaciones reales. Actualmente los campos configurables visibles en el detalle estan disponibles para programados; no se muestran campos configurables para reales en la UI principal.

Cuando el usuario esta offline, el guardado de asignaciones reales queda bloqueado con el mensaje de que las asignaciones reales requieren conexion por ahora.

## Interferencias

Una interferencia es un evento real clasificado con categoria "interferencia". Se muestra en la carta Gantt con tratamiento visual diferenciado respecto de una actividad.

En una interferencia, las asignaciones se presentan funcionalmente como "Recursos involucrados". Esto permite documentar equipos, cuadrillas u otros recursos relacionados con la interferencia.

## Asignaciones

Las asignaciones permiten registrar recursos operacionales sobre:

- Programados.
- Actividades reales.
- Interferencias.

El titulo cambia segun el tipo de registro:

- Programado: "Asignaciones planificadas".
- Real de actividad: "Asignaciones reales".
- Interferencia: "Recursos involucrados".

Las asignaciones se configuran desde el catalogo de assignments. Un tipo de asignacion puede tener:

- Nombre.
- Slug.
- Descripcion.
- Icono.
- Maximo de instancias.
- Orden.
- Estado activo/inactivo.
- Campos internos.

Cada campo de asignacion puede ser:

- Texto.
- Numero.
- Fecha.
- Booleano.
- Select.
- Multi select.

Los campos select y multi select usan opciones administrables. Las opciones tienen valor interno, etiqueta visible, orden, estado activo/inactivo y metadata JSON.

En la carta Gantt, las asignaciones se resumen con iconos y conteos. En el detalle se muestran los valores guardados.

## Custom fields

Los custom fields son campos configurables adicionales para la operacion. Se administran desde el catalogo operacional en la seccion "Campos configurables".

Permiten extender la informacion registrada sin cambiar el formulario base. Pueden tener:

- Nombre.
- Slug.
- Icono.
- Tipo de input.
- Estado activo/inactivo.
- Requerido/opcional.
- Aplicacion segun fase.
- Orden.
- Opciones, cuando corresponde.

En la operacion actual, los custom fields se completan en programados. Se muestran en detalle, tooltips y reportes cuando tienen valores.

## Metadata

Las opciones de campos de asignacion soportan metadata JSON. Esta metadata se edita desde el catalogo de assignments, en opciones de campos select o multi select, mediante el campo "Metadata JSON".

Ejemplo:

```json
{
  "familia": "Jumbo"
}
```

Reglas actuales:

- Si el campo queda vacio, se guarda `{}`.
- Debe ser un objeto JSON valido.
- No se aceptan arrays como metadata raiz.
- Si el JSON es invalido, la UI bloquea el guardado con un mensaje de error.

La metadata por si sola no se muestra al usuario final. Se usa como base para derivaciones configuradas en campos select.

## Derivaciones

Las derivaciones permiten que un campo select complete automaticamente otros campos de la misma asignacion usando la metadata de la opcion seleccionada.

La configuracion se declara en el `config` del campo origen.

Ejemplo de campo origen:

```json
{
  "derives": {
    "familia": "metadata.familia"
  }
}
```

Con una opcion:

```json
{
  "familia": "Camion"
}
```

Al seleccionar esa opcion, el campo destino con slug `familia` se completa con "Camion".

Alcance actual:

- Solo se aplican derivaciones al cambiar un campo `select`.
- Los destinos se buscan por `slug` dentro del mismo tipo de asignacion.
- Se soportan destinos `text`.
- Se soportan destinos `select`, buscando opcion destino por `value` primero y por `label` despues.
- No se soportan destinos `multi_select` en esta fase.
- Si la metadata no existe, el destino no existe o no hay opcion coincidente, la derivacion se ignora sin mostrar error.

Las derivaciones no cambian la base de datos ni crean reglas globales. Son comportamiento del formulario de assignments.

## Reportes

La seccion Reportes permite consultar registros operacionales con filtros. El reporte incluye programados, reales e interferencias.

Los filtros disponibles incluyen:

- Rango de fechas.
- Turno.
- Nivel.
- Frente.
- Categoria.
- Vista o tipo de seguimiento.
- Tipo.

El reporte muestra:

- Resumen de registros y horas.
- Desgloses por nivel, turno, frente, categoria, vista y tipo.
- Tabla de detalle.
- Campos configurables cuando existen valores.
- Asignaciones asociadas a cada fila visible.

El detalle del reporte usa los mismos nombres funcionales de asignaciones:

- Programados: "Asignaciones planificadas".
- Reales: "Asignaciones reales".
- Interferencias: "Recursos involucrados".

Las asignaciones del reporte son target-aware: una fila programada muestra solo asignaciones del programado, y una fila real/interferencia muestra solo asignaciones de su segmento real. No se infieren ni heredan asignaciones entre programado y real.

## Exportacion Excel

La exportacion Excel genera una sola hoja llamada `Detalle operacional`.

La hoja incluye:

- Columnas base del registro.
- Columnas dinamicas de custom fields.
- Columnas dinamicas de assignments.

Las columnas de assignments se generan por tipo de asignacion y campo:

- `{Tipo de asignacion} - {Campo}`

Ejemplos:

- `Equipo - Codigo`
- `Equipo - Familia`
- `Cuadrilla - Codigo`
- `Cuadrilla - Turno`

Si un campo fue completado por derivacion, tambien aparece en Excel porque queda guardado como valor normal del assignment.

Si hay multiples instancias del mismo tipo/campo en una misma fila, los valores se separan con `; `.

La exportacion Excel no crea hojas adicionales para asignaciones.

La exportacion CSV existe en la pantalla de reportes, pero no usa las columnas dinamicas de assignments del Excel.

## Restricciones de permisos

Las acciones requieren usuario aprobado y activo.

Restricciones principales:

- Usuarios pendientes, rechazados o inactivos no acceden normalmente a la operacion.
- Solo administradores administran catalogos, usuarios y auditoria.
- Administradores y operativos pueden escribir registros operacionales.
- Visualizadores tienen acceso de lectura.
- La administracion del catalogo no esta disponible para operativos ni visualizadores.
- La auditoria administrativa esta restringida a administradores.

En modo historico, la UI puede dejar registros en solo lectura hasta que se habilite la edicion historica.

## Buenas practicas de configuracion

- Usar slugs estables y descriptivos. Las derivaciones resuelven campos destino por slug.
- Evitar cambiar slugs de campos que ya se usan en derivaciones.
- Mantener nombres de campos claros, porque se usan como encabezados en reportes y Excel.
- Para derivaciones, preferir metadata simple con claves directas, por ejemplo `familia`, `marca` o `tipo`.
- En campos select derivados, asegurar que el valor de metadata coincida con el `value` o `label` de una opcion del campo destino.
- Probar las derivaciones en una asignacion real antes de usarlas masivamente.
- Usar metadata JSON valida y mantener la raiz como objeto.
- Desactivar opciones o campos antiguos antes de eliminarlos si ya tienen uso historico.
- Mantener el catalogo de assignments compacto: tipos, campos y opciones deben representar informacion que realmente se necesite en operacion o reportes.
- Revisar el Excel despues de agregar campos nuevos, especialmente si hay nombres repetidos que puedan generar encabezados con sufijos.
