import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";
import { env } from "@/lib/env";
import { pocketOptionBrowserOptions } from "@/lib/pocket-option-browser";
import { writeWorkerLog } from "@/lib/worker-log";
import {
  assertDemoAccount,
  clickDirection,
  closePromotionalModals,
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

type PreparedIntent = Pick<TradeIntent, "asset" | "direction" | "amount" | "expirySeconds"> & {
  signalId: string;
  preparedAt: number;
};

type PreparedMatch = {
  matches: boolean;
  reason: string;
  ageMs?: number;
};

class PocketOptionDemoSession {
  private context?: BrowserContext;
  private page?: Page;
  private prepared?: PreparedIntent;
  private idleTimer?: NodeJS.Timeout;
  private busy = Promise.resolve();

  async warmUp(reason: string) {
    return this.enqueue(async () => {
      await this.ensurePage(`Warm up Pocket Option: ${reason}`);
      this.scheduleIdleClose();
    });
  }

  async prepare(intent: TradeIntent) {
    return this.enqueue(async () => {
      await writeWorkerLog({
        event: "trade.prepare.started",
        message: `Preparing demo trade ${intent.asset} ${intent.direction}`,
        entityId: intent.signalId,
        metadata: {
          asset: intent.asset,
          direction: intent.direction,
          amount: intent.amount,
          expirySeconds: intent.expirySeconds
        }
      });

      const page = await this.ensurePage("Prepare demo trade");
      await selectAsset(page, intent.asset);
      await setTradeAmount(page, intent.amount);
      await setExpiry(page, intent.expirySeconds);

      this.prepared = {
        signalId: intent.signalId,
        asset: intent.asset,
        direction: intent.direction,
        amount: intent.amount,
        expirySeconds: intent.expirySeconds,
        preparedAt: Date.now()
      };

      await writeWorkerLog({
        event: "trade.prepare.completed",
        message: `Ready for GO: ${intent.asset} ${intent.direction}`,
        entityId: intent.signalId,
        metadata: await readExecutionState(page)
      });

      this.scheduleIdleClose();
    });
  }

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    return this.enqueue(async () => {
      const preparedMatch = this.matchPreparedIntent(intent);
      await writeWorkerLog({
        event: "trade.execute.started",
        message: `GO received, opening demo order ${intent.asset} ${intent.direction}`,
        entityId: intent.signalId,
        metadata: {
          prepared: preparedMatch.matches,
          preparedMatchReason: preparedMatch.reason,
          preparedAgeMs: preparedMatch.ageMs,
          preparedSignalId: this.prepared?.signalId,
          candidateSignalId: intent.signalId
        }
      });

      const prepared = preparedMatch.matches;
      const page = await this.ensurePage("Execute demo order", {
        preferExisting: prepared
      });
      if (!prepared) {
        await selectAsset(page, intent.asset);
        await setTradeAmount(page, intent.amount);
        await setExpiry(page, intent.expirySeconds);
      }

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
        await writeWorkerLog({
          event: "trade.execute.failed",
          message: guard.reason,
          level: "warn",
          entityId: intent.signalId
        });
        this.scheduleIdleClose();
        return {
          ok: false,
          status: "FAILED",
          message: guard.reason
        };
      }

      const beforeDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
      const beforeState = await readExecutionState(page);
      await clickDirection(page, intent.direction);
      await page.waitForTimeout(500);
      const afterDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
      const afterState = await readExecutionState(page);

      const balanceChanged = readBalanceValue(beforeState.accountMode) !== readBalanceValue(afterState.accountMode);
      const dealsChanged = afterDeals !== beforeDeals && !/No opened trades/i.test(afterDeals);
      const opened = dealsChanged || balanceChanged;

      if (!opened) {
        await page.screenshot({ path: `test-results/after-click-failed-${Date.now()}.png`, fullPage: true }).catch(() => undefined);
      }

      const result: ExecutionResult = {
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

      await writeWorkerLog({
        event: opened ? "trade.execute.opened" : "trade.execute.failed",
        message: result.message,
        level: opened ? "info" : "warn",
        entityId: intent.signalId,
        metadata: result.metadata
      });

      this.prepared = undefined;
      this.scheduleIdleClose();
      return result;
    });
  }

  async close(reason: string) {
    return this.enqueue(async () => {
      await this.closeNow(reason);
    });
  }

  private async ensurePage(reason: string, options?: { preferExisting?: boolean }) {
    mkdirSync("test-results", { recursive: true });
    mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });
    this.clearIdleTimer();

    if (!this.context) {
      await writeWorkerLog({
        event: "browser.opening",
        message: `Opening Pocket Option browser (${env.POCKET_OPTION_HEADLESS ? "headless" : "visible"})`,
        metadata: {
          reason,
          headless: env.POCKET_OPTION_HEADLESS
        }
      });
      this.context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
      this.page = this.context.pages()[0] ?? (await this.context.newPage());
      await writeWorkerLog({
        event: "browser.opened",
        message: "Pocket Option browser is open"
      });
    }

    const page = this.page && !this.page.isClosed() ? this.page : await this.context.newPage();
    this.page = page;

    const existingPageReady = await this.isExistingDemoPageReady(page);
    if (existingPageReady) {
      await writeWorkerLog({
        event: "pocket-option.page.reused",
        message: options?.preferExisting
          ? "Reusing prepared Pocket Option page for demo execution"
          : "Reusing existing Pocket Option demo trade page",
        metadata: {
          reason,
          url: page.url()
        }
      });
      return page;
    }

    const tradeUrl = env.POCKET_OPTION_DEMO_TRADE_URL;

    await writeWorkerLog({
      event: "pocket-option.page.opening",
      message: "Playwright is opening the Pocket Option page",
      metadata: {
        reason,
        url: tradeUrl
      }
    });

    try {
      await openCabinet(page, tradeUrl);
      await ensureSessionReady(page);
      await assertDemoAccount(page);
    } catch (error) {
      await writeWorkerLog({
        event: "pocket-option.page.failed",
        message: error instanceof Error ? error.message : "Playwright could not open the Pocket Option page",
        level: "error",
        metadata: {
          reason,
          url: tradeUrl
        }
      });
      throw error;
    }

    await writeWorkerLog({
      event: "pocket-option.page.ready",
      message: "Playwright opened the Pocket Option page and demo account is ready",
      metadata: {
        reason,
        url: tradeUrl
      }
    });

    return page;
  }

  private async isExistingDemoPageReady(page: Page) {
    if (!/cabinet/i.test(page.url())) {
      return false;
    }

    const accountMode = await readAccountMode(page);
    if (!/QT\s+Demo/i.test(accountMode)) {
      return false;
    }

    await closePromotionalModals(page);
    await ensureSessionReady(page).catch(() => undefined);
    return true;
  }

  private async closeNow(reason: string) {
    this.clearIdleTimer();
    if (!this.context) {
      return;
    }

    await writeWorkerLog({
      event: "browser.closing",
      message: `Closing Pocket Option browser: ${reason}`
    });
    await this.context.close().catch(() => undefined);
    this.context = undefined;
    this.page = undefined;
    this.prepared = undefined;
    await writeWorkerLog({
      event: "browser.closed",
      message: "Pocket Option browser closed"
    });
  }

  private scheduleIdleClose() {
    this.clearIdleTimer();
    const timeoutMs = env.POCKET_OPTION_IDLE_CLOSE_SECONDS * 1000;
    this.idleTimer = setTimeout(() => {
      void this.close("Idle timeout").catch(() => undefined);
    }, timeoutMs);
    this.idleTimer.unref?.();
  }

  private clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private matchPreparedIntent(intent: TradeIntent): PreparedMatch {
    if (!this.prepared) {
      return {
        matches: false,
        reason: "no_prepared_intent"
      };
    }

    const ageMs = Date.now() - this.prepared.preparedAt;
    const maxAgeMs = env.DEMO_AUTO_TRADE_ENTRY_LOOKBACK_SECONDS * 1000;
    if (ageMs > maxAgeMs) {
      return {
        matches: false,
        reason: "prepared_intent_expired",
        ageMs
      };
    }

    const mismatches = [
      this.prepared.asset === intent.asset ? null : "asset",
      this.prepared.direction === intent.direction ? null : "direction",
      this.prepared.amount === intent.amount ? null : "amount",
      this.prepared.expirySeconds === intent.expirySeconds ? null : "expirySeconds"
    ].filter((value): value is string => Boolean(value));

    if (mismatches.length > 0) {
      return {
        matches: false,
        reason: `prepared_intent_mismatch:${mismatches.join(",")}`,
        ageMs
      };
    }

    return {
      matches: true,
      reason: this.prepared.signalId === intent.signalId ? "same_signal" : "same_trade_parameters_different_signal",
      ageMs
    };
  }

  private enqueue<T>(task: () => Promise<T>) {
    const next = this.busy.then(task, task);
    this.busy = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

export const pocketOptionDemoSession = new PocketOptionDemoSession();

function readBalanceValue(accountModeText: string) {
  const matches = accountModeText.match(/[\d,.]+/g);
  const value = matches?.at(-1)?.replace(/,/g, "");
  const parsed = value ? Number(value) : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

async function readExecutionState(page: Page) {
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
