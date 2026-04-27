import { describe, expect, it } from "vitest";
import { parseSignalMessage } from "./parser";

describe("parseSignalMessage", () => {
  it("parses an entry signal", () => {
    const parsed = parseSignalMessage("OPEN EUR / AUD HIGHER FOR 5 MIN");

    expect(parsed).toMatchObject({
      type: "ENTRY",
      asset: "EUR/AUD",
      direction: "CALL",
      expirySeconds: 300
    });
    expect(parsed.confidence).toBeGreaterThan(0.9);
  });

  it("parses an otc entry signal", () => {
    const parsed = parseSignalMessage("OPEN AUD/USD OTC HIGHER FOR 5 MIN");

    expect(parsed).toMatchObject({
      type: "ENTRY",
      asset: "AUD/USD OTC",
      direction: "CALL",
      expirySeconds: 300
    });
  });

  it("parses a seconds entry signal", () => {
    const parsed = parseSignalMessage("OPEN AUD / USD LOWER FOR 3 SEC");

    expect(parsed).toMatchObject({
      type: "ENTRY",
      asset: "AUD/USD",
      direction: "PUT",
      expirySeconds: 3
    });
  });

  it("parses go", () => {
    expect(parseSignalMessage("Go")).toMatchObject({
      type: "GO",
      confidence: 1
    });
  });

  it("parses setup text", () => {
    const parsed = parseSignalMessage("5min Candle\n5min expiry\nwait for go\nWithout martingale");

    expect(parsed).toMatchObject({
      type: "SETUP",
      candleSeconds: 300,
      expirySeconds: 300,
      waitForGo: true,
      martingale: false
    });
  });

  it("parses loss result", () => {
    expect(parseSignalMessage("Lost option")).toMatchObject({
      type: "RESULT",
      result: "LOSS"
    });
  });
});
