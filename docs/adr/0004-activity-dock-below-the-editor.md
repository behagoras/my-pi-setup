---
status: accepted
---

# One dock below the editor, reachable with Down

Workflows, subagents, and background terminals each had a status line and a command, so knowing what was running meant remembering which of `/workflows`, `/subagents`, or `/ps` to type. The Activity Dock lists all three below the editor and opens any of them with Down, Enter.

It is a `CustomEditor` (`ctx.ui.setEditorComponent`) because that is the only slot that both renders below the editor and receives keys — `setFooter` and `setWidget` render but cannot handle input. The slot was unclaimed; `ui-customization` owns the footer.

Producers publish their list on `ACTIVITY_CHANNEL` and each activity names the command that opens it. The dock submits that command instead of calling the producer back, because those views need an `ExtensionCommandContext`, whose methods Pi documents as command-only: _"only available in commands because they can deadlock if called from event handlers."_ Submitting also keeps the dock a shortcut for something the user could type.

Down opens the dock only from an empty prompt when the previous key was not an arrow. The editor's history state is private, so the dock tracks arrows itself to avoid stealing Down from history navigation. With no activities, Down always falls through.

## Consequences

Only workflows open a specific item; `/subagents` and `/ps` open their pickers, since neither command takes an id. Another extension replacing the editor component would displace the dock — it composes by wrapping, not by coexisting. The dock lists finished activities until their producer drops them, so a failed run stays visible rather than vanishing on completion.
