# Claude harnesses as Pi's main chat driver

**Checked:** 2026-07-26. **Scope:** a narrow review of official Pi pages/source, package GitHub repositories and npm metadata, and official Anthropic documentation.

## Conclusion

**Yes—public exact matches exist.** The clearest is [`@vanillagreen/pi-claude-bridge`](https://pi.dev/packages/%40vanillagreen/pi-claude-bridge): its package page says it runs Claude Code as a Pi provider, adds `claude-bridge/*` models to Pi's model selector, retains Pi's tools and TUI, and uses OAuth subscription authentication without an API key. Its [pinned implementation](https://github.com/vanillagreencom/vstack/blob/adafe69157c410f05148cdedd8c6268633a3c72f/pi-extensions/pi-claude-bridge/src/index.ts) registers a custom provider, presents active Pi tools to the Claude Agent SDK through an in-process MCP bridge, waits for real Pi tool results, records the Claude session ID, and resumes it on later turns. This is a persistent *logical Claude session*; the SDK query stays live during a tool round-trip but is resumed, rather than kept as one immortal process, between top-level turns.

A second exact match is [`pi-o-my`'s `custom-provider-claude-agent-sdk`](https://github.com/joshuadavidthomas/pi-o-my/tree/06ad41a445ce93ea70bf6d315501c35c32992714/extensions/custom-provider-claude-agent-sdk). Its [README](https://github.com/joshuadavidthomas/pi-o-my/blob/06ad41a445ce93ea70bf6d315501c35c32992714/README.md) describes one live SDK query per Pi session/branch, an MCP bridge exposing Pi tools, and Pi retaining execution, rendering, hooks, and session recording. This is the stronger match if “persistent” strictly means a continuously live query. It delegates login to Claude Code and its source removes `ANTHROPIC_API_KEY` from the child environment.

[`rchern/pi-claude-cli`](https://github.com/rchern/pi-claude-cli) is another exact-pattern implementation: it registers the authenticated local `claude` CLI as Pi's provider, resumes its session across turns, and exposes Pi tools over MCP while Pi remains the UI and executor.

The earlier [`pi-claude-bridge`](https://pi.dev/packages/pi-claude-bridge) also has an exact-match **provider mode** (Claude drives the main Pi chat and Pi executes tools). Its separate `AskClaude` tool is only **subagent delegation**: another model still drives the main chat. Likewise, transcript handoff, Claude peers, tmux controllers, and embedded ACP sessions do not qualify merely because their UI is reachable from Pi.

## Important distinctions

- **Exact match:** a Pi custom provider uses Claude Code/Agent SDK for the ordinary main conversation and bridges Claude tool calls into Pi's tool lifecycle. Pi officially exposes the required extension primitives through `registerProvider`, custom `streamSimple`, and tool APIs ([Pi extension docs](https://pi.dev/docs/latest/extensions)).
- **Native Anthropic provider:** Pi's built-in `anthropic/*` provider runs Pi's own agent loop against Anthropic Messages; it is not Claude Code or the Agent SDK. Pi currently warns that its Claude Pro/Max subscription auth for third-party harness use is extra usage billed per token, not plan usage ([Pi provider docs](https://pi.dev/docs/latest/providers)).
- **Auth caveat:** Claude Code itself supports Claude.ai Pro/Max login ([Anthropic authentication docs](https://docs.anthropic.com/en/docs/claude-code/iam)), but Anthropic's Agent SDK docs say third-party developers may not offer claude.ai login/rate limits unless approved and otherwise direct developers to API-key authentication ([Agent SDK overview](https://docs.anthropic.com/en/docs/claude-code/sdk)). Package claims about subscription billing are therefore policy-sensitive and should be rechecked before adoption.

## Mixed Pi/Claude harness workflows

Yes, but separately from main-chat takeover. [`@kky42/pi-flow`](https://pi.dev/packages/%40kky42/pi-flow) keeps Pi as coordinator/TUI while workflow agents can independently select `pi`, `claude`, or `codex` backends, including mixed backends in one workflow and persistent conversations via `session_key`. This is mixed harness delegation, not Claude takeover of Pi's main chat. [`smithers`](https://github.com/smithersai/smithers/blob/7884b11424bf6f943edb0f975768ca6a44916326/README.md) also demonstrates mixed workflow runtimes; its [`parallel-tickets.jsx`](https://github.com/smithersai/smithers/blob/7884b11424bf6f943edb0f975768ca6a44916326/examples/parallel-tickets.jsx) assigns Claude Code nodes and a Pi review node.

These are third-party, full-trust Pi extensions; pin and review a version before installing.
