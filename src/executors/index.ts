import type { ExecutionMode } from "@/domain/trading/trade-intent";
import type { TradeExecutor } from "@/domain/trading/executor";
import { ManualApprovalExecutor } from "./manual-approval-executor";
import { PaperExecutor } from "./paper-executor";
import { PocketOptionOfficialApiExecutor } from "./pocket-option-official-api-executor";
import { PocketOptionLivePlaywrightExecutor } from "./pocket-option-live-playwright-executor";
import { PocketOptionPlaywrightExecutor } from "./pocket-option-playwright-executor";

export function createExecutor(mode: ExecutionMode): TradeExecutor {
  switch (mode) {
    case "manual":
      return new ManualApprovalExecutor();
    case "demo":
      return new PocketOptionPlaywrightExecutor();
    case "live_playwright":
      return new PocketOptionLivePlaywrightExecutor();
    case "official_api":
      return new PocketOptionOfficialApiExecutor();
    case "paper":
    case "live":
    default:
      return new PaperExecutor();
  }
}
