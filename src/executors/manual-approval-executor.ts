import type { TradeExecutor } from "@/domain/trading/executor";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";

export class ManualApprovalExecutor implements TradeExecutor {
  readonly mode = "manual";

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    return {
      ok: true,
      status: "WAITING_APPROVAL",
      message: `Waiting for manual approval: ${intent.asset} ${intent.direction}`,
      metadata: {
        signalId: intent.signalId,
        asset: intent.asset,
        direction: intent.direction,
        expirySeconds: intent.expirySeconds
      }
    };
  }
}

