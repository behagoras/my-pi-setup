import { readFileSync } from "node:fs";
import * as path from "node:path";
import {
  CONFIG_DIR_NAME,
  DefaultResourceLoader,
  getAgentDir,
  ProjectTrustStore,
  SettingsManager,
  type AgentSession,
  type SessionShutdownEvent,
} from "@earendil-works/pi-coding-agent";

/**
 * Reads the user's real settings but drops every write.
 *
 * Children legitimately change session state (`setModel`, `setThinkingLevel`),
 * and those calls persist through the settings manager. With file-backed
 * storage a headless child would rewrite the human's `defaultModel` — so a
 * workflow agent could silently repoint the interactive session. Discarding
 * writes keeps child state per-session and the user's settings authoritative.
 */
class EphemeralSettingsStorage {
  private readonly cwd: string;
  private readonly agentDir: string;

  constructor(cwd: string, agentDir: string) {
    this.cwd = cwd;
    this.agentDir = agentDir;
  }

  private pathFor(scope: "global" | "project") {
    return scope === "global"
      ? path.join(this.agentDir, "settings.json")
      : path.join(this.cwd, CONFIG_DIR_NAME, "settings.json");
  }

  withLock(
    scope: "global" | "project",
    fn: (current: string | undefined) => string | undefined,
  ) {
    let current: string | undefined;
    try {
      current = readFileSync(this.pathFor(scope), "utf8");
    } catch {
      // A missing or unreadable settings file simply means "no settings".
    }
    fn(current);
  }
}

const CHILD_SHUTDOWN_TIMEOUT_MS = 5_000;

/** Tools that headless children must not receive. Everything else stays enabled. */
export const CHILD_EXCLUDED_TOOL_NAMES = [
  "subagent_spawn",
  "subagent_wait",
  "subagent_cancel",
  "subagent_check",
  "subagent_list",
  "workflow",
  "ask_user",
] as const;

/** Fresh SDK options avoid turning the denylist into an accidental allowlist. */
export function childToolPolicy() {
  return { excludeTools: [...CHILD_EXCLUDED_TOOL_NAMES] };
}

/**
 * Read one top-level string setting from the user's settings files.
 *
 * Extensions get no settings accessor on `ExtensionContext`, so the same files
 * Pi reads are read directly. Project settings win over global ones, and only
 * when the project is trusted.
 */
export function readStringSetting(options: {
  key: string;
  cwd: string;
  projectTrusted: boolean;
  agentDir?: string;
}): string | undefined {
  const agentDir = options.agentDir ?? getAgentDir();
  const candidates = [
    ...(options.projectTrusted
      ? [path.join(options.cwd, CONFIG_DIR_NAME, "settings.json")]
      : []),
    path.join(agentDir, "settings.json"),
  ];
  for (const file of candidates) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object") {
        const value = (parsed as Record<string, unknown>)[options.key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    } catch {
      // Missing or malformed settings simply mean the key is unset here.
    }
  }
  return undefined;
}

export interface ChildResourceOptions {
  cwd: string;
  projectTrusted: boolean;
  appendSystemPrompt?: string[];
  agentDir?: string;
}

/** Load normal global/package resources and trust-gated project resources. */
export async function createChildResources(options: ChildResourceOptions) {
  const agentDir = options.agentDir ?? getAgentDir();
  const settingsManager = SettingsManager.fromStorage(
    new EphemeralSettingsStorage(options.cwd, agentDir),
    { projectTrusted: options.projectTrusted },
  );
  const loader = new DefaultResourceLoader({
    cwd: options.cwd,
    agentDir,
    settingsManager,
    ...(options.appendSystemPrompt
      ? { appendSystemPrompt: options.appendSystemPrompt }
      : {}),
  });
  await loader.reload();
  return { loader, settingsManager };
}

/**
 * Same-directory children inherit the live parent decision. An alternate cwd
 * is trusted only when Pi's persisted trust store explicitly trusts it (or a
 * containing directory); unreadable/invalid trust data fails closed.
 */
export function resolveStandaloneChildProjectTrust(options: {
  parentCwd: string;
  childCwd: string;
  parentTrusted: boolean;
  agentDir?: string;
}) {
  if (path.resolve(options.childCwd) === path.resolve(options.parentCwd)) {
    return options.parentTrusted;
  }
  try {
    const trustStore = new ProjectTrustStore(options.agentDir ?? getAgentDir());
    return trustStore.get(options.childCwd) === true;
  } catch {
    return false;
  }
}

/** Start child extension session hooks/resources in headless print mode. */
export async function bindChildSessionExtensions(
  session: Pick<AgentSession, "bindExtensions">,
) {
  await session.bindExtensions({ mode: "print" });
}

interface ChildExtensionRunner {
  hasHandlers(eventType: string): boolean;
  emit(event: SessionShutdownEvent): Promise<unknown>;
}

export interface DisposableChildSession {
  readonly extensionRunner: ChildExtensionRunner;
  dispose(): void;
}

const childShutdowns = new WeakMap<object, Promise<void>>();

function waitBounded(operation: Promise<unknown>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([
    operation.then(
      () => undefined,
      () => undefined,
    ),
    timeout,
  ])
    .catch(() => {})
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

/**
 * Emit child session_shutdown once, then dispose once. Hook failures and a
 * bounded hook deadline never prevent disposal.
 */
export function shutdownAndDisposeChildSession(
  session: DisposableChildSession,
  options: { timeoutMs?: number } = {},
) {
  const existing = childShutdowns.get(session);
  if (existing) return existing;

  const shutdown = (async () => {
    try {
      if (session.extensionRunner.hasHandlers("session_shutdown")) {
        await waitBounded(
          session.extensionRunner.emit({
            type: "session_shutdown",
            reason: "quit",
          }),
          options.timeoutMs ?? CHILD_SHUTDOWN_TIMEOUT_MS,
        );
      }
    } catch {
      // Extension runner inspection/emission is best-effort during teardown.
    } finally {
      try {
        session.dispose();
      } catch {
        // Disposal is terminal and must remain idempotent for callers.
      }
    }
  })();

  childShutdowns.set(session, shutdown);
  return shutdown;
}
