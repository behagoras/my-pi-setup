# Pi Activity Navigation

This context defines how users discover and inspect concurrent background work from Pi’s interactive interface.

## Language

**Activity Panel**:
A unified interactive view of currently active background work, including workflows, subagents, and background terminals.
_Avoid_: Workflow panel, task list, background drawer

**Activity Dock**:
The compact, persistent representation of the Activity Panel shown below the editor whenever activities exist.
_Avoid_: Status bar, footer counter, task widget

**Activity**:
One currently active workflow, subagent, or background terminal represented in the Activity Panel.
_Avoid_: Task, job, process

**Editor Focus**:
The interaction state in which keyboard input belongs to the prompt editor rather than the Activity Dock.
_Avoid_: Main focus, normal mode

**Activity Focus**:
The interaction state in which keyboard input navigates the Activity Dock rather than editing the prompt.
_Avoid_: Dock mode, task selection

**Claude Bridge Provider**:
A selectable Pi model provider that uses a Claude Code session as the conversational engine while Pi remains the interface and sole tool executor.
_Avoid_: Claude mode, Claude subagent, Anthropic provider

**Claude Conversation**:
The Claude Code session associated with exactly one branch of a Pi session while a Claude Bridge Provider is selected.
_Avoid_: Claude process, shared Claude session, takeover

**Mixed-Harness Workflow**:
A workflow whose agents explicitly select different execution harnesses; agents without a harness selection use Pi.
_Avoid_: Hybrid workflow, multi-model workflow

**Scoped Models Snapshot Patch**:
A temporary, explicitly applied compatibility patch that makes Pi's native `/scoped-models` selector read the model availability snapshot populated at startup instead of waiting on a new unbounded runtime refresh.
_Avoid_: Activity Dock fix, model selector extension, offline mode
