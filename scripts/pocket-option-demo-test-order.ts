import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { pocketOptionBrowserOptions } from "../src/lib/pocket-option-browser";

const asset = process.argv[2] ?? "AUD/USD OTC";
const direction = (process.argv[3] ?? "CALL").toUpperCase() === "PUT" ? "PUT" : "CALL";
const amount = Number(process.argv[4] ?? "10");

async function main() {
  const { env } = await import("../src/lib/env");
  mkdirSync("test-results", { recursive: true });
  mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await page.goto(env.POCKET_OPTION_BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2_000);
    await ensureDemo(page);
    await selectAsset(page, asset);
    await setAmount(page, amount);

    const balanceText = await page.locator(".balance-info-block").first().innerText();
    const currentAsset = await page.locator(".current-symbol").first().innerText();
    const amountValue = await page.locator(".block--bet-amount input").first().inputValue();

    if (!/QT\s+Demo/i.test(balanceText)) {
      throw new Error(`Not in demo account. Balance text: ${balanceText}`);
    }

    if (!normalize(currentAsset).includes(normalize(asset))) {
      throw new Error(`Asset mismatch. Expected ${asset}, saw ${currentAsset}`);
    }

    if (Number(amountValue) !== amount) {
      throw new Error(`Amount mismatch. Expected ${amount}, saw ${amountValue}`);
    }

    await page.screenshot({ path: "test-results/demo-order-before-click.png", fullPage: true });
    const beforeDeals = await page.locator(".deals-list").first().innerText().catch(() => "");

    await page.locator(direction === "CALL" ? ".btn-call" : ".btn-put").first().click();
    await page.waitForTimeout(1_000);

    const afterDeals = await page.locator(".deals-list").first().innerText().catch(() => "");
    await page.screenshot({ path: "test-results/demo-order-after-click.png", fullPage: true });

    const opened = afterDeals !== beforeDeals && !/No opened trades/i.test(afterDeals);
    const dbRows = await persistResult({
      asset,
      direction,
      amount,
      opened,
      beforeDeals,
      afterDeals
    });

    console.log(
      JSON.stringify(
        {
          ok: opened,
          asset,
          direction,
          amount,
          balanceText,
          currentAsset,
          beforeDeals,
          afterDeals,
          dbRows
        },
        null,
        2
      )
    );

    if (!opened) {
      process.exitCode = 1;
    }
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function ensureDemo(page: import("playwright").Page) {
  const balanceText = await page.locator(".balance-info-block").first().innerText().catch(() => "");

  if (/QT\s+Demo/i.test(balanceText)) {
    return;
  }

  await page.locator(".balance-info-block").first().click();
  await page.waitForTimeout(800);
  await page.locator(".drop-down-modal--balance a.balance-item", { hasText: /QT\s+Demo/i }).first().click();
  await page.waitForTimeout(3_000);
}

async function selectAsset(page: import("playwright").Page, expectedAsset: string) {
  const currentAsset = await page.locator(".current-symbol").first().innerText().catch(() => "");

  if (normalize(currentAsset).includes(normalize(expectedAsset))) {
    return;
  }

  await page.locator(".pair-number-wrap").first().click();
  await page.waitForTimeout(800);
  await page.locator(".alist__link", { hasText: expectedAsset }).first().click();
  await page.waitForTimeout(3_000);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.mouse.click(700, 500).catch(() => undefined);
  await page.waitForTimeout(800);
}

async function setAmount(page: import("playwright").Page, value: number) {
  const input = page.locator(".block--bet-amount input").first();
  await input.click({ force: true });
  await input.fill(String(value));
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(500);
}

async function persistResult(input: {
  asset: string;
  direction: "CALL" | "PUT";
  amount: number;
  opened: boolean;
  beforeDeals: string;
  afterDeals: string;
}) {
  const now = new Date();
  const signal = await prisma.signal.create({
    data: {
      asset: input.asset.replace(" OTC", ""),
      direction: input.direction,
      expirySeconds: 3,
      waitForGo: false,
      martingale: false,
      status: input.opened ? "OPENED" : "FAILED",
      confidence: 1,
      sourceText: `DEMO TEST ORDER ${input.asset} ${input.direction}`
    }
  });

  const intent = await prisma.tradeIntent.create({
    data: {
      signalId: signal.id,
      asset: input.asset,
      direction: input.direction,
      amount: input.amount,
      expirySeconds: 3,
      mode: "demo",
      executeAt: now,
      status: input.opened ? "COMPLETED" : "FAILED",
      riskAllowed: true,
      riskReason: "Manual demo-only test"
    }
  });

  const order = await prisma.order.create({
    data: {
      tradeIntentId: intent.id,
      broker: "pocket_option",
      asset: input.asset,
      direction: input.direction,
      amount: input.amount,
      expirySeconds: 3,
      openedAt: input.opened ? now : undefined,
      status: input.opened ? "OPENED" : "FAILED",
      executorLog: JSON.stringify({
        beforeDeals: input.beforeDeals,
        afterDeals: input.afterDeals
      })
    }
  });

  return {
    signalId: signal.id,
    tradeIntentId: intent.id,
    orderId: order.id
  };
}

function normalize(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
