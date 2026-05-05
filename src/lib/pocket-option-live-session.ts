import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { ExecutionResult } from "@/domain/trading/result";
import type { TradeIntent } from "@/domain/trading/trade-intent";
import { env } from "@/lib/env";
import { assertLivePlaywrightGuard } from "@/lib/live-trading-guard";
import { pocketOptionBrowserOptions } from "@/lib/pocket-option-browser";
import { writeWorkerLog } from "@/lib/worker-log";
import {
  assertLiveAccount,
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

type PreparedIntent = Pick<TradeIntent, "asset" | "direction" | "amount" | "expirySeconds"> & {
  signalId: string;
};

class PocketOptionLiveSession {
  private context?: BrowserContext;
  private page?: Page;
  private prepared?: PreparedIntent;
  private idleTimer?: NodeJS.Timeout;
  private busy = Promise.resolve();

  async warmUp(reason: string) {
    return this.enqueue(async () => {
      assertLivePlaywrightGuard();
      await this.ensurePage(`Warm up live Pocket Option: ${reason}`);
      this.scheduleIdleClose();
    });
  }

  async prepare(intent: TradeIntent) {
    return this.enqueue(async () => {
      assertLivePlaywrightGuard(intent);
      await writeWorkerLog({
        event: "live.trade.prepare.started",
        message: `Preparing real-money trade ${intent.asset} ${intent.direction}`,
        entityId: intent.signalId,
        metadata: {
          asset: intent.asset,
          direction: intent.direction,
          amount: intent.amount,
          expirySeconds: intent.expirySeconds
        }
      });

      const page = await this.ensurePage("Prepare real-money trade");
      await selectAsset(page, intent.asset);
      await setTradeAmount(page, intent.amount);
      await setExpiry(page, intent.expirySeconds);

      this.prepared = {
        signalId: intent.signalId,
        asset: intent.asset,
        direction: intent.direction,
        amount: intent.amount,
        expirySeconds: intent.expirySeconds
      };

      await writeWorkerLog({
        event: "live.trade.prepare.completed",
        message: `Real-money trade is prepared for manual GO: ${intent.asset} ${intent.direction}`,
        entityId: intent.signalId,
        metadata: await readExecutionState(page)
      });

      this.scheduleIdleClose();
    });
  }

  async execute(intent: TradeIntent): Promise<ExecutionResult> {
    return this.executeWithApproval(intent, false);
  }

  async executeApproved(intent: TradeIntent): Promise<ExecutionResult> {
    return this.executeWithApproval(intent, true);
  }

  private async executeWithApproval(intent: TradeIntent, manualApproved: boolean): Promise<ExecutionResult> {
    return this.enqueue(async () => {
      const guardDecision = runLiveGuard(intent, manualApproved);
      if (!guardDecision.ok) {
        await writeWorkerLog({
          event: "live.trade.execute.blocked",
          message: guardDecision.message,
          level: "warn",
          entityId: intent.signalId
        });

        return {
          ok: false,
          status: "FAILED",
          message: guardDecision.message
        };
      }

      await writeWorkerLog({
        event: "live.trade.execute.started",
        message: `GO received, opening real-money order ${intent.asset} ${intent.direction}`,
        entityId: intent.signalId,
        metadata: {
          prepared: this.isPreparedFor(intent)
        }
      });

      const page = await this.ensurePage("Execute real-money order");
      if (!this.isPreparedFor(intent)) {
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
        await page.screenshot({ path: `test-results/live-guard-failed-${Date.now()}.png`, fullPage: true }).catch(() => undefined);
        await writeWorkerLog({
          event: "live.trade.execute.failed",
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

      await page.screenshot({ path: `test-results/live-before-click-${Date.now()}.png`, fullPage: true }).catch(() => undefined);
      const beforeDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
      const beforeState = await readExecutionState(page);
      await clickDirection(page, intent.direction);
      await page.waitForTimeout(1_000);
      const afterDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
      const afterState = await readExecutionState(page);
      await page.screenshot({ path: `test-results/live-after-click-${Date.now()}.png`, fullPage: true }).catch(() => undefined);

      const balanceChanged = readBalanceValue(beforeState.accountMode) !== readBalanceValue(afterState.accountMode);
      const dealsChanged = afterDeals !== beforeDeals && !/No opened trades/i.test(afterDeals);
      const opened = dealsChanged || balanceChanged;

      const result: ExecutionResult = {
        ok: opened,
        status: opened ? "OPENED" : "FAILED",
        message: opened
          ? `Real-money order submitted for ${intent.asset} ${intent.direction}`
          : `Real-money order click did not create an opened trade for ${intent.asset} ${intent.direction}`,
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
        event: opened ? "live.trade.execute.opened" : "live.trade.execute.failed",
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

  private async ensurePage(reason: string) {
    mkdirSync("test-results", { recursive: true });
    mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });
    this.clearIdleTimer();

    if (!this.context) {
      await writeWorkerLog({
        event: "live.browser.opening",
        message: `Opening Pocket Option browser for real-money trading (${env.POCKET_OPTION_HEADLESS ? "headless" : "visible"})`,
        metadata: {
          reason,
          headless: env.POCKET_OPTION_HEADLESS
        }
      });
      this.context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
      this.page = this.context.pages()[0] ?? (await this.context.newPage());
      await writeWorkerLog({
        event: "live.browser.opened",
        message: "Pocket Option browser is open for real-money trading"
      });
    }

    const page = this.page && !this.page.isClosed() ? this.page : await this.context.newPage();
    this.page = page;
    const tradeUrl = env.POCKET_OPTION_LIVE_TRADE_URL;

    if (await this.isExistingLivePageReady(page)) {
      await writeWorkerLog({
        event: "live.pocket-option.page.reused",
        message: "Reusing existing Pocket Option real-money trade page",
        metadata: {
          reason,
          url: page.url(),
          account: await readAccountMode(page)
        }
      });
      return page;
    }

    await writeWorkerLog({
      event: "live.pocket-option.page.opening",
      message: "Playwright is opening the Pocket Option page for real-money trading",
      metadata: {
        reason,
        url: tradeUrl
      }
    });

    try {
      await openCabinet(page, tradeUrl);
      await ensureSessionReady(page);
      await assertLiveAccount(page, env.POCKET_OPTION_LIVE_ACCOUNT_TEXT);
    } catch (error) {
      await writeWorkerLog({
        event: "live.pocket-option.page.failed",
        message: error instanceof Error ? error.message : "Playwright could not prepare the real-money Pocket Option page",
        level: "error",
        metadata: {
          reason,
          url: tradeUrl
        }
      });
      throw error;
    }

    await writeWorkerLog({
      event: "live.pocket-option.page.ready",
      message: "Playwright opened Pocket Option and confirmed the real-money account",
      metadata: {
        reason,
        url: tradeUrl,
        account: await readAccountMode(page)
      }
    });

    return page;
  }

  private async isExistingLivePageReady(page: Page) {
    if (!/cabinet/i.test(page.url())) {
      return false;
    }

    try {
      await ensureSessionReady(page);
      await assertLiveAccount(page, env.POCKET_OPTION_LIVE_ACCOUNT_TEXT);
      return true;
    } catch {
      return false;
    }
  }

  private async closeNow(reason: string) {
    this.clearIdleTimer();
    if (!this.context) {
      return;
    }

    await writeWorkerLog({
      event: "live.browser.closing",
      message: `Closing real-money Pocket Option browser: ${reason}`
    });
    await this.context.close().catch(() => undefined);
    this.context = undefined;
    this.page = undefined;
    this.prepared = undefined;
    await writeWorkerLog({
      event: "live.browser.closed",
      message: "Real-money Pocket Option browser closed"
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

  private isPreparedFor(intent: TradeIntent) {
    return (
      this.prepared?.signalId === intent.signalId &&
      this.prepared.asset === intent.asset &&
      this.prepared.direction === intent.direction &&
      this.prepared.amount === intent.amount &&
      this.prepared.expirySeconds === intent.expirySeconds
    );
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

export const pocketOptionLiveSession = new PocketOptionLiveSession();

function runLiveGuard(intent: TradeIntent, manualApproved: boolean) {
  const decision = (() => {
    try {
      assertLivePlaywrightGuard(intent);
      return {
        ok: true,
        message: "Live Playwright trading is unlocked"
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Live Playwright trading is locked"
      };
    }
  })();

  if (!decision.ok) {
    return decision;
  }

  if (env.LIVE_REQUIRE_MANUAL_APPROVAL && !manualApproved) {
    return {
      ok: false,
      message: "LIVE_REQUIRE_MANUAL_APPROVAL is true; refusing automatic real-money click"
    };
  }

  return decision;
}

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
