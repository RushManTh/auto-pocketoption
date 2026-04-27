import type { TradeExecutor } from "@/domain/trading/executor";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";
import { env } from "@/lib/env";

export class PocketOptionOfficialApiExecutor implements TradeExecutor {
  readonly mode = "official_api";

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    if (!env.POCKET_OPTION_OFFICIAL_API_TOKEN || !env.POCKET_OPTION_OFFICIAL_API_BASE_URL) {
      return {
        ok: false,
        status: "FAILED",
        message: "Official Pocket Option API token/base URL is not configured."
      };
    }

    return {
      ok: false,
      status: "FAILED",
      message:
        "Official API executor is a placeholder until Pocket Option provides approved API documentation for this account.",
      metadata: {
        asset: intent.asset,
        direction: intent.direction,
        amount: intent.amount,
        expirySeconds: intent.expirySeconds
      }
    };
  }
}

