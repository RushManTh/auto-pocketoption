import { describe, expect, it } from "vitest";
import { evaluateRisk } from "./engine";
import type { RiskSettings } from "./rules";
import type { TradeIntent } from "../trading/trade-intent";

const settings: RiskSettings = {
  autoTradeEnabled: true,
  killSwitch: false,
  defaultTradeAmount: 1,
  maxTradesPerDay: 3,
  maxDailyLoss: 3,
  maxConsecutiveLosses: 1,
  signalMaxAgeSeconds: 5,
  allowMartingale: false,
  assetWhitelist: ["EUR/AUD"]
};

const intent: TradeIntent = {
  broker: "pocket_option",
  signalId: "sig-1",
  mode: "paper",
  asset: "EUR/AUD",
  direction: "CALL",
  expirySeconds: 300,
  amount: 1,
  executeAt: new Date("2026-04-24T10:00:00Z")
};

describe("evaluateRisk", () => {
  it("allows a fresh whitelisted signal", () => {
    const decision = evaluateRisk({
      intent,
      settings,
      runtime: {
        tradesToday: 0,
        dailyLoss: 0,
        consecutiveLosses: 0,
        hasOpenOrderForAsset: false
      },
      signalReceivedAt: new Date("2026-04-24T10:00:00Z"),
      now: new Date("2026-04-24T10:00:03Z")
    });

    expect(decision.allowed).toBe(true);
  });

  it("rejects stale signals", () => {
    const decision = evaluateRisk({
      intent,
      settings,
      runtime: {
        tradesToday: 0,
        dailyLoss: 0,
        consecutiveLosses: 0,
        hasOpenOrderForAsset: false
      },
      signalReceivedAt: new Date("2026-04-24T10:00:00Z"),
      now: new Date("2026-04-24T10:00:08Z")
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "Signal is stale"
    });
  });

  it("rejects when kill switch is active", () => {
    const decision = evaluateRisk({
      intent,
      settings: {
        ...settings,
        killSwitch: true
      },
      runtime: {
        tradesToday: 0,
        dailyLoss: 0,
        consecutiveLosses: 0,
        hasOpenOrderForAsset: false
      },
      signalReceivedAt: new Date("2026-04-24T10:00:00Z"),
      now: new Date("2026-04-24T10:00:01Z")
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("Kill switch is active");
  });
});

