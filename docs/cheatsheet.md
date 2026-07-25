# Cheatsheet — config lista para pegar

Decisiones en [ADR-001](ADR-001-providers.md) · [ADR-002](ADR-002-research.md) · [ADR-003](ADR-003-statusline.md)

> [!warning] El sandbox de Claude Code bloquea las escrituras de Pi
> `pi install` y `/login` fallan con `EPERM … settings.json.lock`.
> Correr esos comandos en una terminal normal, fuera de Claude Code.

## Archivos que toca la config

| Archivo | Versionado | Para qué |
|---|---|---|
| `models.json` | ✅ | Providers custom. **Hoy vacío** — Claude por OAuth no lo necesita |
| `settings.json` | ❌ gitignored | Default model, tema, `externalEditor`. Lo escribe Pi |
| `keybindings.json` | ❌ | Remapeo de teclas (opcional; `ctrl+g` ya es default) |
| `auth.json` | ❌ gitignored | Tokens de `/login`. **Nunca commitear** |
| `.env` | ❌ gitignored | Keys de extensiones (solo si añado Firecrawl) |
| `extensions/ skills/ themes/` | ✅ | Lo de Ben + mis parches |

## `models.json`

**Vacío a propósito.** Claude entra por `/login` OAuth, que no pasa por aquí:

```json
{ "providers": {} }
```

Solo se llena si añado un proveedor de pago por uso. Plantilla para ese caso:

```json
{
  "providers": {
    "openai": {
      "apiKey": "$OPENAI_API_KEY",
      "models": [
        { "id": "gpt-5.6", "name": "GPT-5.6", "reasoning": true,
          "cost": { "input": 5, "output": 30 } }
      ]
    }
  }
}
```

**Notas que importan:**
- `apiKey` acepta `"$VAR"` (env var) o `"!comando"` (ejecuta y usa stdout, cacheado por vida del
  proceso). **Nunca la key literal** — este repo puede volverse público.
- El archivo **se recarga cada vez que abres `/model`** → editable en sesión, sin reiniciar.
- `cost` es por millón de tokens y es lo que habilita el segmento de costo del statusline.

## `settings.json`

No está versionado (Pi lo reescribe), pero esto es lo que debe quedar:

```json
{
  "theme": "github-dark-default",
  "defaultModel": "sonnet",
  "externalEditor": "nvim"
}
```

## Subagentes

```
subagent_spawn({ prompt, name, harness, workingDir, model, reasoningEffort })
```

- Harnesses: `pi` · `claude` · `codex` (⚠️ codex sin autenticar — ver ADR-001 D2).
- **Si omites `model`/`reasoningEffort`, el hijo hereda del padre.** Sé explícito siempre.
- Máx. **4 corriendo** a la vez (`MAX_RUNNING = 4`), 64 trackeados.
- `resolvePiModel`: `provider/model-id` es exacto; el id pelado tira
  `Model "X" exists in multiple providers` si es ambiguo.
- Research → `harness: "claude"` (ADR-002).

## Efforts y thinking budgets

Efforts válidos en Pi: `off` `minimal` `low` `medium` `high` `xhigh` `max`.

Budgets del backend claude: `off:0` `minimal:1024` `low:4096` `medium:10000` `high:16000`
`xhigh:32000` `max:63999`.

## Extensiones de Ben (fork de `davis7dotsh/my-pi-setup`)

| Extensión | Qué da |
|---|---|
| `subagents` | Backends pi/claude/codex + `/subagents` |
| `workflows` | Pipelines multifase + `/workflows` |
| `file-search` | `fd` + `rg` como tools |
| `background-terminals` | `/ps` — procesos en background |
| `ask-user` | Preguntas de opción múltiple en terminal |
| `model-info` + `git-info` + `ui-customization` | Statusline (modelo, %, costo, tok/s, branch) |
| `copy-all` | `/copyall` — historial al clipboard |
| `summaries` | Resúmenes de sesión |
| `themes/` | `github-dark-default` |

## Comandos de verificación

```bash
pi --version
cat ~/.pi/agent/settings.json

# dentro de pi
/model          # ¿aparecen los modelos de Claude tras /login?
/subagents      # ¿carga la extensión?
/ps
```

## Notas de operación (ahorran tiempo)

- El sandbox de Claude Code bloquea escrituras de Pi (`EPERM … settings.json.lock`) y los clones
  en `~/git/personal/` → esos comandos fuera del sandbox.
- `timeout` no existe en esta máquina → usar `curl -m`.
- `fd -H 'patrón' /` sin límite de profundidad **cuelga 2 min**; acotar siempre el directorio.
