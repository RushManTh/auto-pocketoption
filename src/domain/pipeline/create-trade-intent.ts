import { canCreateTradeIntent, nextSignalStatus } from "@/domain/signals/state-machine";
import type { ParsedSignal, SignalContext } from "@/domain/signals/types";
import { tradeIntentSchema, type ExecutionMode, type TradeIntent } from "@/domain/trading/trade-intent";

export type CreateTradeIntentInput = {
  parsed: ParsedSignal;
  context: SignalContext;
  signalId: string;
  mode: ExecutionMode;
  amount: number;
  now?: Date;
};

export type CreateTradeIntentResult =
  | {
      created: true;
      status: string;
      intent: TradeIntent;
    }
  | {
      created: false;
      status: string;
      reason: string;
    };

export function createTradeIntentFromSignal(input: CreateTradeIntentInput): CreateTradeIntentResult {
  const status = nextSignalStatus(input.parsed, input.context);

  if (!canCreateTradeIntent(status)) {
    return {
      created: false,
      status,
      reason: `Signal status ${status} cannot create trade intent`
    };
  }

  if (!input.parsed.asset || !input.parsed.direction || !input.parsed.expirySeconds) {
    return {
      created: false,
      status,
      reason: "Parsed signal is missing asset, direction, or expiry"
    };
  }

  return {
    created: true,
    status,
    intent: tradeIntentSchema.parse({
      signalId: input.signalId,
      mode: input.mode,
      asset: input.parsed.asset,
      direction: input.parsed.direction,
      expirySeconds: input.parsed.expirySeconds,
      amount: input.amount,
      executeAt: input.now ?? new Date()
    })
  };
}

