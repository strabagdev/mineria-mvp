# Modelo Operacional Vigente

Ultima actualizacion: 2026-07-08

## Objetivo

El modelo operacional vigente de OPSAHEAD Mining se basa en tres motores:

```text
Evento Operacional
|
+-- Cabecera Operacional
+-- Actividad / Interferencia
+-- Asignaciones
```

Cada motor tiene una responsabilidad clara y no debe duplicarse en mecanismos
paralelos.

## Cabecera Operacional

Cabecera Operacional es la unica fuente de verdad para la identidad operacional
del evento. Define los ejes por los que la operacion reconoce, agrupa, filtra,
reporta y exporta sus eventos.

Responsabilidades:

- Identidad operacional.
- Clasificacion operacional configurable.
- Filtros de Operaciones y Reportes.
- Agrupaciones de Gantt.
- Columnas de Reportes, Excel y CSV.
- Valores visibles en detalle/modal y tooltip.
- Dependencias entre opciones, por ejemplo Nivel -> Frente o Departamento -> Especialidad.

La Cabecera Operacional se administra con:

- Campos (`operational_header_fields`).
- Opciones para campos select (`operational_header_field_options`).
- Dependencias entre opciones (`operational_header_option_dependencies`).
- Valores por evento (`operational_header_values`).

Los campos como Nivel, Frente, Departamento, Especialidad, Area o Sector son
campos comunes de Cabecera Operacional. No existen columnas funcionales
especiales para Nivel/Frente ni una tabla separada de niveles.

## Actividades e Interferencias

Actividad / Interferencia describe que se programa o que ocurrio.

```text
Actividad o Interferencia
|
+-- Tipo
    |
    +-- Detalle
```

Responsabilidades:

- Catalogo funcional de programacion.
- Diferenciar actividad operacional e interferencia.
- Definir tipo y detalle del trabajo o evento.
- Mantener el significado de la ejecucion separado de la identidad operacional.

Este catalogo vive en `planning_catalog_types` y `planning_catalog_details`.

## Asignaciones

Asignaciones concentra recursos y atributos asociados al evento.

Responsabilidades:

- Recursos.
- Equipos.
- Cuadrillas.
- Operadores.
- Atributos asociados a esos recursos.
- Instancias repetibles por evento.

Las asignaciones se administran con:

- `assignment_types`.
- `assignment_fields`.
- `assignment_field_options`.
- `planning_assignments`.
- `planning_assignment_values`.

No se deben modelar recursos, equipos o cuadrillas como campos genericos del
evento. Para eso existe Asignaciones.

## Flujo De Datos

```text
Cabecera Operacional
  -> Formulario
  -> Persistencia
  -> Gantt
  -> Detalle
  -> Reportes
  -> Excel / CSV
  -> Offline
```

Todas estas capas consumen Cabecera Operacional como fuente funcional. Si un
campo esta activo, filtrable, agrupable, visible en Gantt o exportable, su
comportamiento se deriva de la configuracion de Cabecera Operacional.

## Semantica De Comportamiento

H6.2 consolida la semantica de comportamiento de Cabecera Operacional. Cada
flag controla una responsabilidad distinta y no debe reutilizarse como atajo
para otro consumidor.

| Propiedad | Responsabilidad | Consumidores | Regla efectiva |
| --- | --- | --- | --- |
| `active` | Habilita el campo para runtime. | Formulario, Gantt, detalle, reportes, CSV, Excel. | Si es `false`, el campo no participa en captura ni consumo funcional vigente. |
| `required` | Obligatoriedad de captura. | Formulario y validacion backend de programados/reales. | Solo aplica cuando `active = true`; respeta tipo, opciones activas y dependencias. |
| `sort_order` | Orden visual general. | Catalogo, formulario, detalle, reportes, CSV y Excel. | Tambien es fallback para Gantt cuando `grouping_order` es `null`. |
| `grouping_order` | Orden independiente de niveles de agrupacion Gantt. | Gantt. | Solo tiene efecto con `active && groupable && visible_in_gantt`; `null` usa `sort_order`. |
| `groupable` | Participacion en agrupaciones/breakdowns. | Gantt y breakdowns de reportes. | En Gantt requiere `visible_in_gantt`; en reportes requiere `exportable`. |
| `visible_in_gantt` | Disponibilidad visual para agrupar Gantt. | Gantt. | No tiene efecto sin `groupable`. |
| `filterable` | Disponibilidad como filtro de reportes. | UI/API de reportes. | Independiente de `exportable`; un campo puede filtrar sin ser columna. |
| `exportable` | Presencia reportable como columna. | Tabla de reportes, CSV y Excel. | Independiente de `filterable`; requerido para breakdowns de reportes. |

La regla de columnas reportables es:

```text
active && exportable
```

La regla de breakdowns de reportes es:

```text
active && groupable && exportable
```

La regla de filtros de reportes es:

```text
active && filterable
```

La regla de agrupacion Gantt es:

```text
active && groupable && visible_in_gantt
```

La regla de orden de agrupacion Gantt es:

```text
grouping_order ?? sort_order
```

Offline consume respuestas previamente calculadas. Si se cambian flags de
Cabecera Operacional, el snapshot offline debe refrescarse para reflejar la
nueva configuracion. Los filtros offline quedan limitados a los datos presentes
en ese snapshot.

## Separacion De Responsabilidades

Cabecera Operacional:

- Donde y bajo que eje operacional ocurre.
- Como se agrupa, filtra, reporta y exporta.

Actividad / Interferencia:

- Que se programa o que interfiere.
- Tipo y detalle del evento.

Asignaciones:

- Quien o que recurso participa.
- Equipos, cuadrillas, operadores y atributos asociados.

## Custom Fields

Custom Fields fue eliminado del modelo vigente. No forma parte de la
arquitectura actual, no se administra en Catalogo, no participa en captura
operacional, reportes, exportaciones ni offline.

La necesidad que antes podia parecer "campo configurable generico" debe
resolverse asi:

- Identidad, ubicacion, clasificacion, filtros, Gantt y reportes:
  Cabecera Operacional.
- Recursos, equipos, cuadrillas, operadores y atributos asociados:
  Asignaciones.
- Tipo y detalle del trabajo:
  Actividad / Interferencia.

## Auditoria Historica

Los registros historicos de auditoria pueden contener snapshots con nombres
antiguos como `level`, `front` o eventos asociados a Custom Fields. Esas
referencias son datos historicos, no runtime actual ni contrato vigente.

La UI de auditoria puede seguir mostrando esos snapshots para trazabilidad,
pero ninguna capa funcional debe leerlos como fuente operacional.

## Reglas De Arquitectura

- No reintroducir columnas funcionales paralelas para Nivel/Frente.
- No reintroducir una tabla separada de niveles.
- No agregar metadata tecnica de compatibilidad legacy a Cabecera Operacional.
- No usar Asignaciones como sustituto de identidad operacional.
- No usar Cabecera Operacional para instancias repetibles de recursos.
- No reintroducir Custom Fields como tercer motor generico.
