import type { TradeExecutor } from "@/domain/trading/executor";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";
import { pocketOptionLiveSession } from "@/lib/pocket-option-live-session";

export class PocketOptionLivePlaywrightExecutor implements TradeExecutor {
  readonly mode = "live_playwright";

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    if (intent.mode !== "live_playwright") {
      return {
        ok: false,
        status: "FAILED",
        message: "Live Playwright executor only accepts live_playwright intents"
      };
    }

    return pocketOptionLiveSession.execute(intent);
  }
}
