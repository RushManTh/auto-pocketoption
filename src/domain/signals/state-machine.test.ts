import { describe, expect, it } from "vitest";
import { nextSignalStatus } from "./state-machine";

describe("nextSignalStatus", () => {
  it("waits for go when setup requires it", () => {
    expect(
      nextSignalStatus(
        {
          type: "ENTRY",
          asset: "EUR/AUD",
          direction: "CALL",
          expirySeconds: 300,
          confidence: 0.98,
          sourceText: "OPEN EUR / AUD HIGHER FOR 5 MIN"
        },
        {
          currentStatus: "SETUP_RECEIVED",
          waitForGo: true
        }
      )
    ).toBe("WAITING_GO");
  });

  it("accepts go only while waiting", () => {
    expect(
      nextSignalStatus(
        {
          type: "GO",
          confidence: 1,
          sourceText: "Go"
        },
        {
          currentStatus: "WAITING_GO",
          waitForGo: true
        }
      )
    ).toBe("GO_RECEIVED");
  });

  it("rejects no confirmation while waiting", () => {
    expect(
      nextSignalStatus(
        {
          type: "CANCEL",
          confidence: 1,
          sourceText: "No"
        },
        {
          currentStatus: "WAITING_GO",
          waitForGo: true
        }
      )
    ).toBe("REJECTED");
  });
});
