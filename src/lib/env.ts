import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

loadDotEnv();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  }

  return value;
}, z.boolean());

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().optional());

const optionalUrl = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}, z.string().url().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  TELEGRAM_API_ID: optionalNonEmptyString,
  TELEGRAM_API_HASH: optionalNonEmptyString,
  TELEGRAM_SESSION: optionalNonEmptyString,
  TELEGRAM_CHANNEL_ID: optionalNonEmptyString,
  TELEGRAM_BOT_TOKEN: optionalNonEmptyString,
  TELEGRAM_TEST_CHAT_ID: optionalNonEmptyString,
  EXECUTION_MODE: z.enum(["paper", "manual", "demo", "live_playwright", "official_api", "live"]).default("paper"),
  AUTO_TRADE_ENABLED: booleanFromEnv.default(false),
  DEMO_AUTO_TRADE_ENABLED: booleanFromEnv.default(false),
  DEMO_AUTO_TRADE_REQUIRE_GO: booleanFromEnv.default(true),
  DEMO_AUTO_TRADE_ENTRY_LOOKBACK_SECONDS: z.coerce.number().int().positive().default(300),
  ENABLE_LIVE_PLAYWRIGHT_TRADING: booleanFromEnv.default(false),
  LIVE_TRADING_CONFIRMATION_TEXT: optionalNonEmptyString,
  LIVE_REQUIRE_MANUAL_APPROVAL: booleanFromEnv.default(true),
  KILL_SWITCH: booleanFromEnv.default(false),
  DEFAULT_TRADE_AMOUNT: z.coerce.number().positive().default(1),
  MAX_TRADES_PER_DAY: z.coerce.number().int().positive().default(3),
  MAX_DAILY_LOSS: z.coerce.number().nonnegative().default(3),
  MAX_CONSECUTIVE_LOSSES: z.coerce.number().int().nonnegative().default(1),
  SIGNAL_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(60),
  POCKET_OPTION_PROFILE_DIR: z.string().default("./playwright/pocket-option/profile"),
  POCKET_OPTION_BASE_URL: z.string().url().default("https://pocketoption.com/cabinet/"),
  POCKET_OPTION_BROWSER_CHANNEL: z.enum(["chrome", "msedge", "chromium"]).optional(),
  POCKET_OPTION_HEADLESS: booleanFromEnv.default(true),
  POCKET_OPTION_DEMO_TRADE_AMOUNT: z.coerce.number().positive().default(10),
  POCKET_OPTION_LIVE_TRADE_AMOUNT: z.coerce.number().positive().default(1),
  POCKET_OPTION_LIVE_MAX_TRADE_AMOUNT: z.coerce.number().positive().default(1),
  POCKET_OPTION_LIVE_ACCOUNT_TEXT: optionalNonEmptyString,
  POCKET_OPTION_ENFORCE_EXPIRY_MATCH: booleanFromEnv.default(false),
  POCKET_OPTION_IDLE_CLOSE_SECONDS: z.coerce.number().int().positive().default(3600),
  POCKET_OPTION_OFFICIAL_API_TOKEN: optionalNonEmptyString,
  POCKET_OPTION_OFFICIAL_API_BASE_URL: optionalUrl
});

export const env = envSchema.parse(process.env);

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
}
