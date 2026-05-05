export type SignalMessageType = "SETUP" | "ENTRY" | "GO" | "CANCEL" | "RESULT" | "UNKNOWN";

export type Direction = "CALL" | "PUT";

export type ParsedSignal = {
  type: SignalMessageType;
  asset?: string;
  direction?: Direction;
  expirySeconds?: number;
  candleSeconds?: number;
  waitForGo?: boolean;
  martingale?: boolean;
  result?: "WIN" | "LOSS";
  confidence: number;
  sourceText: string;
};

export type SignalStatus =
  | "IDLE"
  | "SETUP_RECEIVED"
  | "ENTRY_RECEIVED"
  | "WAITING_GO"
  | "GO_RECEIVED"
  | "RISK_CHECKED"
  | "QUEUED"
  | "EXECUTING"
  | "OPENED"
  | "WON"
  | "LOST"
  | "FAILED"
  | "EXPIRED"
  | "REJECTED";

export type SignalContext = {
  currentStatus: SignalStatus;
  waitForGo: boolean;
};
