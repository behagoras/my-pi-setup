---
status: accepted
---

# Workflow agents cannot use extension-registered providers

Workflow agents run as headless child sessions in the same process, and `@vanillagreen/pi-claude-bridge` deliberately registers its provider only from the primary instance (`src/index.ts`: "Non-primary instances (subagents) always decide noop and touch nothing") so a child cannot corrupt the parent's tool pairing. A child therefore can never resolve a `claude-bridge/*` model, including one inherited from the interactive session. Agents that inherit such a model now fail immediately with an actionable error telling the script to pass an explicit `model`, instead of stalling for 45 seconds.

## Consequences

A future `harness: "claude"` for workflows must use the Claude Agent SDK backend, as `extensions/subagents/src/backends/claude.ts` does; routing it through the bridge provider is not possible. Child sessions also use ephemeral settings storage, because `setModel`/`setThinkingLevel` otherwise persist and let a workflow agent rewrite the user's `defaultModel`.
