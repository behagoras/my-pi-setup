/**
 * One-shot Claude agents for workflows, on the Claude Max subscription.
 *
 * Workflow agents run a prompt to completion and report text, usage, and a
 * transcript. The Claude Agent SDK's `query()` is an async generator, so that
 * shape needs no concurrency machinery: this module consumes the stream and
 * closes an outcome.
 *
 * The interactive `subagents` extension wraps the same SDK, but for sessions
 * that can be sent to, interrupted, and taken over, so its backend is built on
 * Effect and cannot be reused here without adapting a live session into a
 * single call. See `docs/adr/0003-claude-harness-for-workflow-agents.md`.
 *
 * Claude runs its own native tools here, unlike Pi children which execute Pi's
 * tools under a policy. A workflow agent on this harness *is* a Claude agent.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { emptyUsage, type AgentUsage, type TranscriptEntry } from "./model.ts";
import type { AgentOutcome, ThinkingLevel } from "./runner.ts";
import { safeStringify, truncateUtf8 } from "./serialization.ts";

const OUTPUT_MAX_BYTES = 64 * 1024;
const TRANSCRIPT_ENTRY_MAX_BYTES = 16 * 1024;
const TRANSCRIPT_MAX_ENTRIES = 200;

/** Claude bills thinking as a token budget rather than a named level. */
const THINKING_BUDGETS = {
  off: 0,
  minimal: 1_024,
  low: 4_096,
  medium: 10_000,
  high: 16_000,
  xhigh: 32_000,
  max: 63_999,
} satisfies Record<string, number>;

export interface ClaudeAgentRequest {
  prompt: string;
  cwd: string;
  /** Untrusted projects must not let local config reconfigure the agent. */
  projectTrusted: boolean;
  /** Claude model alias, e.g. "opus" or "sonnet". Omit for Claude's default. */
  model?: string;
  thinkingLevel?: ThinkingLevel;
  /** Requests JSON-only output parsed into `structured`. */
  schema?: unknown;
  signal?: AbortSignal;
  onProgress?: (progress: {
    preview: string;
    usage: AgentUsage;
    model?: string;
    transcript: TranscriptEntry[];
  }) => void;
}

function thinkingBudget(level: ThinkingLevel | undefined) {
  if (!level) return undefined;
  return (THINKING_BUDGETS as Record<string, number | undefined>)[level];
}

function errorText(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return truncateUtf8(text, 2_000);
}

/**
 * Parse the JSON a schema-bearing agent was asked to emit. Models commonly
 * wrap it in a fenced block or add prose, so the outermost JSON value is
 * extracted rather than requiring a pristine document.
 */
export function parseStructuredText(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text].filter(
    (value): value is string => typeof value === "string",
  );
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    const start = trimmed.search(/[[{]/);
    if (start === -1) continue;
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (end <= start) continue;
    try {
      return {
        ok: true as const,
        value: JSON.parse(trimmed.slice(start, end + 1)),
      };
    } catch {
      // Try the next candidate rather than failing on the first shape.
    }
  }
  return { ok: false as const };
}

/** Append the JSON-only contract for agents that requested a schema. */
export function withSchemaInstruction(prompt: string, schema: unknown) {
  return (
    `${prompt}\n\n` +
    `Reply with only a single JSON value matching this schema, and no prose ` +
    `or explanation around it:\n${safeStringify(schema)}`
  );
}

