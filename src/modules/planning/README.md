# Planning Module

Ownership:

- Planificacion operacional.
- Catalogo de planning.
- Gantt, turnos, agrupacion y modelos de presentacion.
- Sync offline eventual de planning.
- Adapter realtime de planning.

No debe contener:

- Reportabilidad agregada.
- Administracion de usuarios.
- Provider SDK directo en UI/presentation.
- Nuevas colas offline fuera de `sync` sin contrato documentado.

Server services/repositories de planning siguen en `src/server` por transicion incremental.
