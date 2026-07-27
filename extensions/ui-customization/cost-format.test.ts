import assert from "node:assert/strict";
import test from "node:test";
import {
  formatApiEquivalentCostSummary,
  mergeApiEquivalentCosts,
} from "../shared/api-equivalent-cost.ts";

test("footer cost merges parent and subagents by provider", () => {
  const merged = mergeApiEquivalentCosts(
    { totalUsd: 1.1, byProvider: { Claude: 1.1 } },
    { totalUsd: 5.6, byProvider: { OpenAI: 5.3, Claude: 0.3 } },
  );

  assert.ok(Math.abs(merged.totalUsd - 6.7) < 1e-12);
  assert.ok(Math.abs((merged.byProvider.Claude ?? 0) - 1.4) < 1e-12);
  assert.equal(merged.byProvider.OpenAI, 5.3);
  assert.equal(
    formatApiEquivalentCostSummary(merged),
    "$6.70 · Claude($1.40) · OpenAI($5.30)",
  );
});

test("displayed total is derived from displayed provider cents", () => {
  assert.equal(
    formatApiEquivalentCostSummary({
      totalUsd: 0.014,
      byProvider: { Claude: 0.006, OpenAI: 0.006 },
    }),
    "$0.02 · Claude($0.01) · OpenAI($0.01)",
  );
});
