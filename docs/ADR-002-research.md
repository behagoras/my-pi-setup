# ADR-002 — Web search y research (personal)

**Estado:** aceptado · 2026-07-24 · Relacionado: [ADR-001](ADR-001-providers.md)

## Contexto

**Pi no tiene web search. En absoluto.** Verificado por búsqueda estructural sobre pi 0.82.0 + pi-ai:

```
rg -il "googleSearch|google_search|groundingMetadata|urlContext"  → 0 hits en código propio de pi
```

Los únicos hits están dentro del `@google/genai` empaquetado. En
`pi-ai/dist/api/google-generative-ai.js:280`, `convertTools` solo emite `functionDeclarations` +
`toolConfig.functionCallingConfig` — **no hay ruta para inyectar una tool de grounding**.
Por eso Ben Davis empaqueta Firecrawl en su setup.

## Decisión — delegar a un subagente, no añadir una tool

**Primaria:** `subagent_spawn({ harness: "claude" })` y dejar que use el **WebSearch nativo de Claude Code**.
**Backup:** `harness: "codex"` y su web search — condicionado a que `codex login` funcione
(ver [ADR-001](ADR-001-providers.md) D2, sigue siendo incógnita).

Por qué así:
- **Cero credenciales nuevas, cero código nuevo.** El research sale por la suscripción que ya pago.
- El backend de Ben (`extensions/subagents/src/backends/claude.ts`) usa
  `@anthropic-ai/claude-agent-sdk` con `pathToClaudeCodeExecutable` y **no pasa `env` explícito**
  → el hijo hereda mi entorno y `~/.claude/settings.json`. Funciona sin configurar nada.
- Dos proveedores de search independientes: si uno falla o se queda corto, el otro cubre.

Consecuencia aceptada: rompe la preferencia de *"todo por el harness de pi"*. Es el precio de no
tener search nativo.

## Firecrawl: fuera, pero por decisión, no por bloqueo

El fork de Ben trae `extensions/firecrawl-search/`. En personal **sí podría** usarlo (free tier
~500 créditos/mes), pero WebSearch de Claude ya cubre el caso sin una tercera credencial ni
límite de créditos que administrar.

**Acción:** la extensión se queda en el repo pero **sin `FIRECRAWL_API_KEY`** → arranca inerte.
Si algún día quiero scraping estructurado (que WebSearch no da), es solo poner la key en `.env`.

## Alternativa descartada: grounding de Google en Pi

Una extensión de ~60 líneas modelada en `firecrawl-search/index.ts` que haga POST con
`{"googleSearch":{}}` **técnicamente funciona** — lo verifiqué con
`vertex_ai_grounding_metadata: POPULATED` y URLs de citación.

Descartada porque implica una credencial de Google que ya decidí no usar aquí
([ADR-001](ADR-001-providers.md) D4).

Dos notas técnicas que vale guardar por si vuelvo:
- `max_tokens: 300` se consumía entero en reasoning tokens (`finish_reason: "length"`) y la
  respuesta se veía vacía. Con 2000 aparecía el metadata.
- El grounding **dio una respuesta incorrecta** (versión "0.81.1") donde la consulta directa
  acertó ("0.82.0") → las citas hay que verificarlas siempre.

## Alternativa descartada: harness `gemini`

- Headless (`gemini -p … --approval-mode yolo`) **timeout a los 2 minutos** → inviable como subagente.
- Ben **no tiene** backend de Gemini: solo `claude.ts`, `codex.ts`, `pi.ts`, `stub.ts`.
  Habría que escribirlo.

## Pendientes

- [ ] Verificar `subagent_spawn({ harness: "claude", prompt: "busca en web X" })` → confirmar que
      el hijo tiene la tool `WebSearch` disponible.
- [ ] `codex login` → si funciona, confirmar su web search como backup real.
