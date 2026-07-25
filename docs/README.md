# docs/ — decisiones de mi setup de Pi (uso personal)

Este repo **es** `~/.pi/agent` (fork de [`davis7dotsh/my-pi-setup`](https://github.com/davis7dotsh/my-pi-setup) → `behagoras/my-pi-setup`).
Aquí vive el *por qué*; la config vive en la raíz del repo.

| Doc | Qué cubre |
|---|---|
| [SETUP.md](SETUP.md) | Instalar desde cero en una máquina nueva. Empieza aquí. |
| [cheatsheet.md](cheatsheet.md) | `models.json` / `settings.json` listos para pegar + comandos de verificación |
| [ADR-001-providers.md](ADR-001-providers.md) | Qué proveedores uso y cómo enruto tareas |
| [ADR-002-research.md](ADR-002-research.md) | Web search y research (Pi no trae) |
| [ADR-003-statusline.md](ADR-003-statusline.md) | Statusline con costo/elapsed y `ctrl+g` → nvim |
| [ben-video-notes.md](ben-video-notes.md) | Resumen del video de Ben Davis que originó este setup |

## Contexto de origen (importante)

La investigación original se hizo para uso **de trabajo** (Salesforce), enrutando todo por el
LLM Gateway de SF. Eso **no aplica aquí**: este setup es de mi cuenta personal, con
suscripciones propias, en mi máquina personal.

Nada de este repo referencia infra, keys ni políticas de Salesforce. Esa versión se queda
en mi vault privado (`personal/00 Capture/youtube-transcripts/PI/docs/`).

## Regla de secretos

`models.json` y `settings.json` referencian **variables de entorno**, nunca keys literales.
Las keys van en `.env` (gitignored) o en el shell. `settings.json` y `auth.json` ya están
gitignored porque los escribe Pi en runtime.
