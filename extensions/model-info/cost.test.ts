import assert from "node:assert/strict";
import test from "node:test";
import type { Model } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import { getBranchApiEquivalentCost } from "./index.ts";

const bridgeModel = {
  id: "claude-opus-5",
  name: "Claude Opus 5",
  api: "anthropic-messages",
  provider: "claude-bridge",
  baseUrl: "http://bridge.invalid",
  reasoning: true,
  input: ["text"],
  cost: { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  contextWindow: 1_000_000,
  maxTokens: 128_000,
} satisfies Model<"anthropic-messages">;

function assistantEntry(
  id: string,
  provider: string,
  model: string,
  cost: number,
): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-07-26T00:00:00.000Z",
    message: {
      role: "assistant",
      content: [],
      api: "anthropic-messages",
      provider,
      model,
      usage: {
        input: 100_000,
        output: 10_000,
        cacheRead: 50_000,
        cacheWrite: 5_000,
        totalTokens: 165_000,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: cost,
        },
      },
      stopReason: "stop",
      timestamp: 0,
    },
  };
}

test("parent totals reconstruct historical zero-cost bridge messages and retain provider switches", () => {
  const entries = [
    assistantEntry("bridge", "claude-bridge", "claude-opus-5", 0),
    assistantEntry("codex", "openai-codex", "gpt-5.6-sol", 0.75),
  ];
  const result = getBranchApiEquivalentCost(entries, (provider, modelId) =>
    provider === "claude-bridge" && modelId === bridgeModel.id
      ? bridgeModel
      : undefined,
  );

  // 100k*5 + 10k*25 + 50k*.5 + 5k*6.25 = $0.80625
  assert.deepEqual(result.byProvider, {
    Claude: 0.80625,
    OpenAI: 0.75,
  });
  assert.equal(result.totalUsd, 1.55625);
});

test("zero-priced non-bridge messages remain zero", () => {
  const result = getBranchApiEquivalentCost(
    [assistantEntry("local", "ollama", "local-model", 0)],
    () => bridgeModel,
  );
  assert.deepEqual(result, { totalUsd: 0, byProvider: {} });
});
