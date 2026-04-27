import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { pocketOptionBrowserOptions } from "../src/lib/pocket-option-browser";

async function main() {
  const { env } = await import("../src/lib/env");
  mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(env.POCKET_OPTION_BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2_000);
  if (!(await page.locator("body").innerText()).includes("QT Demo")) {
    await page.locator(".balance-info-block").first().click();
    await page.waitForTimeout(800);
    await page.locator(".drop-down-modal--balance a.balance-item", { hasText: /QT\s+Demo/i }).first().click();
    await page.waitForTimeout(3_000);
  }

  const html = await page.locator(".block--bet-amount").first().evaluate((node) => node.outerHTML);
  const expirationHtml = await page.locator(".block--expiration-inputs").first().evaluate((node) => node.outerHTML);
  console.log(JSON.stringify({ amountHtml: html, expirationHtml }, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
