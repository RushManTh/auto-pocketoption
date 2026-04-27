import type { ParsedSignal, SignalContext, SignalStatus } from "./types";

export function nextSignalStatus(parsed: ParsedSignal, context: SignalContext): SignalStatus {
  switch (parsed.type) {
    case "SETUP":
      return "SETUP_RECEIVED";
    case "ENTRY":
      return parsed.waitForGo || context.waitForGo ? "WAITING_GO" : "ENTRY_RECEIVED";
    case "GO":
      return context.currentStatus === "WAITING_GO" ? "GO_RECEIVED" : "REJECTED";
    case "RESULT":
      return parsed.result === "WIN" ? "WON" : "LOST";
    default:
      return "REJECTED";
  }
}

export function canCreateTradeIntent(status: SignalStatus) {
  return status === "ENTRY_RECEIVED" || status === "GO_RECEIVED";
}

