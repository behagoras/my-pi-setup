import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  emptyModelInfoState,
  MODEL_INFO_CHANNEL,
  REFRESH_CHANNEL,
} from "../shared/dashboard-state.ts";

const CHARS_PER_ESTIMATED_TOKEN = 4;
const LIVE_UPDATE_INTERVAL_MS = 200;

// Model rates per 1M tokens: { input, output, cacheRead, cacheWrite }
const FALLBACK_RATES: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }> = {
  // Claude
  "claude-3-5-sonnet": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-3-7-sonnet": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-3-5-haiku": { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
  "claude-3-opus": { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o1": { input: 15.0, output: 60.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
  // Gemini
  "gemini-2.5-flash": { input: 0.075, output: 0.3 },
  "gemini-2.5-pro": { input: 1.25, output: 5.0 },
};

function getModelRates(modelId: string) {
  const normalized = modelId.toLowerCase();
  for (const [key, rates] of Object.entries(FALLBACK_RATES)) {
    if (normalized.includes(key)) return rates;
  }
  // Default fallback if unknown model: Sonnet-like pricing
  return { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 };
}

function getSessionCost(ctx: ExtensionContext) {
  let cost = 0;

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "assistant") {
      const usage = entry.message.usage;
      if (!usage) continue;

      if (usage.cost && usage.cost.total > 0) {
        cost += usage.cost.total;
      } else {
        // Fallback: estimate cost based on model ID and token usage
        const rates = getModelRates(entry.message.model || ctx.model?.id || "");
        const inputTokens = usage.input || usage.inputTokens || 0;
        const outputTokens = usage.output || usage.outputTokens || 0;
        const cacheReadTokens = usage.cacheRead || usage.cacheReadTokens || 0;
        const cacheWriteTokens = usage.cacheWrite || usage.cacheWriteTokens || 0;

        const inputCost = (inputTokens / 1_000_000) * rates.input;
        const outputCost = (outputTokens / 1_000_000) * rates.output;
        const cacheReadCost = (cacheReadTokens / 1_000_000) * (rates.cacheRead || 0);
        const cacheWriteCost = (cacheWriteTokens / 1_000_000) * (rates.cacheWrite || 0);
        cost += inputCost + outputCost + cacheReadCost + cacheWriteCost;
      }
    }
  }

  return cost;
}

function estimateContentTokens(characters: number) {
  return Math.ceil(characters / CHARS_PER_ESTIMATED_TOKEN);
}

