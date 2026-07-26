/**
 * Dock state, kept free of TUI and event-bus concerns so the interaction rules
 * can be tested directly: which activities are listed, where the selection is,
 * and whether Down should open the dock or fall through to the editor.
 */

import {
  compareActivities,
  type Activity,
  type ActivitySource,
} from "../shared/activity-registry.ts";

/** More than this and the dock would crowd the editor; the rest are counted. */
export const MAX_VISIBLE = 5;

export class DockModel {
  private bySource = new Map<ActivitySource, Activity[]>();
  private selection = 0;
  private focused = false;
  /**
   * Down only opens the dock from a resting prompt. After Up or Down the user
   * is navigating history, where Down must stay history-forward. The editor's
   * history state is private, so arrow keys are tracked here instead.
   */
  private lastKeyWasVertical = false;

  replace(source: ActivitySource, activities: Activity[]) {
    if (activities.length === 0) this.bySource.delete(source);
    else this.bySource.set(source, activities);
    this.clampSelection();
  }

  get activities(): Activity[] {
    return [...this.bySource.values()].flat().sort(compareActivities);
  }

  get visible() {
    return this.activities.slice(0, MAX_VISIBLE);
  }

  get hiddenCount() {
    return Math.max(0, this.activities.length - MAX_VISIBLE);
  }

  get isEmpty() {
    return this.activities.length === 0;
  }

  get isFocused() {
    return this.focused;
  }

  get selectedIndex() {
    return this.selection;
  }

  get selected(): Activity | undefined {
    return this.visible[this.selection];
  }

  /** Whether Down should move focus into the dock rather than edit text. */
  shouldOpenOnDown(editorText: string) {
    return !this.isEmpty && editorText === "" && !this.lastKeyWasVertical;
  }

  noteVerticalKey(isVertical: boolean) {
    this.lastKeyWasVertical = isVertical;
  }

  focus() {
    this.focused = true;
    this.selection = 0;
    this.lastKeyWasVertical = false;
  }

  blur() {
    this.focused = false;
    this.lastKeyWasVertical = false;
  }

  /** Move the selection; returns false when Up leaves the dock upward. */
  move(delta: number) {
    const next = this.selection + delta;
    if (next < 0) return false;
    this.selection = Math.min(next, Math.max(0, this.visible.length - 1));
    return true;
  }

  private clampSelection() {
    const max = Math.max(0, this.visible.length - 1);
    if (this.selection > max) this.selection = max;
    if (this.isEmpty) this.focused = false;
  }
}
