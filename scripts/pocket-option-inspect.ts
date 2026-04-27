import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { pocketOptionBrowserOptions } from "../src/lib/pocket-option-browser";

async function main() {
  const { env } = await import("../src/lib/env");
  mkdirSync("test-results", { recursive: true });
  mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(env.POCKET_OPTION_BASE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(5_000);

  const snapshot = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"))
      .slice(0, 80)
      .map((button, index) => ({
        index,
        text: button.textContent?.replace(/\s+/g, " ").trim(),
        aria: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
        className: button.className
      }));
    const inputs = Array.from(document.querySelectorAll("input"))
      .slice(0, 40)
      .map((input, index) => ({
        index,
        type: input.getAttribute("type"),
        name: input.getAttribute("name"),
        placeholder: input.getAttribute("placeholder"),
        value: input.value,
        className: input.className
      }));
    const text = document.body.innerText.replace(/\s+/g, " ").slice(0, 5000);

    return {
      url: location.href,
      title: document.title,
      text,
      buttons,
      inputs
    };
  });

  await page.screenshot({ path: "test-results/pocket-option-inspect.png", fullPage: true }).catch(() => undefined);
  console.log(JSON.stringify(snapshot, null, 2));

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
