# ADR-001 — Proveedores y routing de modelos (personal)

**Estado:** aceptado · 2026-07-24 · Reemplaza la versión enterprise (gateway SF), que ya no aplica.

## Contexto

Corro Pi en mi cuenta personal. No hay gateway corporativo, no hay virtual keys de LiteLLM,
no hay política de compliance que restrinja proveedores. Lo que hay son **suscripciones que ya pago**,
así que la decisión se optimiza por *no pagar dos veces por lo mismo*.

Lo que tengo:

| Fuente | Plan | Sirve para Pi |
|---|---|---|
| Claude (Anthropic) | suscripción Pro/Max | ✅ vía `/login` OAuth — sin costo por token |
| OpenAI / ChatGPT | suscripción | ⚠️ **incógnita**, ver D2 |
| Cursor | **free** | ❌ bloqueado, ver D3 |

## D1 — Claude por suscripción es el proveedor primario

Pi soporta login OAuth de Anthropic (`pi` → `/login`). Con eso el consumo se descuenta de la
suscripción y **no hace falta `ANTHROPIC_API_KEY` ni bloque en `models.json`**.

Consecuencia: el default y el 90% del trabajo van por Claude. Es lo más barato que tengo
(costo marginal cero) y lo mejor para arquitectura/código.

> Verificar al instalar: `/login` → elegir Anthropic → `/model` debe listar los modelos
> Claude sin haber tocado `models.json`. Si pide API key en vez de abrir el navegador,
> esa versión de Pi no soporta OAuth y hay que revisar este ADR.

## D2 — OpenAI: incógnita a resolver, no bloqueante

**No está confirmado** si mi suscripción de ChatGPT se puede usar desde Pi.

Dos hipótesis, ninguna verificada:
- **H1 — harness `codex`:** `codex login` autentica con la cuenta de ChatGPT, y Pi puede lanzar
  subagentes con `harness: "codex"`. Si eso funciona, tengo GPT en Pi sin pagar API.
  Estado actual: `codex login status` → *"Not logged in"*.
- **H2 — provider `openai` con API key:** funciona seguro, pero es **pago por uso aparte** de la
  suscripción. Es el plan B, no el plan A.

**Decisión:** no bloquear el setup por esto. Arranco con Claude solo; pruebo `codex login` cuando
tenga ganas, y si no funciona decido si vale una API key. Sin GPT el setup ya es usable.

Pendiente concreto: correr `codex login` y luego `subagent_spawn({ harness: "codex" })` con un
prompt trivial. Si responde → H1 confirmada, se actualiza este ADR y la tabla de routing.

## D3 — Cursor: bloqueado (requiere plan pago)

`pi-cursor-sdk` necesita una **service-account API key**, que solo se emite en planes
Team/pago. Mi cuenta es free → no hay key que poner.

**No se instala nada.** Sin código muerto ni bloques comentados en `models.json`.

**Trigger para revisar:** el día que pague Cursor. Entonces:
`pi install npm:pi-cursor-sdk` → `/login` → key → `/model` debe mostrar `cursor/...`.
Lo que aportaría: **Grok 4.5** (no existe en ningún otro proveedor mío) y GPT sin API key.
Advertencia conocida: el costo de Cursor **no se expone**, así que en el statusline saldría `?`.

## D4 — Gemini: fuera

Con la key personal de Google sí podría, pero:
- Claude cubre el trabajo bueno, y para tareas baratas ya no tengo un modelo "flash" que
  justifique una tercera credencial.
- La ruta de Gemini que tengo montada (`gemini-gw`) es del trabajo y no pinta aquí.

Se reconsidera solo si aparece un caso donde el volumen justifique un modelo barato de pago por uso.

## Routing acordado

Con Claude como único proveedor confirmado, el routing es por **effort**, no por proveedor:

| Tarea | Modelo | Effort |
|---|---|---|
| Main thread (default) | `sonnet` | medium |
| Búsqueda / grep / leer / resumir | `sonnet` | minimal |
| Implementar acotado, tests, refactor | `sonnet` | medium |
| Arquitectura, debugging difícil, review | `opus` | high |
| Second opinion / cross-check | `opus` (o GPT si D2 se resuelve) | high |
| Research | subagente `harness: "claude"` — ver [ADR-002](ADR-002-research.md) | — |

Efforts válidos en Pi: `off` `minimal` `low` `medium` `high` `xhigh` `max`.

## Gramática de modelos por harness (fuente de bugs)

Cada harness nombra el modelo y el effort distinto. Sin esto documentado, el modelo padre
inventa IDs que no existen:

```
pi      → "provider/model-id"           + reasoningEffort aparte
claude  → "opus" / "sonnet"             + thinking budget interno
codex   → id de OpenAI                  (si D2 se confirma)
cursor  → effort EMBEBIDO en el id:     "claude-opus-5-thinking-high"
```

⚠️ **Si omites `model`/`reasoningEffort` en `subagent_spawn`, el hijo hereda del padre.**
Hay que ser explícito siempre. Máx. 4 subagentes corriendo a la vez (`MAX_RUNNING = 4`).

## Alternativas descartadas

| Opción | Por qué no |
|---|---|
| API key de Anthropic | La suscripción ya lo cubre a costo marginal cero |
| API key de OpenAI (hoy) | Pago extra sobre algo que quizá ya tengo vía codex — ver D2 |
| Cursor | Cuenta free, sin service-account key (D3) |
| Gemini personal | Tercera credencial sin caso de uso que la pida (D4) |
| DeepSeek | No me interesa |
