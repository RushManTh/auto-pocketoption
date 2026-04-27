import { describe, expect, it } from "vitest";
import { parseSignalMessage } from "@/domain/signals/parser";
import { createTradeIntentFromSignal } from "./create-trade-intent";

describe("createTradeIntentFromSignal", () => {
  it("creates an intent when entry does not require go", () => {
    const result = createTradeIntentFromSignal({
      parsed: parseSignalMessage("OPEN EUR / AUD HIGHER FOR 5 MIN"),
      context: {
        currentStatus: "IDLE",
        waitForGo: false
      },
      signalId: "sig-1",
      mode: "paper",
      amount: 1,
      now: new Date("2026-04-24T10:00:00Z")
    });

    expect(result.created).toBe(true);
    if (result.created) {
      expect(result.intent).toMatchObject({
        asset: "EUR/AUD",
        direction: "CALL",
        expirySeconds: 300,
        mode: "paper"
      });
    }
  });

  it("does not create intent while waiting for go", () => {
    const result = createTradeIntentFromSignal({
      parsed: parseSignalMessage("OPEN EUR / AUD HIGHER FOR 5 MIN"),
      context: {
        currentStatus: "SETUP_RECEIVED",
        waitForGo: true
      },
      signalId: "sig-1",
      mode: "paper",
      amount: 1
    });

    expect(result.created).toBe(false);
    expect(result.status).toBe("WAITING_GO");
  });
});

