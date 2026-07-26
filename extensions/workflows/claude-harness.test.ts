import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseStructuredText,
  withSchemaInstruction,
} from "./claude-harness.ts";

test("reads JSON a model wrapped in a fenced block", () => {
  const parsed = parseStructuredText(
    'Here you go:\n```json\n{"ok": true, "count": 2}\n```\nHope that helps.',
  );
  assert.deepEqual(parsed, { ok: true, value: { ok: true, count: 2 } });
});

test("reads bare JSON surrounded by prose", () => {
  const parsed = parseStructuredText('Result: {"name": "gheller"} — done.');
  assert.deepEqual(parsed, { ok: true, value: { name: "gheller" } });
});

test("reads a top-level JSON array", () => {
  const parsed = parseStructuredText("```\n[1, 2, 3]\n```");
  assert.deepEqual(parsed, { ok: true, value: [1, 2, 3] });
});

test("reports failure instead of guessing when there is no JSON", () => {
  assert.deepEqual(parseStructuredText("I could not complete the task."), {
    ok: false,
  });
});

test("reports failure on malformed JSON rather than throwing", () => {
  assert.deepEqual(parseStructuredText('{"unterminated": '), { ok: false });
});

test("states the JSON-only contract in the prompt", () => {
  const prompt = withSchemaInstruction("Summarize the repo.", {
    type: "object",
  });
  assert.match(prompt, /^Summarize the repo\./);
  assert.match(prompt, /only a single JSON value/);
  assert.match(prompt, /"type": ?"object"/);
});
