When working in typescript:

- when adding a package to a project add it with an install command, instead of manually editing the package json
- run check/format/lint commands when your done making a change. if they don't exist, suggest making them for the project you're in
- avoid explicit return types unless absolutely needed
- `as any` should be an absolute last resort. always use real type safety. lean on type inference instead of manually writing new types over and over again

When working in svelte(kit):

- use modern svelte practices, reference the svelte best practicies skill when writing .svelte file code

In general:

- when asking questions, ask them one at a time

## Model Routing & Effort Levels (Personal Setup)

- Primary Provider: Claude via `/login` OAuth subscription (zero marginal token cost).
- Main thread / default: `sonnet` (effort: `medium`).
- Fast search / grep / summary: `sonnet` (effort: `minimal`).
- Architecture / complex debugging / code review: `opus` (effort: `high`).
- Research / Web Search: spawn subagent using `harness: "claude"` (uses Claude Code's native WebSearch).
- Valid reasoning efforts: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.
- Subagent harness grammar:
  - `pi` -> `"provider/model-id"` + reasoningEffort
  - `claude` -> `"opus"` or `"sonnet"`
  - `codex` -> OpenAI model ID
  - Always be explicit about `model` and `reasoningEffort` when spawning subagents (max 4 running simultaneously).

