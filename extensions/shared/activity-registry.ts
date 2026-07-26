/**
 * The contract between activity producers and the Activity Dock.
 *
 * Workflows, subagents, and background terminals each own work that outlives a
 * single turn. The dock shows them in one list below the editor, but it never
 * reaches into their internals: producers publish their activities on
 * `ACTIVITY_CHANNEL`, and each activity names the command that opens it.
 *
 * The dock submits that command rather than calling a producer back, because
 * the views live behind `ExtensionCommandContext`, whose methods Pi documents
 * as command-only: calling them from an event handler can deadlock. Submitting
 * the command also keeps the dock a shortcut for something the user could type,
 * with the same visible result.
 */

/** Producers publish their full current list; the dock replaces per source. */
export const ACTIVITY_CHANNEL = "activity:list";

export type ActivitySource = "workflows" | "subagents" | "terminals";

export type ActivityState = "running" | "done" | "failed";

export interface Activity {
  /** Unique within its source; echoed back verbatim when opening. */
  id: string;
  source: ActivitySource;
  title: string;
  state: ActivityState;
  /** Short right-hand detail, e.g. "2/3 agents" or elapsed time. */
  detail?: string;
  /** Sort key so the dock can show the most recent first. */
  startedAt: number;
  /**
   * Slash command the dock submits to open this activity, e.g.
   * `/workflows wf_1a2b`. Omit when the activity has no view.
   */
  openCommand?: string;
}

/** A producer's complete current list, replacing whatever it published before. */
export interface ActivityListEvent {
  source: ActivitySource;
  activities: Activity[];
}

/** Ordering shared by the dock and its tests: running first, then newest. */
export function compareActivities(a: Activity, b: Activity) {
  if (a.state !== b.state) {
    if (a.state === "running") return -1;
    if (b.state === "running") return 1;
  }
  return b.startedAt - a.startedAt;
}
