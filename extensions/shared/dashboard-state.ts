export const MODEL_INFO_CHANNEL = "dashboard:model-info";
export const GIT_INFO_CHANNEL = "dashboard:git-info";
export const SUBAGENT_COST_CHANNEL = "dashboard:subagent-api-equivalent-cost";
export const REFRESH_CHANNEL = "dashboard:refresh";

import type { ApiEquivalentCostBreakdown } from "./api-equivalent-cost.ts";

export interface ModelInfoState {
  provider: string;
  modelId: string;
  modelName: string;
  thinking: string;
  contextTokens: number | null;
  contextWindow: number;
  contextPercent: number | null;
  apiEquivalentCost: ApiEquivalentCostBreakdown;
  tokensPerSecond: number | null;
  generating: boolean;
}

export interface PullRequestInfo {
  number: number;
  url: string;
  isDraft: boolean;
}

export interface GitInfoState {
  isRepository: boolean;
  branch: string | null;
  changedFiles: number;
  pullRequest: PullRequestInfo | null;
}

export function emptyModelInfoState(): ModelInfoState {
  return {
    provider: "",
    modelId: "no-model",
    modelName: "No model",
    thinking: "off",
    contextTokens: null,
    contextWindow: 0,
    contextPercent: null,
    apiEquivalentCost: { totalUsd: 0, byProvider: {} },
    tokensPerSecond: null,
    generating: false,
  };
}

export function emptyGitInfoState(): GitInfoState {
  return {
    isRepository: false,
    branch: null,
    changedFiles: 0,
    pullRequest: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableNumber(value: unknown) {
  return value === null || typeof value === "number";
}

function isApiEquivalentCostBreakdown(
  value: unknown,
): value is ApiEquivalentCostBreakdown {
  if (!isRecord(value) || typeof value.totalUsd !== "number") return false;
  if (!isRecord(value.byProvider)) return false;
  return Object.values(value.byProvider).every(
    (amount) => typeof amount === "number" && Number.isFinite(amount),
  );
}

export function isSubagentCostState(
  value: unknown,
): value is ApiEquivalentCostBreakdown {
  return isApiEquivalentCostBreakdown(value);
}

export function isModelInfoState(value: unknown): value is ModelInfoState {
  if (!isRecord(value)) return false;

  return (
    typeof value.provider === "string" &&
    typeof value.modelId === "string" &&
    typeof value.modelName === "string" &&
    typeof value.thinking === "string" &&
    isNullableNumber(value.contextTokens) &&
    typeof value.contextWindow === "number" &&
    isNullableNumber(value.contextPercent) &&
    isApiEquivalentCostBreakdown(value.apiEquivalentCost) &&
    isNullableNumber(value.tokensPerSecond) &&
    typeof value.generating === "boolean"
  );
}

function isPullRequestInfo(value: unknown): value is PullRequestInfo {
  if (!isRecord(value)) return false;

  return (
    typeof value.number === "number" &&
    typeof value.url === "string" &&
    typeof value.isDraft === "boolean"
  );
}

export function isGitInfoState(value: unknown): value is GitInfoState {
  if (!isRecord(value)) return false;

  return (
    typeof value.isRepository === "boolean" &&
    (value.branch === null || typeof value.branch === "string") &&
    typeof value.changedFiles === "number" &&
    (value.pullRequest === null || isPullRequestInfo(value.pullRequest))
  );
}
