import assert from "node:assert/strict";
import { test } from "node:test";
import type { Activity } from "../shared/activity-registry.ts";
import { DockModel, MAX_VISIBLE } from "./dock-model.ts";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a1",
    source: "workflows",
    title: "review",
    state: "running",
    startedAt: 1,
    ...overrides,
  };
}

test("Down opens the dock only from a resting, empty prompt", () => {
  const model = new DockModel();
  model.replace("workflows", [activity()]);

  assert.equal(model.shouldOpenOnDown(""), true);
  assert.equal(
    model.shouldOpenOnDown("some text"),
    false,
    "text in the editor means Down is editing, not browsing",
  );
});

test("Down stays with history once the user has pressed an arrow", () => {
  const model = new DockModel();
  model.replace("workflows", [activity()]);

  model.noteVerticalKey(true);
  assert.equal(model.shouldOpenOnDown(""), false);

  model.noteVerticalKey(false);
  assert.equal(model.shouldOpenOnDown(""), true);
});

test("Down does nothing special when there is no activity to show", () => {
  const model = new DockModel();
  assert.equal(model.shouldOpenOnDown(""), false);
});

test("running activities sort above finished ones, newest first", () => {
  const model = new DockModel();
  model.replace("workflows", [
    activity({ id: "old-run", state: "running", startedAt: 10 }),
    activity({ id: "done", state: "done", startedAt: 30 }),
    activity({ id: "new-run", state: "running", startedAt: 20 }),
  ]);

  assert.deepEqual(
    model.activities.map((entry) => entry.id),
    ["new-run", "old-run", "done"],
  );
});

test("each source replaces only its own activities", () => {
  const model = new DockModel();
  model.replace("workflows", [activity({ id: "w1" })]);
  model.replace("subagents", [activity({ id: "s1", source: "subagents" })]);
  model.replace("workflows", []);

  assert.deepEqual(
    model.activities.map((entry) => entry.id),
    ["s1"],
  );
});

test("Up past the first row returns to the editor", () => {
  const model = new DockModel();
  model.replace("workflows", [activity({ id: "a" }), activity({ id: "b" })]);
  model.focus();

  assert.equal(model.move(1), true);
  assert.equal(model.selectedIndex, 1);
  assert.equal(model.move(-1), true);
  assert.equal(model.move(-1), false, "Up at the top hands focus back");
});

test("Down stops at the last row instead of wrapping", () => {
  const model = new DockModel();
  model.replace("workflows", [activity({ id: "a" }), activity({ id: "b" })]);
  model.focus();

  model.move(1);
  model.move(1);
  assert.equal(model.selectedIndex, 1);
  assert.equal(model.selected?.id, "b");
});

test("overflow is counted rather than rendered", () => {
  const model = new DockModel();
  model.replace(
    "workflows",
    Array.from({ length: MAX_VISIBLE + 3 }, (_, index) =>
      activity({ id: `a${index}`, startedAt: index }),
    ),
  );

  assert.equal(model.visible.length, MAX_VISIBLE);
  assert.equal(model.hiddenCount, 3);
});

test("losing every activity releases focus so keys reach the editor", () => {
  const model = new DockModel();
  model.replace("workflows", [activity()]);
  model.focus();
  assert.equal(model.isFocused, true);

  model.replace("workflows", []);
  assert.equal(model.isFocused, false);
  assert.equal(model.selected, undefined);
});

test("a shrinking list keeps the selection in range", () => {
  const model = new DockModel();
  model.replace("workflows", [
    activity({ id: "a", startedAt: 3 }),
    activity({ id: "b", startedAt: 2 }),
    activity({ id: "c", startedAt: 1 }),
  ]);
  model.focus();
  model.move(1);
  model.move(1);
  assert.equal(model.selectedIndex, 2);

  model.replace("workflows", [activity({ id: "a", startedAt: 3 })]);
  assert.equal(model.selectedIndex, 0);
  assert.equal(model.selected?.id, "a");
});
