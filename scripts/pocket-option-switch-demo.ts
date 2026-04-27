import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { pocketOptionBrowserOptions } from "../src/lib/pocket-option-browser";

async function main() {
  const { env } = await import("../src/lib/env");
  mkdirSync("test-results", { recursive: true });
  mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(env.POCKET_OPTION_BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(2_000);

  await page.locator(".balance-info-block").first().click();
  await page.waitForTimeout(1_000);
  await page.locator(".drop-down-modal--balance a.balance-item", { hasText: /QT\s+Demo/i }).first().click();
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(4_000);

  const text = await page.locator("body").innerText();
  await page.screenshot({ path: "test-results/pocket-option-demo-selected.png", fullPage: true }).catch(() => undefined);

  const isDemo = /QT\s+Demo/i.test(text) && !/You are trading on Real account/i.test(text);
  console.log(
    JSON.stringify(
      {
        url: page.url(),
        isDemo,
        text: text.replace(/\s+/g, " ").slice(0, 1200)
      },
      null,
      2
    )
  );

  await context.close();

  if (!isDemo) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
