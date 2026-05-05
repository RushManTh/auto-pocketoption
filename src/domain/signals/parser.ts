import type { Direction, ParsedSignal } from "./types";

const OPEN_SIGNAL_RE =
  /OPEN\s+([A-Z]{3})\s*\/?\s*([A-Z]{3})(?:\s+(OTC))?\s+(HIGHER|LOWER|UP|DOWN|CALL|PUT)\s+FOR\s+(\d+)\s*(SEC|S|SECOND|SECONDS|MIN|M|MINUTE|MINUTES)?/i;

const WAIT_CONFIRM_ENTRY_RE =
  /\b([A-Z]{3})\s*\/?\s*([A-Z]{3})(?:\s+(OTC))?\s+(CALL|CAL|PUT|HIGHER|LOWER|UP|DOWN)\s+(\d+)\s*(SEC|S|SECOND|SECONDS|MIN|M|MINUTE|MINUTES)?\s+WAIT\s+CONFIRM(?:ATION)?\b/i;

const CANDLE_RE = /(\d+)\s*(MIN|M|MINUTE|MINUTES)\s*CANDLE/i;
const EXPIRY_RE = /(\d+)\s*(MIN|M|MINUTE|MINUTES)\s*(EXPIRY|EXPIRE|EXPIRATION)/i;

export function parseSignalMessage(text: string): ParsedSignal {
  const sourceText = text.trim();
  const normalized = normalizeText(sourceText);

  if (!normalized) {
    return unknown(sourceText);
  }

  if (/^GO[.! ]*$/i.test(normalized)) {
    return {
      type: "GO",
      confidence: 1,
      sourceText
    };
  }

  if (/^NO[.! ]*$/i.test(normalized)) {
    return {
      type: "CANCEL",
      confidence: 1,
      sourceText
    };
  }

  const result = parseResult(normalized);
  if (result) {
    return {
      type: "RESULT",
      result,
      confidence: 0.95,
      sourceText
    };
  }

  const entry = normalized.match(OPEN_SIGNAL_RE);
  if (entry) {
    const [, base, quote, otc, directionText, duration, unit] = entry;
    return {
      type: "ENTRY",
      asset: `${base.toUpperCase()}/${quote.toUpperCase()}${otc ? " OTC" : ""}`,
      direction: parseDirection(directionText),
      expirySeconds: durationToSeconds(Number(duration), unit),
      confidence: 0.98,
      sourceText
    };
  }

  const waitConfirmEntry = normalized.match(WAIT_CONFIRM_ENTRY_RE);
  if (waitConfirmEntry) {
    const [, base, quote, otc, directionText, duration, unit] = waitConfirmEntry;
    return {
      type: "ENTRY",
      asset: `${base.toUpperCase()}/${quote.toUpperCase()}${otc ? " OTC" : ""}`,
      direction: parseDirection(directionText),
      expirySeconds: durationToSeconds(Number(duration), unit),
      waitForGo: true,
      confidence: 0.98,
      sourceText
    };
  }

  const setup = parseSetup(normalized, sourceText);
  if (setup) {
    return setup;
  }

  return unknown(sourceText);
}

function normalizeText(text: string) {
  return text
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[🔥🔔✅❌🟥🟩]/gu, "")
    .trim();
}

function parseDirection(value: string): Direction {
  const direction = value.toUpperCase();
  return direction === "LOWER" || direction === "DOWN" || direction === "PUT" ? "PUT" : "CALL";
}

function durationToSeconds(value: number, unit?: string) {
  const normalizedUnit = unit?.toUpperCase();
  if (normalizedUnit === "SEC" || normalizedUnit === "S" || normalizedUnit === "SECOND" || normalizedUnit === "SECONDS") {
    return value;
  }

  return value * 60;
}

function parseResult(text: string): "WIN" | "LOSS" | null {
  if (/\b(WIN|WON|PROFIT)\b/i.test(text)) {
    return "WIN";
  }

  if (/\b(LOST|LOSS|LOSE)\b/i.test(text)) {
    return "LOSS";
  }

  return null;
}

function parseSetup(text: string, sourceText: string): ParsedSignal | null {
  const startsSoon = /HELLO\s+TRADERS|START\s+SOON|WE\s+WILL\s+START\s+SOON/i.test(text);
  const candle = text.match(CANDLE_RE);
  const expiry = text.match(EXPIRY_RE);
  const waitForGo = /WAIT\s+FOR\s+GO/i.test(text);
  const withoutMartingale = /WITHOUT\s+MARTINGALE|NO\s+MARTINGALE/i.test(text);
  const withMartingale = /\bMARTINGALE\b/i.test(text) && !withoutMartingale;

  if (!startsSoon && !candle && !expiry && !waitForGo && !withoutMartingale && !withMartingale) {
    return null;
  }

  return {
    type: "SETUP",
    candleSeconds: candle ? Number(candle[1]) * 60 : undefined,
    expirySeconds: expiry ? Number(expiry[1]) * 60 : undefined,
    waitForGo,
    martingale: withMartingale,
    confidence: 0.9,
    sourceText
  };
}

function unknown(sourceText: string): ParsedSignal {
  return {
    type: "UNKNOWN",
    confidence: 0,
    sourceText
  };
}
