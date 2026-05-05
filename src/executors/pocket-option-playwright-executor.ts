import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import type { TradeExecutor } from "@/domain/trading/executor";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { pocketOptionBrowserOptions } from "@/lib/pocket-option-browser";
import {
  assertDemoAccount,
  clickDirection,
  ensureSessionReady,
  openCabinet,
  readAccountMode,
  readCurrentAsset,
  readExpiry,
  readTradeAmount,
  selectAsset,
  setExpiry,
  setTradeAmount
} from "../../playwright/pocket-option/actions";
import { validateBeforeClick } from "../../playwright/pocket-option/guards";

export class PocketOptionPlaywrightExecutor implements TradeExecutor {
  readonly mode = "demo";

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    if (intent.mode !== "demo") {
      return {
        ok: false,
        status: "FAILED",
        message: "Playwright executor is limited to demo mode by default"
      };
    }

    mkdirSync("test-results", { recursive: true });

    const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());

    const page = context.pages()[0] ?? (await context.newPage());

    try {
      await openCabinet(page, env.POCKET_OPTION_DEMO_TRADE_URL);
      await ensureSessionReady(page);
      await assertDemoAccount(page);
      await selectAsset(page, intent.asset);
      await setTradeAmount(page, intent.amount);
      await setExpiry(page, intent.expirySeconds);

      const guard = await validateBeforeClick(page, {
        expectedAsset: intent.asset,
        expectedExpirySeconds: intent.expirySeconds,
        expectedAmount: intent.amount,
        signalReceivedAt: intent.executeAt,
        maxSignalAgeSeconds: env.SIGNAL_MAX_AGE_SECONDS,
        enforceExpiryMatch: env.POCKET_OPTION_ENFORCE_EXPIRY_MATCH
      });

      if (!guard.ok) {
        await page.screenshot({ path: `test-results/guard-failed-${Date.now()}.png`, fullPage: true }).catch(() => undefined);
        return {
          ok: false,
          status: "FAILED",
          message: guard.reason
        };
      }

      await page.screenshot({ path: `test-results/before-click-${Date.now()}.png`, fullPage: true }).catch(() => undefined);
      const beforeDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
      const beforeState = await readExecutionState(page);
      await clickDirection(page, intent.direction);
      await page.waitForTimeout(1_000);
      const afterDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
      const afterState = await readExecutionState(page);
      await page.screenshot({ path: `test-results/after-click-${Date.now()}.png`, fullPage: true }).catch(() => undefined);

      const balanceChanged = readBalanceValue(beforeState.accountMode) !== readBalanceValue(afterState.accountMode);
      const dealsChanged = afterDeals !== beforeDeals && !/No opened trades/i.test(afterDeals);
      const opened = dealsChanged || balanceChanged;

      return {
        ok: opened,
        status: opened ? "OPENED" : "FAILED",
        message: opened
          ? `Demo order submitted for ${intent.asset} ${intent.direction}`
          : `Demo order click did not create an opened trade for ${intent.asset} ${intent.direction}`,
        metadata: {
          beforeDeals,
          afterDeals,
          beforeState,
          afterState,
          balanceChanged,
          dealsChanged,
          expiryMatchEnforced: env.POCKET_OPTION_ENFORCE_EXPIRY_MATCH
        }
      };
    } catch (error) {
      logger.error({ error }, "Playwright execution failed");
      return {
        ok: false,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Unknown Playwright execution error"
      };
    } finally {
      await context.close().catch(() => undefined);
    }
  }
}

function readBalanceValue(accountModeText: string) {
  const matches = accountModeText.match(/[\d,.]+/g);
  const value = matches?.at(-1)?.replace(/,/g, "");
  const parsed = value ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

async function readExecutionState(page: import("playwright").Page) {
  const [accountMode, currentAsset, amount, expiry] = await Promise.all([
    readAccountMode(page),
    readCurrentAsset(page),
    readTradeAmount(page),
    readExpiry(page)
  ]);

  return {
    accountMode,
    currentAsset,
    amount,
    expiry
  };
}
