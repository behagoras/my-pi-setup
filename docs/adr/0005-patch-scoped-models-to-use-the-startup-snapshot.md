# ADR 0005: Patch `/scoped-models` to use the startup snapshot

- Status: Accepted (temporary compatibility patch)
- Date: 2026-07-26

## Context

In Pi 0.82.1, `/scoped-models` accepted submission but mounted no UI. A clean `pi -ne` reproduction ruled out extensions and packages: `/model` opened while `/scoped-models` remained blank. Instrumentation localized the wait to `modelRuntime.refresh()`. The selector opened with `PI_OFFLINE=1`, and it also opened when fed the availability snapshot populated during startup.

The native command performs an unbounded refresh before mounting the selector. That refresh includes remote catalog and provider availability work and has no command-level abort or timeout. A pending provider operation therefore leaves the editor submit handler unresolved indefinitely.

## Decision

Until upstream Pi fixes the lifecycle, maintain an explicit, guarded setup script that changes `showModelsSelector()` to read `modelRuntime.getAvailableSnapshot()` instead of awaiting a new refresh.

The script must verify the package identity and exact source shape, be idempotent, create a backup, write atomically, support restoration, and refuse unknown source. The patch is applied deliberately after Pi installation or upgrades; it is not an extension and does not silently mutate Pi during startup.

## Consequences

The selector opens immediately using the same availability state established at startup. It may not include model catalog changes made after startup; users can restart Pi after changing provider or model configuration. Pi upgrades can remove or invalidate the patch, so setup verification must be rerun after upgrades. Once upstream ships a bounded/nonblocking implementation, this script and ADR should be retired.