export default function modelInfo(pi: ExtensionAPI) {
  let state = emptyModelInfoState();
  let contentStreamStart: number | null = null;
  let lastContentDeltaAt: number | null = null;
  let contentCharacters = 0;
  let firstContentDeltaCharacters = 0;
  let contentDeltaCount = 0;
  let sawToolCall = false;
  let runContentTokens = 0;
  let runContentStreamMs = 0;
  let lastLiveUpdate = 0;
  let currentContext: ExtensionContext | undefined;

  const publish = () => pi.events.emit(MODEL_INFO_CHANNEL, { ...state });

  function refresh(ctx: ExtensionContext) {
    currentContext = ctx;
    const model = ctx.model;
    const usage = ctx.getContextUsage();

    state = {
      ...state,
      provider: model?.provider ?? "",
      modelId: model?.id ?? "no-model",
      modelName: model?.name ?? model?.id ?? "No model",
      thinking: model?.reasoning ? pi.getThinkingLevel() : "off",
      contextTokens: usage?.tokens ?? null,
      contextWindow: usage?.contextWindow ?? model?.contextWindow ?? 0,
      contextPercent: usage?.percent ?? null,
      cost: getSessionCost(ctx),
    };
    publish();
  }

  function resetMessageTracking() {
    contentStreamStart = null;
    lastContentDeltaAt = null;
    contentCharacters = 0;
    firstContentDeltaCharacters = 0;
    contentDeltaCount = 0;
    sawToolCall = false;
    lastLiveUpdate = 0;
  }

  const stopRefreshListener = pi.events.on(REFRESH_CHANNEL, () => {
    if (currentContext) refresh(currentContext);
  });

  pi.on("session_start", (_event, ctx) => {
    resetMessageTracking();
    runContentTokens = 0;
    runContentStreamMs = 0;
    state = { ...state, tokensPerSecond: null, generating: false };
    refresh(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    state = {
      ...state,
      provider: event.model.provider,
      modelId: event.model.id,
      modelName: event.model.name,
      thinking: event.model.reasoning ? pi.getThinkingLevel() : "off",
      contextWindow: event.model.contextWindow,
    };
    refresh(ctx);
  });

  pi.on("thinking_level_select", (event) => {
    state = { ...state, thinking: event.level };
    publish();
  });

  pi.on("agent_start", (_event, ctx) => {
    runContentTokens = 0;
    runContentStreamMs = 0;
    resetMessageTracking();
    state = { ...state, tokensPerSecond: null, generating: true };
    refresh(ctx);
  });

  pi.on("message_start", (event) => {
    if (event.message.role === "assistant") resetMessageTracking();
  });

  pi.on("message_update", (event) => {
    if (event.message.role !== "assistant") return;

    const streamEvent = event.assistantMessageEvent;
    if (streamEvent.type === "toolcall_delta") {
      sawToolCall = true;
      return;
    }
    if (
      streamEvent.type !== "text_delta" &&
      streamEvent.type !== "thinking_delta"
    )
      return;
    if (!streamEvent.delta) return;

    const now = Date.now();
    if (contentStreamStart === null) {
      contentStreamStart = now;
      firstContentDeltaCharacters = streamEvent.delta.length;
    }
    lastContentDeltaAt = now;
    contentCharacters += streamEvent.delta.length;
    contentDeltaCount += 1;

    const elapsedMs = now - contentStreamStart;
    const streamedCharacters = contentCharacters - firstContentDeltaCharacters;
    if (
      contentDeltaCount < 2 ||
      elapsedMs <= 0 ||
      streamedCharacters <= 0 ||
      now - lastLiveUpdate < LIVE_UPDATE_INTERVAL_MS
    ) {
      return;
    }
    lastLiveUpdate = now;

    state = {
      ...state,
      tokensPerSecond:
        estimateContentTokens(streamedCharacters) / (elapsedMs / 1000),
    };
    publish();
  });

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;

    sawToolCall ||= event.message.content.some(
      (block) => block.type === "toolCall",
    );

    if (contentStreamStart !== null && contentCharacters > 0) {
      const streamEnd = lastContentDeltaAt ?? contentStreamStart;
      const streamMs = streamEnd - contentStreamStart;
      const estimatedFirstDeltaTokens = estimateContentTokens(
        firstContentDeltaCharacters,
      );
      // Measure tokens received after the first content event over the interval
      // from the first event to the last. This avoids counting an initial chunk
      // as if it were generated instantaneously at t=0.
      const streamedTokens =
        !sawToolCall && event.message.usage.output > 0
          ? Math.max(0, event.message.usage.output - estimatedFirstDeltaTokens)
          : Math.max(
              0,
              estimateContentTokens(contentCharacters) -
                estimatedFirstDeltaTokens,
            );

      // A single event or a sub-50ms burst has no useful observable cadence.
      if (contentDeltaCount >= 2 && streamMs >= 50 && streamedTokens > 0) {
        runContentTokens += streamedTokens;
        runContentStreamMs += streamMs;
        state = {
          ...state,
          tokensPerSecond: runContentTokens / (runContentStreamMs / 1000),
        };
      }
    }

    resetMessageTracking();
    refresh(ctx);
  });

  pi.on("turn_end", (_event, ctx) => refresh(ctx));

  pi.on("agent_settled", (_event, ctx) => {
    state = { ...state, generating: false };
    refresh(ctx);
  });

  pi.on("session_shutdown", () => {
    stopRefreshListener();
    currentContext = undefined;
  });
}
