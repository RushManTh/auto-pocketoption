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
  await page.waitForTimeout(3_000);

  await page.locator("text=/QT\\s+Real|Real|THB/").first().click({ timeout: 5_000 }).catch(async () => {
    await page.mouse.click(1205, 32);
  });
  await page.waitForTimeout(1_500);

  await page.screenshot({ path: "test-results/pocket-option-account-menu.png", fullPage: true }).catch(() => undefined);

  const snapshot = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").slice(0, 6000);
    const candidates = Array.from(document.querySelectorAll("button, a, div, li, span"))
      .filter((node) => /demo|real|balance|practice|quick trading|qt/i.test(node.textContent ?? ""))
      .slice(0, 120)
      .map((node, index) => ({
        index,
        tag: node.tagName,
        text: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 160),
        className: (node as HTMLElement).className
      }));

    return {
      url: location.href,
      title: document.title,
      text,
      candidates
    };
  });

  console.log(JSON.stringify(snapshot, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
