import {
  calculateCost,
  type Api,
  type Model,
  type Usage,
} from "@earendil-works/pi-ai";

/**
 * Token counts that can be priced like one API request. Input excludes cached
 * reads and writes; output already includes reasoning tokens.
 */
export interface ApiEquivalentUsage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
  readonly cacheWrite1h?: number;
  readonly reasoning?: number;
}

export interface ApiEquivalentCostBreakdown {
  readonly totalUsd: number;
  readonly byProvider: Readonly<Record<string, number>>;
}

export const emptyApiEquivalentCostBreakdown = () => ({
  totalUsd: 0,
  byProvider: {},
});

function usableCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function normalizeApiEquivalentUsage(
  usage: ApiEquivalentUsage,
): ApiEquivalentUsage {
  return {
    input: usableCount(usage.input),
    output: usableCount(usage.output),
    cacheRead: usableCount(usage.cacheRead),
    cacheWrite: usableCount(usage.cacheWrite),
    ...(usage.cacheWrite1h === undefined
      ? {}
      : { cacheWrite1h: usableCount(usage.cacheWrite1h) }),
    ...(usage.reasoning === undefined
      ? {}
      : { reasoning: usableCount(usage.reasoning) }),
  };
}

export function hasApiEquivalentUsage(usage: ApiEquivalentUsage) {
  const normalized = normalizeApiEquivalentUsage(usage);
  return (
    normalized.input +
      normalized.output +
      normalized.cacheRead +
      normalized.cacheWrite >
    0
  );
}

export function apiEquivalentCostUsd(
  model: Model<Api>,
  usage: ApiEquivalentUsage,
) {
  const normalized = normalizeApiEquivalentUsage(usage);
  const pricedUsage: Usage = {
    ...normalized,
    totalTokens:
      normalized.input +
      normalized.output +
      normalized.cacheRead +
      normalized.cacheWrite,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
  return calculateCost(model, pricedUsage).total;
}

export function billingProviderName(provider: string) {
  const normalized = provider.toLowerCase();
  if (
    normalized === "anthropic" ||
    normalized === "claude" ||
    normalized.startsWith("claude-bridge")
  ) {
    return "Claude";
  }
  if (
    normalized === "openai" ||
    normalized === "openai-codex" ||
    normalized === "codex"
  ) {
    return "OpenAI";
  }
  if (normalized === "google" || normalized.startsWith("google-")) {
    return "Google";
  }
  if (!provider) return "Other";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function mergeApiEquivalentCosts(
  ...breakdowns: ReadonlyArray<ApiEquivalentCostBreakdown>
) {
  const byProvider: Record<string, number> = {};
  for (const breakdown of breakdowns) {
    for (const [provider, amount] of Object.entries(breakdown.byProvider)) {
      if (!Number.isFinite(amount) || amount <= 0) continue;
      byProvider[provider] = (byProvider[provider] ?? 0) + amount;
    }
  }
  return {
    totalUsd: Object.values(byProvider).reduce(
      (total, amount) => total + amount,
      0,
    ),
    byProvider,
  } satisfies ApiEquivalentCostBreakdown;
}

/**
 * Round the provider rows first, then derive the displayed total from those
 * cents so the compact footer always visibly reconciles.
 */
export function formatApiEquivalentCostSummary(
  breakdown: ApiEquivalentCostBreakdown,
) {
  const providers = Object.entries(breakdown.byProvider)
    .map(([provider, amount]) => ({
      provider,
      cents: Math.max(0, Math.round(amount * 100)),
    }))
    .filter(({ cents }) => cents > 0)
    .sort((a, b) => a.provider.localeCompare(b.provider));
  const totalCents = providers.reduce((total, { cents }) => total + cents, 0);
  const details = providers.map(
    ({ provider, cents }) => `${provider}($${(cents / 100).toFixed(2)})`,
  );
  return [`$${(totalCents / 100).toFixed(2)}`, ...details].join(" · ");
}
