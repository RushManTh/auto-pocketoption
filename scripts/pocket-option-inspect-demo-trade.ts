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
  await page.waitForTimeout(2_000);

  if (!(await page.locator("body").innerText()).includes("QT Demo")) {
    await page.locator(".balance-info-block").first().click();
    await page.waitForTimeout(1_000);
    await page.locator(".drop-down-modal--balance a.balance-item", { hasText: /QT\s+Demo/i }).first().click();
    await page.waitForTimeout(4_000);
  }

  await page.screenshot({ path: "test-results/pocket-option-demo-trade-inspect.png", fullPage: true }).catch(() => undefined);

  const snapshot = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("button, input, a, div, span"))
      .map((node, index) => {
        const el = node as HTMLElement;
        return {
          index,
          tag: node.tagName,
          text: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 120),
          className: el.className,
          id: el.id,
          name: node.getAttribute("name"),
          type: node.getAttribute("type"),
          value: (node as HTMLInputElement).value
        };
      })
      .filter((item) => /buy|sell|amount|time|payout|demo|real|eur|usd|m4|m5|expiration|opened trades/i.test(`${item.text} ${item.className} ${item.name} ${item.id}`))
      .slice(0, 220);
    return {
      url: location.href,
      text: document.body.innerText.replace(/\s+/g, " ").slice(0, 3000),
      elements: all
    };
  });

  console.log(JSON.stringify(snapshot, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
