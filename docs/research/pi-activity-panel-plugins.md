# Pi background-activity navigation extensions

Research date: 2026-07-26. Sources are limited to official Pi docs/examples, first-party GitHub repositories, and npm metadata/readmes.

## Conclusion

**An exact public match exists for subagents:** [`@tintinweb/pi-subagents`](https://www.npmjs.com/package/@tintinweb/pi-subagents) provides **FleetView**, a Claude Code-style list below the editor. At an **empty prompt**, plain `↓` (or `←`) moves focus into active subagents; `↑`/`↓` selects one and `Enter` opens its live conversation. This is the closest ready-made implementation and the recommended first trial.

For general shell/background jobs, [`pi-background-tasks`](https://www.npmjs.com/package/pi-background-tasks) is a near match: `Shift+Down` opens a focused task dock, rather than plain Down. No verified package found in this search combines workflows, subagents, and arbitrary processes behind one plain-Down activity panel.

## Exact match

### `@tintinweb/pi-subagents` — FleetView

- **Package/source:** [npm](https://www.npmjs.com/package/@tintinweb/pi-subagents), [GitHub](https://github.com/tintinweb/pi-subagents)
- **Evidence:** The first-party [README’s FleetView section](https://github.com/tintinweb/pi-subagents#fleetview) states that the list renders below the editor and that, at an empty prompt, `↓`/`←` transfers focus from the prompt; arrows navigate and `Enter` opens the live conversation. The [implementation](https://github.com/tintinweb/pi-subagents/blob/main/src/ui/fleet-list.ts) contains the focusable fleet list, while [settings/source integration](https://github.com/tintinweb/pi-subagents/blob/main/src/index.ts) labels it “Claude Code-style” and allows it to be toggled.
- **Scope:** Main session plus running subagents, including live viewing/steering. It is not a unified browser for unrelated shell jobs or this repo’s workflow abstraction.
- **Assessment:** **Exact behavioral match** for the requested editor-to-background-subagent navigation.

## Close match

### `pi-background-tasks` — focused footer dock

- **Package/source:** [npm](https://www.npmjs.com/package/pi-background-tasks), [GitHub](https://github.com/ismailsaleekh/pi-background-tasks)
- **Evidence:** Its [README](https://github.com/ismailsaleekh/pi-background-tasks#footer-dock-ux) documents `Shift+Down` opening a focused bottom dock, then arrows selecting tasks and `Enter`/Right inspecting details. The source [registers `shift+down`](https://github.com/ismailsaleekh/pi-background-tasks/blob/main/src/extension.ts) and the repository includes [PTY coverage](https://github.com/ismailsaleekh/pi-background-tasks/blob/main/tests/pty/pty.test.ts) for the shortcut.
- **Scope:** Named background shell jobs, including agent-marked child Pi processes, logs, status, telemetry, rerun, and kill.
- **Assessment:** **Close, not exact:** it uses `Shift+Down`, not plain Down, and owns only tasks started through its APIs.

## Partial building blocks

### `@aliou/pi-processes` — process panel and log dock

- **Package/source:** [npm](https://www.npmjs.com/package/@aliou/pi-processes), [GitHub](https://github.com/aliou/pi-processes)
- **Evidence:** The [README](https://github.com/aliou/pi-processes#open-the-process-panel) opens the process manager with `/ps`; arrows or `j/k` navigate after it is open. It also supplies a persistent log dock and `/ps:logs` overlay. Its [default dock keybindings](https://github.com/aliou/pi-processes/blob/main/src/utils/keybindings.ts) leave the global dock toggle disabled because of editor conflicts.
- **Assessment:** **Partial:** strong process management/dashboard UI, but no verified plain-Down handoff from the editor.

### `@monopi/background-tasks` — shortcut dashboard

- **Package/source:** [npm](https://www.npmjs.com/package/@monopi/background-tasks), [GitHub monorepo](https://github.com/ifiokjr/oh-pi/tree/main/packages/monopi__background-tasks)
- **Evidence:** The package [README](https://github.com/ifiokjr/oh-pi/tree/main/packages/monopi__background-tasks) describes a `Ctrl+Shift+B` multi-pane dashboard with task list and logs; [source](https://github.com/ifiokjr/oh-pi/blob/main/packages/monopi__background-tasks/index.ts) registers that shortcut and implements arrow navigation inside the dashboard.
- **Assessment:** **Partial:** dashboard and status widget, but a dedicated chord rather than Down-from-editor navigation.

### `pi-kanban` — external observability dashboard

- **Package/source:** [npm](https://www.npmjs.com/package/pi-kanban), [GitHub](https://github.com/NikiforovAll/pi-kanban)
- **Evidence:** The [README](https://github.com/NikiforovAll/pi-kanban) identifies it as a web dashboard for sessions, todos, and subagents; its [user guide](https://github.com/NikiforovAll/pi-kanban/blob/main/docs/user-guide.md) describes browser/PWA navigation and `/kanban` commands.
- **Assessment:** **Partial:** broad observability, but outside Pi’s editor/TUI focus chain.

### Official Pi primitives and example

- Pi officially supports [custom editor wrappers, shortcuts, widgets, footers, overlays, and focus handles](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/extensions.md). The [TUI docs](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/tui.md) show custom editors and overlay focus; the [keybinding docs](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/keybindings.md) identify plain Down as `tui.editor.cursorDown` by default.
- Pi’s official [subagent example](https://github.com/earendil-works/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent) streams single/parallel/chain progress inline and expands with `Ctrl+O`, but does not provide a separate Down-focus activity panel.
- **Assessment:** implementation building blocks, not an existing exact plugin.

## Adoption recommendation

1. **Trial `@tintinweb/pi-subagents` first** if subagent navigation is the primary need; FleetView already matches the requested interaction.
2. If shell jobs are equally important, evaluate `pi-background-tasks` alongside it, but check shortcut/editor-widget compatibility before adopting both.
3. For a single panel spanning workflows + subagents + processes, reuse the FleetView interaction pattern rather than starting from Pi’s basic status/footer examples. A small integration layer would still be required because the verified packages maintain separate activity registries.

## Search limits

The ecosystem is decentralized, and GitHub/npm search cannot prove that no unindexed or private extension exists. The conclusion is therefore “best verified public match found,” not an exhaustive nonexistence claim. Candidate behavior above was checked against package metadata and repository readmes/source; unverified names or behaviors from search output were excluded.
