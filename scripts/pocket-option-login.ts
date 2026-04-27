import { mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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

  console.log("\nPocket Option browser opened.");
  console.log(`Browser channel: ${env.POCKET_OPTION_BROWSER_CHANNEL ?? "bundled chromium"}`);
  console.log("Login manually with Google in the opened browser window.");
  console.log("Finish any Google verification, 2FA, captcha, or device checks yourself.");
  console.log("After you can see the Pocket Option cabinet/dashboard, return here and press Enter.\n");

  const rl = createInterface({ input, output });
  await rl.question("Press Enter after login is complete...");
  rl.close();

  await page.screenshot({
    path: "test-results/pocket-option-login-check.png",
    fullPage: true
  }).catch(() => undefined);

  await context.close();
  console.log(`\nSession saved in: ${env.POCKET_OPTION_PROFILE_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
