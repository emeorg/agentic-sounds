# Agentic Sounds

Extensión para VS Code y Antigravity IDE que reproduce alertas de sonido cuando el asistente de IA realiza acciones (como terminar de responder, editar archivos o pedir permisos).

## Características

- Sin dependencias externas: funciona con el audio nativo de Windows, macOS y Linux.
- Monitoreo automático: observa los archivos de registro en `~/.gemini/antigravity/brain`.
- Audios personalizables: cada alerta tiene su archivo independiente en la carpeta de sonidos.

## Sonidos y Eventos

| Evento | Motivo | Archivo de audio |
| :--- | :--- | :--- |
| Login | Se activa la extensión | `sounds/login.mp3` |
| Complete | El asistente terminó de responder | `sounds/complete.mp3` |
| Message | Se modificó un archivo de código | `sounds/message.mp3` |
| Attention | El asistente pide confirmación para ejecutar un comando | `sounds/attention.mp3` |
| Warning | Se detectó un comando potencialmente destructivo | `sounds/warning.mp3` |

## Instalación

Puedes instalarla directamente desde la tienda de extensiones (Marketplace) para recibir actualizaciones automáticas.

1. Abre la sección de Extensiones (`Ctrl+Shift+X`).
2. Busca "Agentic Sounds" e instala la extensión.

## Comandos

Desde la paleta de comandos (`Ctrl+Shift+P`):
- `Agentic Sounds: Probar Sonido de Notificación`: ejecuta un sonido de prueba.
- `Agentic Sounds: Estado del Monitor`: muestra los registros de la extensión.

## Desarrollo local

Para empaquetar la extensión manualmente en tu equipo usando Bun:

```bash
bun install
bun run package
```