export async function runClaudeAgent(
  request: ClaudeAgentRequest,
): Promise<AgentOutcome> {
  const transcript: TranscriptEntry[] = [];
  const usage: AgentUsage = emptyUsage();
  let finalText = "";
  let modelLabel: string | undefined;
  let contextWindow: number | undefined;

  const pushTranscript = (entry: TranscriptEntry) => {
    if (transcript.length >= TRANSCRIPT_MAX_ENTRIES) return;
    transcript.push({
      ...entry,
      text: truncateUtf8(entry.text, TRANSCRIPT_ENTRY_MAX_BYTES),
    });
  };

  const reportProgress = () => {
    request.onProgress?.({
      preview: finalText,
      usage: { ...usage },
      ...(modelLabel ? { model: modelLabel } : {}),
      transcript: [...transcript],
    });
  };

  // Prepared before the listener is registered: serializing a pathological
  // schema can throw, and nothing may leak a listener on the caller's signal.
  const prompt = request.schema
    ? withSchemaInstruction(request.prompt, request.schema)
    : request.prompt;
  const budget = thinkingBudget(request.thinkingLevel);

  // The SDK takes its own AbortController, so a workflow abort is forwarded.
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  if (request.signal) {
    if (request.signal.aborted) abort();
    else request.signal.addEventListener("abort", abort, { once: true });
  }

  try {
    const stream = query({
      prompt,
      options: {
        cwd: request.cwd,
        // A headless workflow agent cannot answer approval prompts, and the
        // script already chose to run it autonomously.
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        // Nested orchestration stays with the workflow, not Claude's own
        // subagents, so phases and concurrency remain observable.
        disallowedTools: ["Agent", "Task"],
        ...(request.projectTrusted
          ? {}
          : { settingSources: ["user" as const] }),
        abortController,
        ...(request.model ? { model: request.model } : {}),
        ...(budget !== undefined ? { maxThinkingTokens: budget } : {}),
      },
    });

    for await (const message of stream) {
      if (message.type === "system" && message.subtype === "init") {
        modelLabel = message.model;
      } else if (message.type === "assistant") {
        // Sidechain messages belong to a nested context, not this agent's.
        if (message.parent_tool_use_id != null) continue;
        modelLabel = message.message.model ?? modelLabel;
        for (const block of message.message.content) {
          if (block.type === "text" && block.text.trim()) {
            finalText = block.text.trim();
            pushTranscript({ role: "assistant", text: finalText });
          } else if (block.type === "tool_use") {
            pushTranscript({
              role: "tool",
              text: safeStringify(block.input),
              name: block.name,
              toolCallId: block.id,
            });
          }
        }
        reportProgress();
      } else if (message.type === "result") {
        const raw: unknown = message.usage;
        if (raw && typeof raw === "object") {
          const counts = raw as Record<string, unknown>;
          const count = (value: unknown) =>
            typeof value === "number" ? value : 0;
          usage.input = count(counts.input_tokens);
          usage.output = count(counts.output_tokens);
          usage.cacheRead = count(counts.cache_read_input_tokens);
          usage.cacheWrite = count(counts.cache_creation_input_tokens);
        }
        // Subscription runs report a notional cost; surface whatever is given.
        if (typeof message.total_cost_usd === "number") {
          usage.cost = message.total_cost_usd;
        }
        if (message.subtype === "success") {
          finalText = message.result.trim() || finalText;
        } else {
          return {
            ok: false,
            output: truncateUtf8(finalText, OUTPUT_MAX_BYTES),
            error: `Claude agent ended with ${message.subtype}`,
            aborted: abortController.signal.aborted,
            usage,
            ...(modelLabel ? { model: modelLabel } : {}),
            ...(contextWindow ? { contextWindow } : {}),
            transcript,
          };
        }
      }
    }
  } catch (error) {
    const aborted = abortController.signal.aborted;
    return {
      ok: false,
      output: truncateUtf8(finalText, OUTPUT_MAX_BYTES),
      error: aborted ? "Aborted" : errorText(error),
      aborted,
      usage,
      ...(modelLabel ? { model: modelLabel } : {}),
      transcript,
    };
  } finally {
    request.signal?.removeEventListener("abort", abort);
  }

  const output = truncateUtf8(finalText, OUTPUT_MAX_BYTES);
  if (!request.schema) {
    return {
      ok: true,
      output,
      aborted: false,
      usage,
      ...(modelLabel ? { model: modelLabel } : {}),
      transcript,
    };
  }

  const parsed = parseStructuredText(finalText);
  return parsed.ok
    ? {
        ok: true,
        output,
        structured: parsed.value,
        aborted: false,
        usage,
        ...(modelLabel ? { model: modelLabel } : {}),
        transcript,
      }
    : {
        ok: false,
        output,
        error:
          "Claude agent did not return JSON matching the requested schema. " +
          "Claude has no structured-output tool, so the schema is requested " +
          "in the prompt and parsed from the reply.",
        aborted: false,
        usage,
        ...(modelLabel ? { model: modelLabel } : {}),
        transcript,
      };
}
