---
status: accepted
---

# Use a pinned Claude Bridge Provider

Use `@vanillagreen/pi-claude-bridge@1.9.0` as a selectable Pi provider so the user's authenticated Claude subscription can drive the main conversation while Pi remains the interface and sole tool executor. Pin the exact version, keep optional Claude-side connectors disabled, and associate one Claude Conversation with each Pi branch; this preserves Pi's tool lifecycle and branch semantics while avoiding the compatibility and isolation problems found in the other evaluated bridges.

## Consequences

Claude may invoke only tools exposed and executed by Pi, including custom tools such as `workflow`. Subscription-backed Agent SDK usage is policy-sensitive and must be rechecked before upgrades or use beyond this personal machine.
