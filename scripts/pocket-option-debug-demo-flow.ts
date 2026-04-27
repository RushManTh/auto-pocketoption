import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { validateBeforeClick } from "../playwright/pocket-option/guards";
import {
  closeAssetPicker,
  closePromotionalModals,
  ensureDemoAccount,
  ensureSessionReady,
  openCabinet,
  readAccountMode,
  readCurrentAsset,
  readExpiry,
  readTradeAmount,
  selectAsset,
  setExpiry,
  setTradeAmount
} from "../playwright/pocket-option/actions";
import { pocketOptionSelectors } from "../playwright/pocket-option/selectors";
import { pocketOptionBrowserOptions } from "../src/lib/pocket-option-browser";

const asset = process.argv[2] ?? "EUR/USD OTC";
const amount = Number(process.argv[3] ?? "10");
const expirySeconds = Number(process.argv[4] ?? "300");

async function main() {
  const { env } = await import("../src/lib/env");
  mkdirSync("test-results", { recursive: true });
  mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    await openCabinet(page, env.POCKET_OPTION_BASE_URL);
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);

    const before = await inspectPage(page);
    await page.screenshot({ path: "test-results/debug-demo-flow-before.png", fullPage: true }).catch(() => undefined);

    await ensureSessionReady(page);
    await ensureDemoAccount(page);
    await selectAsset(page, asset);
    await setTradeAmount(page, amount);
    await setExpiry(page, expirySeconds);
    await closeAssetPicker(page);
    await closePromotionalModals(page);
    await page.waitForTimeout(800);

    const guard = await validateBeforeClick(page, {
      expectedAsset: asset,
      expectedAmount: amount,
      expectedExpirySeconds: expirySeconds,
      signalReceivedAt: new Date(),
      maxSignalAgeSeconds: 60,
      enforceExpiryMatch: false
    });
    const after = await inspectPage(page);
    await page.screenshot({ path: "test-results/debug-demo-flow-after.png", fullPage: true }).catch(() => undefined);

    console.log(
      JSON.stringify(
        {
          input: {
            asset,
            amount,
            expirySeconds
          },
          guard,
          before,
          after,
          screenshots: ["test-results/debug-demo-flow-before.png", "test-results/debug-demo-flow-after.png"]
        },
        null,
        2
      )
    );

    process.exitCode = guard.ok ? 0 : 1;
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function inspectPage(page: import("playwright").Page) {
  const [accountMode, currentAsset, tradeAmount, expiry, callButton, putButton, modals] = await Promise.all([
    readAccountMode(page),
    readCurrentAsset(page),
    readTradeAmount(page),
    readExpiry(page),
    inspectLocator(page, pocketOptionSelectors.higherButton),
    inspectLocator(page, pocketOptionSelectors.lowerButton),
    inspectModals(page)
  ]);

  return {
    url: page.url(),
    accountMode,
    currentAsset,
    tradeAmount,
    expiry,
    callButton,
    putButton,
    modals
  };
}

async function inspectLocator(page: import("playwright").Page, selector: string) {
  const locator = page.locator(selector).first();
  const [count, visible, enabled, box, text] = await Promise.all([
    page.locator(selector).count().catch(() => 0),
    locator.isVisible().catch(() => false),
    locator.isEnabled().catch(() => false),
    locator.boundingBox().catch(() => null),
    locator.textContent().catch(() => "")
  ]);

  return {
    selector,
    count,
    visible,
    enabled,
    box,
    text: text?.replace(/\s+/g, " ").trim().slice(0, 120)
  };
}

async function inspectModals(page: import("playwright").Page) {
  const modals = page.locator(pocketOptionSelectors.blockingModal);
  const count = await modals.count().catch(() => 0);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const modal = modals.nth(index);
    const visible = await modal.isVisible().catch(() => false);
    if (!visible) {
      continue;
    }

    rows.push({
      index,
      text: (await modal.textContent().catch(() => ""))?.replace(/\s+/g, " ").trim().slice(0, 300),
      assetPicker: (await modal.locator(pocketOptionSelectors.assetOption).count().catch(() => 0)) > 0,
      closeButtons: await modal
        .locator("button, [role='button'], [aria-label], [title], [class*='close' i]")
        .evaluateAll((nodes) =>
          nodes.slice(0, 30).map((node) => ({
            tag: node.tagName,
            text: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 80),
            aria: node.getAttribute("aria-label"),
            title: node.getAttribute("title"),
            className: node.getAttribute("class")
          }))
        )
        .catch(() => [])
    });
  }

  return rows;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
