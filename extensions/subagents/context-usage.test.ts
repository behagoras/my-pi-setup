import assert from "node:assert/strict";
import test from "node:test";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import { apiEquivalentCostUsd } from "../shared/api-equivalent-cost.ts";
import {
  contextOccupancyTokens,
  emptyClaudeApiEquivalentCostState,
  foldClaudeAssistantApiEquivalentCost,
  foldClaudeResultApiEquivalentCost,
} from "./src/backends/claude.ts";
import {
  emptyCodexApiEquivalentCostState,
  foldCodexApiEquivalentCost,
  parseThreadTokenUsage,
  resolveCodexPricingModel,
} from "./src/backends/codex.ts";
import { formatSubagentActivityDetail } from "./src/format.ts";

// --- Claude: per-request occupancy, never the run aggregate ------------------

test("Claude occupancy sums one request's input, cache, and output tokens", () => {
  assert.equal(
    contextOccupancyTokens({
      input_tokens: 12,
      cache_read_input_tokens: 45_000,
      cache_creation_input_tokens: 3_000,
      output_tokens: 700,
    }),
    48_712,
  );
});

test("Claude occupancy treats null cache/output counts as zero", () => {
  assert.equal(
    contextOccupancyTokens({
      input_tokens: 9_000,
      cache_read_input_tokens: null,
      cache_creation_input_tokens: null,
      output_tokens: 250,
    }),
    9_250,
  );
});

test("Claude occupancy is unknown without a usable per-request usage", () => {
  assert.equal(contextOccupancyTokens(undefined), undefined);
  assert.equal(contextOccupancyTokens(null), undefined);
  assert.equal(
    contextOccupancyTokens({ input_tokens: null, output_tokens: 5 }),
    undefined,
  );
});

test("Claude occupancy from the last request stays below the window where the run aggregate would not", () => {
  // A 10-request tool loop over a mostly-cached 150k prompt: the aggregate
  // usage (what SDKResultMessage.usage reports) re-counts the cache per
  // request and blows past the 200k window; the final request's usage is the
  // true occupancy.
  const perRequest = {
    input_tokens: 500,
    cache_read_input_tokens: 150_000,
    cache_creation_input_tokens: 0,
    output_tokens: 400,
  };
  const aggregate = {
    input_tokens: 500 * 10,
    cache_read_input_tokens: 150_000 * 10,
    cache_creation_input_tokens: 0,
    output_tokens: 400 * 10,
  };
  const occupancy = contextOccupancyTokens(perRequest);
  assert.ok(occupancy !== undefined && occupancy < 200_000);
  const misleading = contextOccupancyTokens(aggregate);
  assert.ok(misleading !== undefined && misleading > 200_000);
});

test("Claude cumulative results and repeated assistant events do not double charge across runs", () => {
  const model = anthropicProvider()
    .getModels()
    .find((candidate) => candidate.id === "claude-sonnet-4-5");
  assert.ok(model);

  const firstRequest = {
    input: 1_000,
    output: 200,
    cacheRead: 5_000,
    cacheWrite: 300,
  };
  const firstProgress = { ...firstRequest, output: 80 };
  let state = emptyClaudeApiEquivalentCostState();

  state = foldClaudeAssistantApiEquivalentCost(
    state,
    "message-1",
    firstProgress,
    model,
  );
  state = foldClaudeAssistantApiEquivalentCost(
    state,
    "message-1",
    firstRequest,
    model,
  );
  state = foldClaudeAssistantApiEquivalentCost(
    state,
    "message-1",
    firstRequest,
    model,
  );

  const firstRunCost = apiEquivalentCostUsd(model, firstRequest);
  assert.equal(state.totalCostUsd, firstRunCost);
  state = foldClaudeResultApiEquivalentCost(state, firstRunCost);
  assert.equal(state.totalCostUsd, firstRunCost);
  assert.equal(state.messageCostUsdById.size, 0);

  const secondRequest = {
    input: 2_000,
    output: 400,
    cacheRead: 8_000,
    cacheWrite: 600,
  };
  state = foldClaudeAssistantApiEquivalentCost(
    state,
    "message-2",
    secondRequest,
    model,
  );
  state = foldClaudeAssistantApiEquivalentCost(
    state,
    "message-2",
    secondRequest,
    model,
  );

  const cumulativeResultCost =
    firstRunCost + apiEquivalentCostUsd(model, secondRequest);
  assert.equal(state.totalCostUsd, cumulativeResultCost);
  state = foldClaudeResultApiEquivalentCost(state, cumulativeResultCost);
  assert.equal(state.totalCostUsd, cumulativeResultCost);
  assert.equal(state.messageCostUsdById.size, 0);
});

// --- Codex: last request's total, never the thread-cumulative total ----------

const codexParams = (tokenUsage: unknown) => ({
  threadId: "t",
  turnId: "u",
  tokenUsage,
});

