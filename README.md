# Heuristic Evaluator Dashboard

Aplicación web sin dependencias externas con backend Node incluido.

## Qué incluye

- Backend HTTP propio en `server.js`.
- Acceso por contraseña compartida gestionado en servidor.
- Sesión por cookie `HttpOnly`.
- Historial persistido en `data/audits.json`.
- Carga de URL o imagen desde el cliente.
- Evaluación heurística centralizada en backend.
- Integración opcional con proveedor externo vía `OPENAI_API_KEY` + `OPENAI_MODEL`.
- Fallback determinista del servidor cuando no hay proveedor externo o falla.
- Informe imprimible servido por backend para exportación PDF.

## Cómo arrancarlo

1. Ejecuta `node server.js`.
2. Abre `http://127.0.0.1:3000`.
3. Inicia sesión con la contraseña compartida.

## Variables de entorno

- `PORT`: puerto del servidor (por defecto `3000`).
- `HOST`: host del servidor (por defecto `127.0.0.1`).
- `NIELSEN_SHARED_PASSWORD`: contraseña compartida (por defecto `Nielsen2026`).
- `OPENAI_API_KEY`: habilita análisis externo si está presente.
- `OPENAI_MODEL`: modelo del proveedor externo.

## Notas

- La integración con proveedor externo está implementada como mejor esfuerzo y usa `https://api.openai.com/v1/responses`.
- Si el proveedor externo falla o no está configurado, el backend usa el motor heurístico local.
- La exportación a PDF sigue dependiendo del diálogo de impresión del navegador, pero el informe se genera ya desde el servidor y no desde el estado local del cliente.
