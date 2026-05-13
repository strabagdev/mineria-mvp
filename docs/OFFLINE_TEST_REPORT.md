# mineria-mvp - Offline Test Report

Fecha: 2026-05-10
Ambiente: `next dev` en `http://localhost:3000`
Herramienta: `agent-browser`

## Resultado

### Caso 1 - Login offline muestra mensaje de red
- Pasos:
  - abrir `/login`
  - activar modo offline en navegador de prueba
  - completar correo/contrasena y enviar
- Resultado:
  - aparece mensaje esperado:
    - `⚠️ No se pudo conectar con el servidor. Si estas en interior mina, probablemente se perdio la senal; vuelve a intentar cuando recuperes conexion.`
- Estado: `PASS`

### Caso 2 - Planning offline crea registro pendiente
- Pasos:
  - login con usuario admin
  - ir a planning (`/`)
  - activar modo offline
  - crear nueva programacion
- Resultado:
  - se muestra mensaje: `Sin conexion: el registro quedo guardado...`
  - se muestra contador: `1 registro pendiente de sincronizacion.`
  - el registro aparece en Gantt con etiqueta `pendiente`.
- Estado: `PASS`

### Caso 3 - Reconexion sincroniza automaticamente
- Pasos:
  - con 1 registro pendiente, restaurar conectividad (`offline off`)
  - esperar ciclo de sincronizacion automatica
- Resultado:
  - desaparece el contador de pendientes
  - el registro se mantiene visible, ya sin estado `pendiente`
- Estado: `PASS`

### Caso 4 - Reload completo sin red
- Pasos:
  - con modo offline activo, recargar navegador
- Resultado:
  - el navegador cae en `ERR_INTERNET_DISCONNECTED` (no hay cobertura de pagina offline por Service Worker para hard reload).
- Estado: `KNOWN GAP`

## Validaciones automáticas complementarias
- `npm run lint`: `PASS`
- `npm run build`: `PASS`
