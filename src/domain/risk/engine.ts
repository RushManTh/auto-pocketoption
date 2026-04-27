import type { TradeIntent } from "../trading/trade-intent";
import type { RiskRuntimeState, RiskSettings } from "./rules";

export type RiskDecision = {
  allowed: boolean;
  reason: string;
  normalizedAmount: number;
};

export type RiskInput = {
  intent: TradeIntent;
  settings: RiskSettings;
  runtime: RiskRuntimeState;
  signalReceivedAt: Date;
  now?: Date;
  martingale?: boolean;
};

export function evaluateRisk(input: RiskInput): RiskDecision {
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - input.signalReceivedAt.getTime();
  const ageSeconds = ageMs / 1000;

  if (input.settings.killSwitch) {
    return reject("Kill switch is active", input.settings.defaultTradeAmount);
  }

  if (!input.settings.autoTradeEnabled && input.intent.mode !== "paper") {
    return reject("Auto trade is disabled", input.settings.defaultTradeAmount);
  }

  if (!input.settings.assetWhitelist.includes(input.intent.asset)) {
    return reject(`Asset ${input.intent.asset} is not whitelisted`, input.settings.defaultTradeAmount);
  }

  if (ageSeconds > input.settings.signalMaxAgeSeconds) {
    return reject("Signal is stale", input.settings.defaultTradeAmount);
  }

  if (input.martingale && !input.settings.allowMartingale) {
    return reject("Martingale is disabled", input.settings.defaultTradeAmount);
  }

  if (input.runtime.hasOpenOrderForAsset) {
    return reject("Asset already has an open order", input.settings.defaultTradeAmount);
  }

  if (input.runtime.tradesToday >= input.settings.maxTradesPerDay) {
    return reject("Daily trade limit reached", input.settings.defaultTradeAmount);
  }

  if (input.runtime.dailyLoss >= input.settings.maxDailyLoss) {
    return reject("Daily loss limit reached", input.settings.defaultTradeAmount);
  }

  if (input.runtime.consecutiveLosses >= input.settings.maxConsecutiveLosses) {
    return reject("Consecutive loss limit reached", input.settings.defaultTradeAmount);
  }

  return {
    allowed: true,
    reason: "Allowed",
    normalizedAmount: input.intent.amount || input.settings.defaultTradeAmount
  };
}

function reject(reason: string, normalizedAmount: number): RiskDecision {
  return {
    allowed: false,
    reason,
    normalizedAmount
  };
}

