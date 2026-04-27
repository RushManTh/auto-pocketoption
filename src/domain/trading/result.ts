export type ExecutionResult = {
  ok: boolean;
  orderId?: string;
  status: "CREATED" | "OPENED" | "CLOSED" | "FAILED" | "UNKNOWN" | "WAITING_APPROVAL";
  message: string;
  metadata?: Record<string, unknown>;
};

