# Notas del video de Ben Davis

**Fuente:** [I Created the Ultimate Coding Agent by Combining Pi, Codex, and Claude Code](https://www.youtube.com/watch?v=5Qu2SkSQeBU) · Ben Davis
**Repo del que sale este fork:** [`davis7dotsh/my-pi-setup`](https://github.com/davis7dotsh/my-pi-setup)

De aquí salió la idea de este setup. Guardo el resumen para no volver a ver el video.

## La tesis: Pi es un arnés mínimo, tú lo construyes

Pi presume de **lo que NO trae**: sin MCP, sin subagentes, sin cuadros de permisos, sin modo plan.
El núcleo son **4 herramientas primitivas**, un system prompt compacto y una TUI ágil. Todo lo
demás son extensiones TypeScript (globales en `~/.pi/agent/` o por proyecto).

Consecuencia práctica: `/customize-pi` — le pides al modelo que escriba o modifique una extensión,
y la documentación de Pi ya está en su system prompt. El agente se extiende a sí mismo.

## Los comandos que importan

| Comando | Qué hace |
|---|---|
| `/subagents` | Panel interactivo de subagentes en paralelo |
| `/workflows` | Fases del pipeline activo, navegación Vim |
| `/ps` | Terminales en background: ver `stdout`/`stderr`, `X` para matar |
| `/copyall` | Todo el historial al clipboard (para pasarlo a otro agente) |
| `/btw` | Dispara un subagente de investigación paralela sin interrumpir el hilo |
| `/customize-pi` | Pídele al modelo que modifique sus propias extensiones |
| `fd` / `rg` | Búsqueda de archivos y texto como tools de primera clase |

## Orquestación híbrida: un modelo por fortaleza

Su patrón central. Pi es el orquestador; cada subagente corre en el arnés que le va mejor:

- **Codex** (`GPT-5.6 Saul`, razonamiento alto) → *computer use* (navegador, dashboards, móvil) y
  trabajo pesado continuo.
- **Claude Code SDK** (`Fable 5`) → arquitectura, planeación, redacción, release prep.
- **Pi nativo** → tareas rápidas e incrementales, hereda config del padre.

> Nota legal que él subraya: usar la *suscripción* de Claude Code dentro de otro arnés puede violar
> los ToS; usar el **SDK oficial** es la vía legítima. Es exactamente lo que hace su backend
> `subagents/src/backends/claude.ts`.

## Workflows: pipelines con schemas estrictos

Inspirado en los dynamic workflows de Claude Code. Fases jerárquicas:

1. **Reconocimiento** — varios agentes en paralelo sobre arquitectura, CLI, UX, fiabilidad.
2. **Revisión cruzada** — agentes con roles (Staff Engineer, Maintainer, Release Reviewer)
   examinan los hallazgos de la fase 1.
3. **Síntesis** — consolida todo en un reporte ejecutable para el hilo principal.

Cuando arranca un workflow, el modelo **escribe un script JS ejecutable** que instancia las fases,
define schemas de entrada/salida y asigna modelos.

> El punto crítico: los **schemas entre fases tienen que ser estrictos**. Si el output de
> investigación no valida los tipos que consume la implementación, el contexto se degrada.

## Effect v4 para el código de extensiones

Lo que un LLM escribe de primeras para una extensión compleja sale frágil: `try/catch` anidados,
generadores mezclados con `async/await`. Su receta:

1. Reemplazar `node:fs` nativo por los servicios de `@effect/platform` (`HttpClient`, `FileSystem`).
2. Encapsular máquinas de estado e I/O en `Effect.gen`.
3. **Arreglar UNA función a mano** y pasársela al agente como implementación de referencia →
   el agente hace pattern matching y refactoriza el resto homogéneamente.

Ese paso 3 es la idea reutilizable: no corriges línea por línea, corriges el patrón una vez.

## Su infraestructura remota — no aplica para mí

Tailscale + servidor Linux headless + T3 Code web UI para correr jobs de 8-10 horas sin depender
de la laptop. Más `gpile review` (Greptile T-Rex) para revisar PRs localmente ejecutando el código.

**Fuera de alcance de este repo.** Lo anoto porque es la mitad del video, pero yo no corro jobs de
10 horas ni tengo servidor con GPU.

## Qué me llevo y qué no

| Del video | Lo tomo |
|---|---|
| Extensiones (subagents, workflows, ps, copyall, file-search, statusline) | ✅ es el fork |
| Orquestación híbrida por fortaleza del modelo | ✅ adaptado — ver [ADR-001](ADR-001-providers.md) |
| Firecrawl para web search | ⚠️ inerte — ver [ADR-002](ADR-002-research.md) |
| Effect v4 en extensiones | 🤔 solo si escribo extensiones propias |
| Tailscale + T3 Code + servidor headless | ❌ fuera de alcance |
| Greptile / `gpile review` | ❌ no lo pago |
| Tokyo Night | ❌ me quedo con `github-dark-default` |
