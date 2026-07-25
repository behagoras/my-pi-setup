# Setup desde cero (máquina personal)

> **Este repo NO está instalado en ninguna parte todavía.** Se escribió en la máquina de trabajo,
> donde Pi no se puede usar (no es compliant con Salesforce). Estos pasos son para la máquina
> personal, cuando toque.
>
> Pendiente en la máquina de trabajo: **desinstalar Pi y borrar `~/.pi/`.**

## 1. Instalar Pi

```sh
# desde pi.dev
pi --version
```

## 2. Traer este repo como config de Pi

El repo **es** `~/.pi/agent`:

```sh
# si ~/.pi/agent ya existe con algo dentro, respáldalo primero
[ -e ~/.pi/agent ] && mv ~/.pi/agent ~/.pi/agent.bak

git clone git@github.com:behagoras/my-pi-setup.git ~/.pi/agent
cd ~/.pi/agent && npm install
```

## 3. Login de Claude (el proveedor primario)

```sh
pi
# → /login → Anthropic → navegador → autorizar
# → /model → deben aparecer los modelos de Claude
```

Si `/login` pide una API key en vez de abrir el navegador, esa versión de Pi no soporta OAuth →
revisar [ADR-001](ADR-001-providers.md) D1.

**No hace falta tocar `models.json`.** Está vacío a propósito ([cheatsheet](cheatsheet.md)).

## 4. `settings.json`

Pi lo escribe solo (está gitignored). Lo que debe quedar:

```json
{
  "theme": "github-dark-default",
  "defaultModel": "sonnet",
  "externalEditor": "nvim"
}
```

`ctrl+g` → nvim ya funciona con eso, sin extensión ([ADR-003](ADR-003-statusline.md) D1).

## 5. Verificar las extensiones

```
/subagents     # panel de subagentes
/ps            # terminales en background
/copyall       # historial al clipboard
```

Y que la statusline muestre modelo, %, tok/s y branch.

## 6. Research

Nada que instalar: research va por `subagent_spawn({ harness: "claude" })` y el WebSearch nativo
de Claude Code ([ADR-002](ADR-002-research.md)). Verificar con un prompt de prueba.

## Opcionales (no instalados por decisión)

| Cosa | Estado | Dónde está la decisión |
|---|---|---|
| Firecrawl | Extensión presente, **inerte sin `FIRECRAWL_API_KEY`** | [ADR-002](ADR-002-research.md) |
| OpenAI / codex | Incógnita — probar `codex login` | [ADR-001](ADR-001-providers.md) D2 |
| Cursor | Bloqueado, requiere plan pago | [ADR-001](ADR-001-providers.md) D3 |
| Gemini | Fuera | [ADR-001](ADR-001-providers.md) D4 |

## `fd` y `rg`

La extensión `file-search` los registra como tools. Sin setup: usa los del sistema si existen,
si no baja el binario oficial a `~/.pi/agent/bin/` (gitignored). Si tu plataforma no está soportada,
instálalos con el gestor de paquetes y reinicia Pi.
