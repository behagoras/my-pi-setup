# Handoff — Punto de partida de mi setup personal de Pi

**Fecha:** 2026-07-24 · **Repo:** `~/git/personal/pi` (fork de `davis7dotsh/my-pi-setup` → `behagoras/my-pi-setup`)
**Estado:** decisiones documentadas, **nada instalado**.

Este es el documento de arranque. La próxima sesión es un `/grill-with-docs` sobre **qué instalar,
qué no, qué cambiar, qué eliminar** — y qué se reabre si Pi llega a aprobarse en Salesforce.

## Lee esto primero (no re-derivar)

Todo el razonamiento vive en `docs/` de este repo. **Léelo antes de preguntar nada:**

| Doc | Qué cubre |
|---|---|
| `docs/README.md` | Índice + regla de secretos (env vars, nunca literales) |
| `docs/SETUP.md` | Ruta de instalación en la máquina personal |
| `docs/cheatsheet.md` | `models.json` / `settings.json`, subagentes, efforts, verificación |
| `docs/ADR-001-providers.md` | Proveedores y routing |
| `docs/ADR-002-research.md` | Web search / research |
| `docs/ADR-003-statusline.md` | Statusline, `ctrl+g` → nvim |
| `docs/ben-video-notes.md` | Resumen del video de Ben Davis (origen del setup) |

## El contexto que NO está en los docs

**Pi no es compliant con Salesforce hoy** → no se puede usar en la máquina de trabajo. Por eso este
repo existe: mover el setup a cuenta personal, con suscripciones propias.

Dos handoffs previos tienen la versión *enterprise* (gateway de SF, compliance, `GEMINI_API_KEY`).
Ese material **se quedó deliberadamente fuera de este repo** (es contenido de trabajo, no cruza a
GitHub personal). Están en `$TMPDIR/handoffs/`:

- `2026-07-24-pi-setup-enterprise.md`
- `2026-07-24-gemini-compliant-usage.md`

Y los ADRs enterprise en el vault: `personal/00 Capture/youtube-transcripts/PI/docs/`.
⚠️ Si se reabre el escenario "Pi aprobado en Salesforce", **esa es la fuente** — no reinventarla.

## Lo que hay que decidir en la próxima sesión

### 1. Instalar / no instalar (lo abierto)

| Ítem | Estado | Qué falta decidir |
|---|---|---|
| **OpenAI** | 🟡 **incógnita** (ADR-001 D2) | ¿`codex login` con la suscripción de ChatGPT sirve como harness en Pi? Si no → ¿vale una API key de pago por uso? **Es el pendiente #1.** |
| Cursor | 🔴 bloqueado (free, sin service-account key) | Nada que hacer hasta que pague. Trigger documentado. |
| Gemini | ⚫ fuera | Reabrir solo si aparece caso de volumen barato. |
| Firecrawl | 🟡 extensión presente, inerte | ¿Se queda inerte o se **elimina** del fork? Free tier existe (~500 créditos/mes). |
| Research | 🟢 decidido | Verificar que `subagent_spawn({harness:"claude"})` tenga `WebSearch`. |

### 2. Qué eliminar del fork de Ben

Heredado y probablemente no lo quiero. Cada uno es una decisión de "borrar o dejar":
- `extensions/firecrawl-search/` — depende del punto anterior.
- `extensions/summaries/` — ¿uso resúmenes de sesión?
- `extensions/workflows/` — potente pero pesado; ¿lo uso de verdad?
- El `SETUP.md` de la raíz (upstream) **contradice** mi `docs/SETUP.md` → o se borra o se marca.
- `.env.example` solo tiene `FIRECRAWL_API_KEY`.
- `assets/pi-setup.jpeg` es la screenshot de Ben.

### 3. Qué modificar

- **Statusline** (ADR-003): añadir elapsed (~10 líneas en `extensions/model-info/index.ts`) +
  semáforo de color, portado de `~/git/personal/behagoras-skills/plugins/statusline/statusline.mjs:47-51`.
- **Rate limits 5h/7d**: con suscripción el dato existe (a diferencia del gateway). **Sin verificar**
  si Pi expone esos headers. Es el segmento más útil con suscripción — más que el `$`.
- **`AGENTS.md`** del repo: escribir la tabla de routing (ADR-001) como instrucción + la gramática de
  modelos por harness. Sin eso el modelo padre inventa IDs inválidos en `subagent_spawn`.

### 4. Si Pi llega a aprobarse en Salesforce

No es merge de repos — son **dos setups separados**. Lo que cambiaría en el lado trabajo:
`models.json` con los 4 bloques del gateway (incl. el override candado `"google"`), research por el
plugin deep-research de `salesforce-native-ai-stack`, Cursor por service-account key. **Todo ya está
especificado** en los handoffs y ADRs enterprise citados arriba. Este repo personal **no debe
absorber nada de eso**.

## Higiene pendiente

- [ ] **Desinstalar Pi de la máquina de trabajo** y borrar `~/.pi/`.
- [ ] Commit de `docs/` + `README.md` en `~/git/personal/pi` (aún sin commitear; hay un `CLAUDE.md`
      untracked que hay que revisar antes).
- [ ] `~/git/personal/forks/my-pi-setup` (clone de Ben, HEAD `21f40f4`) — ¿se borra? Ya está forkeado.

## Notas de operación

- **El sandbox de Claude Code bloquea escrituras de Pi** (`EPERM … settings.json.lock`) y clones en
  `~/git/personal/` → esos comandos fuera del sandbox.
- `timeout` no existe en esta máquina → `curl -m`.
- `fd -H 'patrón' /` sin acotar directorio **cuelga 2 min**.
- Idioma: repo personal → docs en **español**, código/config en inglés. No commitear salvo petición.
- David pide **decisiones, no encuestas**: lenguaje simple, conciso, y usar **AskUserQuestion** para
  cada bifurcación real. Una recomendación explícita por pregunta.

## Suggested skills

- **`/grill-with-docs`** — es lo que pidió para la próxima sesión. Ojo: su `SKILL.md` referencia
  `/grilling` y `/domain-modeling`, que **no están instalados** en esta máquina. Se corre manual.
- **`/handoff`** — al cerrar.
- **`/graphify`** — no aplica: este repo está fuera del vault.
