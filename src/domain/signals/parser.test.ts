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

  it("parses no as a cancel confirmation", () => {
    expect(parseSignalMessage("No")).toMatchObject({
      type: "CANCEL",
      confidence: 1
    });
  });

  it("parses a wait confirm entry signal", () => {
    const parsed = parseSignalMessage("AUD USD PUT 5 MIN WAIT CONFIRM");

    expect(parsed).toMatchObject({
      type: "ENTRY",
      asset: "AUD/USD",
      direction: "PUT",
      expirySeconds: 300,
      waitForGo: true
    });
  });

  it("parses cal shorthand as call in a wait confirm entry signal", () => {
    const parsed = parseSignalMessage("EUR JPY CAL 5 MIN WAIT CONFIRM");

    expect(parsed).toMatchObject({
      type: "ENTRY",
      asset: "EUR/JPY",
      direction: "CALL",
      expirySeconds: 300,
      waitForGo: true
    });
  });

  it("parses usd jpy cal wait confirm entry signal", () => {
    const parsed = parseSignalMessage("USD JPY CAL 5 MIN WAIT CONFIRM");

    expect(parsed).toMatchObject({
      type: "ENTRY",
      asset: "USD/JPY",
      direction: "CALL",
      expirySeconds: 300,
      waitForGo: true
    });
  });

  it("parses start soon text as setup warm up", () => {
    expect(parseSignalMessage("Hello Traders! We will start soon! After 30 minut")).toMatchObject({
      type: "SETUP",
      confidence: 0.9
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
