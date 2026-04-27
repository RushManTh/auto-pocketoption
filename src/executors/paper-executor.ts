import type { TradeExecutor } from "@/domain/trading/executor";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";

export class PaperExecutor implements TradeExecutor {
  readonly mode = "paper";

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    return {
      ok: true,
      status: "OPENED",
      message: `Paper order opened for ${intent.asset} ${intent.direction}`,
      metadata: {
        asset: intent.asset,
        direction: intent.direction,
        amount: intent.amount,
        expirySeconds: intent.expirySeconds,
        executeAt: intent.executeAt.toISOString()
      }
    };
  }
}

