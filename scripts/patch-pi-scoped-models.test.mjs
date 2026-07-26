import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  applyPatch,
  inspectPatch,
  restorePatch,
} from "./patch-pi-scoped-models.mjs";

const original = `before
    async showModelsSelector() {
        // Get all available models
        await this.session.modelRuntime.refresh();
        const allModels = [...(await this.session.modelRuntime.getAvailable())];
after
`;

function fixture(source = original) {
  const directory = mkdtempSync(join(tmpdir(), "pi-scoped-models-"));
  const target = join(directory, "interactive-mode.js");
  writeFileSync(target, source);
  return { directory, target };
}

test("applies the patch once and preserves a backup", () => {
  const { directory, target } = fixture();
  try {
    assert.equal(inspectPatch(target), "unpatched");
    assert.equal(applyPatch(target).changed, true);
    assert.equal(inspectPatch(target), "patched");
    assert.equal(
      readFileSync(`${target}.before-scoped-models-fix`, "utf8"),
      original,
    );
    assert.equal(applyPatch(target).changed, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("restores the exact original from backup", () => {
  const { directory, target } = fixture();
  try {
    applyPatch(target);
    assert.equal(restorePatch(target).state, "unpatched");
    assert.equal(readFileSync(target, "utf8"), original);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("refuses unknown source instead of guessing", () => {
  const { directory, target } = fixture("different source");
  try {
    assert.equal(inspectPatch(target), "unsupported");
    assert.throws(() => applyPatch(target), /refusing to modify/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
