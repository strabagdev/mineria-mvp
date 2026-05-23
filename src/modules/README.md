# Modules

Esta carpeta contiene boundaries internos por dominio.

Reglas:

- Cada modulo debe tener ownership claro y no exponer SDKs de proveedor a UI.
- `application` contiene clientes, hooks o use cases consumidos por pantallas.
- `contracts` contiene DTOs y contratos HTTP compartidos.
- `presentation` contiene modelos/helpers/hooks cercanos a UI, sin provider SDK directo.
- `sync` y `realtime` se crean solo cuando el dominio tiene contratos offline o realtime propios.
- Server services/repositories pueden seguir temporalmente en `src/server` mientras la migracion modular sea incremental.

Ver `docs/architecture/domain-boundaries.md`.
