import type { TradeIntent } from "./trade-intent";
import type { ExecutionResult } from "./result";

export interface TradeExecutor {
  readonly mode: string;
  execute(intent: TradeIntent): Promise<ExecutionResult>;
}

