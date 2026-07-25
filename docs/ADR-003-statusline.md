# ADR-003 — Statusline (costo, elapsed) y `ctrl+g` → nvim

**Estado:** aceptado · 2026-07-24 · Relacionado: [ADR-001](ADR-001-providers.md)

## Contexto

Quiero en Pi lo que ya tengo en Claude Code vía mi plugin `statusline` de
[`behagoras-skills`](https://github.com/behagoras/behagoras-skills)
(`plugins/statusline/statusline.mjs`):

```
[Opus 5] | ███████░░░ 69% | $5.65 | 41m 41s
```

Y `ctrl+g` para abrir nvim.

Decisión de base: **dejar la statusline de Ben tal cual y añadirle solo lo mío que falte.**

## D1 — `ctrl+g` → nvim: una línea, cero código

**Ya es el default de Pi** (`docs/keybindings.md:89`): la acción `app.editor.external` está en
`ctrl+g` y abre `externalEditor`, `$VISUAL`, `$EDITOR`, o `nano`.

Solo hay que declarar el editor en `settings.json` (`externalEditor` **tiene precedencia**
sobre las env vars):

```json
{ "externalEditor": "nvim" }
```

Sin extensión, sin keybinding custom. Para remapear otras teclas hay
`~/.pi/agent/keybindings.json` y `/reload` lo aplica sin reiniciar la sesión.

## D2 — Statusline: base de Ben + lo portable de mi plugin

`extensions/shared/dashboard-state.ts` ya publica: `modelId`, `modelName`, `thinking`,
`contextPercent`, `contextWindow`, `cost`, `tokensPerSecond`, `generating`, `branch`, `changedFiles`.

El costo de sesión ya está calculado (`extensions/model-info/index.ts:14-23`).

| Segmento | Ben | Mi plugin CC | Acción |
|---|---|---|---|
| `[modelo]` | ✅ + `provider/id · thinking` | ✅ solo nombre | Ben gana (ver el effort activo importa con 7 niveles) |
| barra `███████░░░ 69%` | ✅ color del tema | ✅ **semáforo 70%/90%** | **Portar el semáforo** (`statusline.mjs:47-51`) |
| `$5.65` | ✅ | ✅ | igual |
| `41m 41s` | ❌ | ✅ `formatDuration` | **Añadir elapsed** (~10 líneas) |
| `tok/s` en vivo | ✅ | ❌ | ya viene |
| branch + files changed | ✅ | ❌ | ya viene |
| PR con hyperlink OSC 8 | ✅ | ❌ | ya viene |
| cwd abreviado · título de terminal | ✅ | ❌ | ya viene |
| **ventanas rate limit 5h/7d** | ❌ | ✅ | ver D3 |

Detalle bueno del `tok/s` de Ben: descuenta el primer delta y las tool calls
(`model-info:169-190`) para no inflar la cifra.

### Trabajo a hacer

1. **Elapsed de sesión** en `model-info` → añadir al state que ya se publica (~10 líneas).
   En Claude Code venía servido en `cost.total_duration_ms`; Pi no lo calcula.
2. **Semáforo de color** en la barra de contexto (≥90% rojo, ≥70% amarillo), portado de
   `statusline.mjs:47-51`.

## D3 — Ventanas de rate limit 5h/7d: ahora SÍ son portables

`rateLimitSegment` (`statusline.mjs:58-63`, rojo a ≥80%) lee `data.rate_limits.five_hour` /
`.seven_day`. Eso lo entrega la API de Anthropic **con suscripción**.

En la versión enterprise esto era imposible (el gateway cobra por token, no hay ventana que
reportar). **Aquí uso suscripción → el dato existe.** Y con suscripción es justo el segmento más
útil: no me interesa el costo en dólares, me interesa cuánto me queda de la ventana.

⚠️ **Sin verificar:** hay que confirmar que Pi expone los headers de rate limit al hacer login
OAuth. Si `dashboard-state` no los trae, hay que ver si el cliente los descarta.

**Prioridad:** más alto que el costo en dólares, por lo mismo de arriba.

## Costo en dólares: casi irrelevante con suscripción

`rg -i cost extensions/subagents/src/**` → **cero hits**. Los subagents solo emiten
`UsageChanged` con `tokens` y `contextWindow` (`backends/pi.ts:356-361`, `domain.ts:178-204`),
**nunca costo**.

Con suscripción esto deja de importar: el costo marginal es cero, y el segmento `$` mostraría
un número que no pago. **Se deja como viene** y no se invierte trabajo en arreglarlo.

Si algún día añado un proveedor de pago por uso (API key de OpenAI, ver
[ADR-001](ADR-001-providers.md) D2), entonces sí conviene llenar `cost` en `models.json` —
por millón de tokens, y el statusline del hilo principal y de los subagents `pi` sale solo:

```json
"cost": { "input": 5, "output": 30, "cacheRead": 0.5, "cacheWrite": 6.25 }
```

## Objetivo visual

```
[sonnet · medium] │ ███████░░░ 69% │ 5h: 34% │ 41m 41s │ 42 tok/s
main · 3 files changed
```
