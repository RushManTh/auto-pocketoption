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
  await page.waitForTimeout(3_000);

  await page.locator(".current-symbol, .pair-number-wrap, text=/EUR\\/USD OTC/i").first().click().catch(async () => {
    await page.mouse.click(180, 100);
  });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: "test-results/pocket-option-assets.png", fullPage: true }).catch(() => undefined);

  const snapshot = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ").slice(0, 8000);
    const candidates = Array.from(document.querySelectorAll("a, button, div, span, li"))
      .filter((node) => /[A-Z]{3}\/[A-Z]{3}|OTC|Crypto|Stock|Commodity/i.test(node.textContent ?? ""))
      .slice(0, 200)
      .map((node, index) => ({
        index,
        tag: node.tagName,
        text: node.textContent?.replace(/\s+/g, " ").trim().slice(0, 180),
        className: (node as HTMLElement).className
      }));

    return { url: location.href, text, candidates };
  });

  console.log(JSON.stringify(snapshot, null, 2));
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
