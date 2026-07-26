---
status: accepted
---

# Workflow agents get a Claude harness of their own

`agent()` now takes `harness: "pi" | "claude"`, defaulting to `pi`. Claude models were the one runtime a workflow agent could not reach: they are unavailable to Pi child sessions ([[0002]]), and the interactive `subagents` extension that can reach them is an isolated package built on Effect, exposing live sessions with `send`, `interrupt`, and `takeover`. Workflow agents are one-shot, so reusing those backends meant importing `effect@4-beta` across a package boundary and adapting a streaming session into a single call. Instead `extensions/workflows/claude-harness.ts` consumes the Claude Agent SDK's `query()` generator directly with plain async/await.

`codex` is deliberately not a harness: `model: "openai-codex/gpt-5.6-sol"` already runs in workflow children, so it would be new code for reachable capability.

## Consequences

Claude agents run Claude's own tools rather than Pi's under `childToolPolicy`. "Pi is the sole tool executor" governs the main conversation, not an agent that is itself a Claude agent. Claude also has no structured-output tool, so a `schema` is stated in the prompt and the reply is parsed as JSON; unparseable replies fail loudly instead of yielding a guessed object. Some SDK setup is now duplicated between this module and `extensions/subagents/src/backends/claude.ts`, which is the accepted cost of keeping the two concurrency models apart.
