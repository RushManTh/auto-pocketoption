import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { pocketOptionBrowserOptions } from "../src/lib/pocket-option-browser";

async function main() {
  const { env } = await import("../src/lib/env");
  mkdirSync(env.POCKET_OPTION_PROFILE_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(env.POCKET_OPTION_PROFILE_DIR, pocketOptionBrowserOptions());

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(env.POCKET_OPTION_BASE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });

  console.log("Pocket Option opened with saved Playwright profile.");
  console.log("Close the browser window when finished.");

  await page.waitForTimeout(60 * 60 * 1000);
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
