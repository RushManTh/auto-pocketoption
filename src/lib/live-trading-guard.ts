import type { TradeIntent } from "@/domain/trading/trade-intent";
import { env } from "@/lib/env";

export const liveTradingConfirmationPhrase = "I_UNDERSTAND_THIS_USES_REAL_MONEY";

export type LiveTradingGuardDecision = {
  allowed: boolean;
  reason: string;
};

export function evaluateLivePlaywrightGuard(intent?: Pick<TradeIntent, "amount" | "mode">): LiveTradingGuardDecision {
  if (env.EXECUTION_MODE !== "live_playwright") {
    return reject("Execution mode is not live_playwright");
  }

  if (!env.ENABLE_LIVE_PLAYWRIGHT_TRADING) {
    return reject("ENABLE_LIVE_PLAYWRIGHT_TRADING is not true");
  }

  if (env.LIVE_TRADING_CONFIRMATION_TEXT !== liveTradingConfirmationPhrase) {
    return reject(`LIVE_TRADING_CONFIRMATION_TEXT must equal ${liveTradingConfirmationPhrase}`);
  }

  if (!env.POCKET_OPTION_LIVE_ACCOUNT_TEXT) {
    return reject("POCKET_OPTION_LIVE_ACCOUNT_TEXT must identify the real-money account option");
  }

  if (env.KILL_SWITCH) {
    return reject("Kill switch is active");
  }

  if (intent?.mode && intent.mode !== "live_playwright") {
    return reject("Trade intent mode is not live_playwright");
  }

  if (intent?.amount && intent.amount > env.POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT) {
    return reject(
      `Trade amount ${intent.amount} exceeds POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT ${env.POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT}`
    );
  }

  return {
    allowed: true,
    reason: "Live Playwright trading is unlocked"
  };
}

export function assertLivePlaywrightGuard(intent?: Pick<TradeIntent, "amount" | "mode">) {
  const decision = evaluateLivePlaywrightGuard(intent);

  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
}

function reject(reason: string): LiveTradingGuardDecision {
  return {
    allowed: false,
    reason
  };
}
