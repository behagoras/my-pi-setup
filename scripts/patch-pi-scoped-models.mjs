#!/usr/bin/env node

import {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGINAL = `    async showModelsSelector() {
        // Get all available models
        await this.session.modelRuntime.refresh();
        const allModels = [...(await this.session.modelRuntime.getAvailable())];`;

const PATCHED = `    async showModelsSelector() {
        // Use the startup-populated snapshot so opening this selector never blocks on
        // remote catalog or provider availability checks.
        const allModels = [...this.session.modelRuntime.getAvailableSnapshot()];`;

function findInstalledPi() {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory || directory.includes("node_modules/.bin")) continue;
    const candidate = join(
      directory,
      process.platform === "win32" ? "pi.cmd" : "pi",
    );
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next PATH entry.
    }
  }
  throw new Error(
    "Could not find a user-installed pi executable outside node_modules/.bin",
  );
}

export function locatePiPackage(piBin) {
  const packageRoot = dirname(
    dirname(realpathSync(piBin ?? findInstalledPi())),
  );
  const packageJson = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  );

  if (packageJson.name !== "@earendil-works/pi-coding-agent") {
    throw new Error(`Unsupported pi package: ${packageJson.name ?? "unknown"}`);
  }

  return {
    packageRoot,
    version: packageJson.version,
    target: join(packageRoot, "dist/modes/interactive/interactive-mode.js"),
  };
}

export function inspectPatch(target) {
  const source = readFileSync(target, "utf8");
  const originalCount = source.split(ORIGINAL).length - 1;
  const patchedCount = source.split(PATCHED).length - 1;

  if (originalCount === 1 && patchedCount === 0) return "unpatched";
  if (originalCount === 0 && patchedCount === 1) return "patched";
  return "unsupported";
}

export function applyPatch(target) {
  const state = inspectPatch(target);
  if (state === "patched") return { changed: false, state };
  if (state === "unsupported") {
    throw new Error(
      "Pi source does not match the supported original or patched form; refusing to modify it.",
    );
  }

  const backup = `${target}.before-scoped-models-fix`;
  if (!existsSync(backup)) copyFileSync(target, backup);

  const source = readFileSync(target, "utf8");
  const temporary = `${target}.scoped-models-tmp-${process.pid}`;
  writeFileSync(temporary, source.replace(ORIGINAL, PATCHED), {
    mode: statSync(target).mode,
  });
  renameSync(temporary, target);
  return { changed: true, state: "patched", backup };
}

export function restorePatch(target) {
  const backup = `${target}.before-scoped-models-fix`;
  if (!existsSync(backup)) throw new Error(`Backup not found: ${backup}`);
  if (inspectPatch(target) !== "patched") {
    throw new Error(
      "Current Pi source is not the expected patched form; refusing to overwrite it.",
    );
  }
  copyFileSync(backup, target);
  return { changed: true, state: inspectPatch(target) };
}

function main() {
  const action = process.argv[2] ?? "--check";
  const pi = locatePiPackage(process.env.PI_BIN);

  if (action === "--check") {
    const state = inspectPatch(pi.target);
    console.log(`Pi ${pi.version}: scoped-models patch is ${state}`);
    process.exitCode =
      state === "unsupported" ? 2 : state === "patched" ? 0 : 1;
    return;
  }

  if (action === "--apply") {
    const result = applyPatch(pi.target);
    console.log(
      `Pi ${pi.version}: scoped-models patch ${result.changed ? "applied" : "already applied"}`,
    );
    if (result.backup) console.log(`Backup: ${result.backup}`);
    return;
  }

  if (action === "--restore") {
    const result = restorePatch(pi.target);
    console.log(`Pi ${pi.version}: original restored (${result.state})`);
    return;
  }

  throw new Error(
    "Usage: patch-pi-scoped-models.mjs [--check|--apply|--restore]",
  );
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
