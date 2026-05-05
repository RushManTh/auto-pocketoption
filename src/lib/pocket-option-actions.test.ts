import { describe, expect, it } from "vitest";
import { assetMatchesExpected } from "../../playwright/pocket-option/actions";

describe("assetMatchesExpected", () => {
  it("matches the exact non-otc pair", () => {
    expect(assetMatchesExpected("EUR/USD", "EUR/USD")).toBe(true);
    expect(assetMatchesExpected("EUR USD", "EUR/USD")).toBe(true);
  });

  it("does not match an otc pair for a non-otc signal", () => {
    expect(assetMatchesExpected("EUR/USD OTC", "EUR/USD")).toBe(false);
    expect(assetMatchesExpected("EUR USD OTC", "EUR USD")).toBe(false);
  });

  it("does not match a non-otc pair for an otc signal", () => {
    expect(assetMatchesExpected("EUR/USD", "EUR/USD OTC")).toBe(false);
  });

  it("matches the exact otc pair", () => {
    expect(assetMatchesExpected("EUR/USD OTC", "EUR/USD OTC")).toBe(true);
  });
});
