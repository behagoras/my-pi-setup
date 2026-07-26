/**
 * The Activity Dock: one list of everything running, below the editor.
 *
 * Workflows, subagents, and background terminals each already had a status
 * line and a command, so knowing what was running meant remembering which
 * command to type. The dock puts them in one place and makes them reachable
 * with Down, the way the rest of the TUI is reachable with a key.
 *
 * It owns no activity data and renders no detail view. Producers publish on
 * ACTIVITY_CHANNEL and each activity names the command that opens it, which the
 * dock submits like any typed command (see activity-registry.ts).
 */

import {
  CustomEditor,
  type ExtensionAPI,
  type ExtensionContext,
  type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import {
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";
import {
  ACTIVITY_CHANNEL,
  type Activity,
  type ActivityListEvent,
  type ActivityState,
} from "../shared/activity-registry.ts";
import { DockModel } from "./dock-model.ts";

const SQUARE = "■";

const STATE_COLOR: Record<ActivityState, "warning" | "success" | "error"> = {
  running: "warning",
  done: "success",
  failed: "error",
};

function isActivityListEvent(value: unknown): value is ActivityListEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ActivityListEvent>;
  return (
    typeof candidate.source === "string" && Array.isArray(candidate.activities)
  );
}

export default function (pi: ExtensionAPI) {
  const model = new DockModel();
  let activeTui: TUI | undefined;

  const stopListening = pi.events.on(ACTIVITY_CHANNEL, (value) => {
    if (!isActivityListEvent(value)) return;
    model.replace(value.source, value.activities);
    activeTui?.requestRender();
  });

  pi.on("session_shutdown", () => {
    stopListening();
    activeTui = undefined;
  });

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    // Headless runs (`pi -p`) have no editor to dock anything below.
    if (!ctx.hasUI || ctx.mode !== "tui") return;
    const previous = ctx.ui.getEditorComponent();

    const renderRow = (activity: Activity, index: number, width: number) => {
      const thm = ctx.ui.theme;
      const selected = model.isFocused && index === model.selectedIndex;
      const marker = selected ? thm.fg("accent", "▸ ") : "  ";
      const dot = thm.fg(STATE_COLOR[activity.state], SQUARE);
      const source = thm.fg("muted", activity.source.padEnd(9));
      const detail = activity.detail
        ? thm.fg("dim", ` ${activity.detail}`)
        : "";

      // The title absorbs whatever width the fixed columns leave.
      const fixed = visibleWidth(`  ${SQUARE} ${activity.source.padEnd(9)} `);
      const detailWidth = visibleWidth(detail);
      const titleWidth = Math.max(8, width - fixed - detailWidth - 1);
      const title = truncateToWidth(activity.title, titleWidth, "…");
      const titleText = selected ? thm.fg("accent", title) : title;

      return `${marker}${dot} ${source} ${titleText}${detail}`;
    };

    class ActivityDockEditor extends CustomEditor {
      constructor(
        tui: TUI,
        theme: EditorTheme,
        keybindings: KeybindingsManager,
      ) {
        super(tui, theme, keybindings);
        activeTui = tui;
      }

      render(width: number): string[] {
        const lines = super.render(width);
        if (model.isEmpty) return lines;

        const thm = ctx.ui.theme;
        const hint = model.isFocused
          ? thm.fg("dim", "↑↓ select · enter open · esc back")
          : thm.fg("dim", "↓ activity");
        lines.push(thm.fg("muted", "activity ") + hint);
        model.visible.forEach((activity, index) => {
          lines.push(renderRow(activity, index, width));
        });
        if (model.hiddenCount > 0) {
          lines.push(thm.fg("dim", `  +${model.hiddenCount} more`));
        }
        return lines;
      }

      handleInput(data: string): void {
        const isDown = matchesKey(data, "down");
        const isUp = matchesKey(data, "up");

        if (model.isFocused) {
          if (matchesKey(data, "escape")) {
            model.blur();
            this.tuiRender();
            return;
          }
          if (matchesKey(data, "return") || matchesKey(data, "enter")) {
            const command = model.selected?.openCommand;
            model.blur();
            this.tuiRender();
            // Submitted like a typed command: the owning extension opens its
            // own view, and the user sees what the shortcut stands for.
            if (command) {
              const restore = this.getText();
              this.setText("");
              this.onSubmit?.(command);
              if (restore) this.setText(restore);
            }
            return;
          }
          if (isDown || isUp) {
            // Up past the first row hands the prompt back, so the dock is a
            // continuation of the editor rather than a trap.
            if (!model.move(isDown ? 1 : -1)) model.blur();
            this.tuiRender();
            return;
          }
          // Any other key means the user is done browsing and wants to type.
          model.blur();
          this.tuiRender();
          super.handleInput(data);
          return;
        }

        if (isDown && model.shouldOpenOnDown(this.getText())) {
          model.focus();
          this.tuiRender();
          return;
        }

        model.noteVerticalKey(isDown || isUp);
        super.handleInput(data);
      }

      private tuiRender() {
        activeTui?.requestRender();
      }
    }

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
      // Composes with any editor another extension already installed.
      void previous;
      return new ActivityDockEditor(tui, theme, keybindings);
    });
  });
}