test("Codex occupancy uses tokenUsage.last.totalTokens, not the cumulative total", () => {
  const { tokens, contextWindow } = parseThreadTokenUsage(
    codexParams({
      total: {
        totalTokens: 1_450_000,
        inputTokens: 1_400_000,
        cachedInputTokens: 1_300_000,
        cacheWriteInputTokens: 20_000,
        outputTokens: 50_000,
        reasoningOutputTokens: 20_000,
      },
      last: {
        totalTokens: 61_000,
        inputTokens: 60_000,
        cachedInputTokens: 55_000,
        cacheWriteInputTokens: 1_000,
        outputTokens: 1_000,
        reasoningOutputTokens: 400,
      },
      modelContextWindow: 272_000,
    }),
  );
  assert.equal(tokens, 61_000);
  assert.equal(contextWindow, 272_000);
  const parsed = parseThreadTokenUsage(
    codexParams({
      total: {
        totalTokens: 100,
        inputTokens: 80,
        cachedInputTokens: 30,
        cacheWriteInputTokens: 10,
        outputTokens: 20,
        reasoningOutputTokens: 7,
      },
      last: {
        totalTokens: 100,
        inputTokens: 80,
        cachedInputTokens: 30,
        cacheWriteInputTokens: 10,
        outputTokens: 20,
        reasoningOutputTokens: 7,
      },
    }),
  );
  assert.deepEqual(parsed.lastBillingUsage, {
    input: 40,
    output: 20,
    cacheRead: 30,
    cacheWrite: 10,
    reasoning: 7,
  });
});

test("Codex occupancy is unknown when last usage or window is absent", () => {
  assert.deepEqual(
    parseThreadTokenUsage(
      codexParams({ total: { totalTokens: 10 }, modelContextWindow: null }),
    ),
    {
      tokens: undefined,
      contextWindow: undefined,
      cumulativeBillingUsage: undefined,
      lastBillingUsage: undefined,
    },
  );
  assert.deepEqual(parseThreadTokenUsage({ threadId: "t" }), {
    tokens: undefined,
    contextWindow: undefined,
    cumulativeBillingUsage: undefined,
    lastBillingUsage: undefined,
  });
});

test("Codex cumulative pricing rejects duplicates and applies request-wide tiers", () => {
  const model = openaiCodexProvider()
    .getModels()
    .find((candidate) => candidate.id === "gpt-5.6-sol");
  assert.ok(model);

  const firstUsage = {
    input: 10_000,
    cacheRead: 240_000,
    cacheWrite: 0,
    output: 1_000,
    reasoning: 600,
  };
  const first = foldCodexApiEquivalentCost(
    emptyCodexApiEquivalentCostState(),
    {
      cumulativeBillingUsage: firstUsage,
      lastBillingUsage: firstUsage,
    },
    model.id,
    model,
  );
  assert.equal(first.totalCostUsd, apiEquivalentCostUsd(model, firstUsage));

  const duplicate = foldCodexApiEquivalentCost(
    first,
    {
      cumulativeBillingUsage: firstUsage,
      lastBillingUsage: firstUsage,
    },
    model.id,
    model,
  );
  assert.equal(duplicate.totalCostUsd, first.totalCostUsd);

  const aboveTier = {
    input: 20_000,
    cacheRead: 260_000,
    cacheWrite: 0,
    output: 2_000,
    reasoning: 1_200,
  };
  const tiered = foldCodexApiEquivalentCost(
    duplicate,
    {
      cumulativeBillingUsage: aboveTier,
      lastBillingUsage: aboveTier,
    },
    model.id,
    model,
  );
  assert.equal(tiered.totalCostUsd, apiEquivalentCostUsd(model, aboveTier));

  const nextRequest = {
    input: 4_000,
    cacheRead: 40_000,
    cacheWrite: 0,
    output: 500,
    reasoning: 200,
  };
  const afterSecondRequest = foldCodexApiEquivalentCost(
    tiered,
    {
      cumulativeBillingUsage: {
        input: aboveTier.input + nextRequest.input,
        cacheRead: aboveTier.cacheRead + nextRequest.cacheRead,
        cacheWrite: 0,
        output: aboveTier.output + nextRequest.output,
        reasoning: (aboveTier.reasoning ?? 0) + (nextRequest.reasoning ?? 0),
      },
      lastBillingUsage: nextRequest,
    },
    model.id,
    model,
  );
  assert.equal(
    afterSecondRequest.totalCostUsd,
    apiEquivalentCostUsd(model, aboveTier) +
      apiEquivalentCostUsd(model, nextRequest),
  );
});

test("Codex pricing falls back from openai-codex to the openai registry", () => {
  const model = openaiCodexProvider()
    .getModels()
    .find((candidate) => candidate.id === "gpt-5.6-sol");
  assert.ok(model);
  const providers: string[] = [];

  const resolved = resolveCodexPricingModel((provider) => {
    providers.push(provider);
    return provider === "openai" ? model : undefined;
  }, model.id);

  assert.equal(resolved, model);
  assert.deepEqual(providers, ["openai-codex", "openai"]);
});

test("subagent activity detail includes the live API-equivalent estimate", () => {
  assert.equal(
    formatSubagentActivityDetail({
      backend: "codex",
      meta: { backend: "codex", modelLabel: "gpt-5.6-sol" },
      apiEquivalentCost: { totalUsd: 2.2, byProvider: { OpenAI: 2.2 } },
    }),
    "codex · gpt-5.6-sol · $2.20",
  );
});
