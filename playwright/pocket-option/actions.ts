import type { Locator, Page } from "playwright";
import { pocketOptionSelectors } from "./selectors";

const PROMOTIONAL_MODAL_TEXT_PATTERN =
  /Welcome Bonus|deposit bonus|successful trades|Your deposit bonus|Congratulations!|maximum bonus|first deposit|financial success|Continue your journey/i;

export async function openCabinet(page: Page, baseUrl: string) {
  await page.goto(baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000
  });
}

export async function ensureSessionReady(page: Page) {
  const loginVisible = await page.getByText(/log in|sign in/i).first().isVisible().catch(() => false);
  if (loginVisible) {
    throw new Error("Pocket Option session is not logged in");
  }

  await page.locator(pocketOptionSelectors.accountModeLabel).first().waitFor({
    state: "visible",
    timeout: 30_000
  });
}

export async function ensureDemoAccount(page: Page) {
  const balance = page.locator(pocketOptionSelectors.accountModeLabel).first();
  const balanceText = await balance.innerText({ timeout: 10_000 });

  if (/QT\s+Demo/i.test(balanceText)) {
    return;
  }

  await balance.click();
  await page.waitForTimeout(800);
  await page.locator(pocketOptionSelectors.demoAccountOption, { hasText: /QT\s+Demo/i }).first().click({
    timeout: 10_000
  });
  await page.waitForTimeout(3_000);

  const updatedBalanceText = await balance.innerText({ timeout: 10_000 });
  if (!/QT\s+Demo/i.test(updatedBalanceText)) {
    throw new Error(`Could not switch to demo account. Current account: ${updatedBalanceText}`);
  }
}

export async function ensureLiveAccount(page: Page, accountText: string) {
  const expectedAccount = accountText.trim();
  if (!expectedAccount) {
    throw new Error("Live account text is required before switching to a real-money account");
  }

  const balance = page.locator(pocketOptionSelectors.accountModeLabel).first();
  const balanceText = await balance.innerText({ timeout: 10_000 });

  if (isDemoAccount(balanceText)) {
    await balance.click();
    await page.waitForTimeout(800);
    await page.locator(pocketOptionSelectors.demoAccountOption, { hasText: expectedAccount }).first().click({
      timeout: 10_000
    });
    await page.waitForTimeout(3_000);
  }

  const updatedBalanceText = await balance.innerText({ timeout: 10_000 });
  if (isDemoAccount(updatedBalanceText)) {
    throw new Error(`Pocket Option is still on a demo account: ${updatedBalanceText}`);
  }

  if (!normalize(updatedBalanceText).includes(normalize(expectedAccount))) {
    throw new Error(`Could not confirm live account "${expectedAccount}". Current account: ${updatedBalanceText}`);
  }
}

export function isDemoAccount(accountModeText: string) {
  return /QT\s+Demo/i.test(accountModeText);
}

export async function selectAsset(page: Page, asset: string) {
  const currentAsset = await page.locator(pocketOptionSelectors.currentAsset).first().innerText().catch(() => "");

  if (normalize(currentAsset).includes(normalize(asset))) {
    await closeAssetPicker(page);
    return;
  }

  await page.locator(pocketOptionSelectors.assetButton).first().click();
  await page.waitForTimeout(800);

  try {
    await clickAssetOption(page, asset);
  } catch (error) {
    await page.screenshot({ path: `test-results/select-asset-failed-${Date.now()}.png`, fullPage: true }).catch(() => undefined);
    throw error;
  }

  await page.waitForTimeout(1_000);
  await closeAssetPicker(page);

  const updatedAsset = await readCurrentAsset(page);
  if (!normalize(updatedAsset).includes(normalize(asset))) {
    throw new Error(`Could not select asset ${asset}. Current asset: ${updatedAsset || "unknown"}`);
  }
}

export async function setTradeAmount(page: Page, amount: number) {
  const input = page.locator(pocketOptionSelectors.amountInput).first();
  await input.click({ force: true });
  await input.fill(String(amount));
  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(500);
}

export async function setExpiry(page: Page, expirySeconds: number) {
  const target = formatDuration(expirySeconds);
  const current = await readExpiry(page);

  if (current === target) {
    return;
  }

  // Pocket Option does not expose a stable text input for this control in the tested UI.
  // Leave the value untouched; the guard will decide whether a mismatch is allowed.
}

export async function clickDirection(page: Page, direction: "CALL" | "PUT") {
  await closePromotionalModals(page);
  const selector = direction === "CALL" ? pocketOptionSelectors.higherButton : pocketOptionSelectors.lowerButton;
  await page.locator(selector).first().click();
}

export async function closeAssetPicker(page: Page) {
  const picker = page.locator(pocketOptionSelectors.assetPickerModal).first();
  if (!(await picker.isVisible().catch(() => false))) {
    return;
  }

  await page.keyboard.press("Escape").catch(() => undefined);
  await picker.waitFor({ state: "hidden", timeout: 1_500 }).catch(async () => {
    await page.mouse.click(700, 500).catch(() => undefined);
    await picker.waitFor({ state: "hidden", timeout: 1_500 }).catch(async () => {
      await page.addStyleTag({
        content: ".ReactModalPortal:has(.alist__link) { display: none !important; pointer-events: none !important; }"
      });
    });
  });

  await page.waitForTimeout(300);
}

export async function closePromotionalModals(page: Page) {
  const modal = await findVisiblePromotionalModal(page);

  if (!modal) {
    return;
  }

  const closeCandidates = [
    modal.locator("a.modal-close, .modal-close").first(),
    modal.getByRole("button", { name: /close|dismiss|later|not now|skip|cancel|×|x/i }).first(),
    modal.locator("[aria-label*='close' i], [title*='close' i], [class*='close' i], .btn-close").first(),
    modal.getByText(/Continue to accumulate bonus|not now|later|skip/i).first(),
    modal.locator("button, a").last()
  ];

  for (const candidate of closeCandidates) {
    if ((await candidate.count().catch(() => 0)) === 0) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
    await candidate.click({ force: true, timeout: 1_500 }).catch(() => undefined);

    if (await waitForPromotionalModalToClose(page)) {
      return;
    }
  }

  await page.keyboard.press("Escape").catch(() => undefined);
  if (await waitForPromotionalModalToClose(page)) {
    return;
  }

  const box = await modal.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width - 24, box.y + 24).catch(() => undefined);
    if (await waitForPromotionalModalToClose(page)) {
      return;
    }
  }

  await hidePromotionalModal(page);
  await page.waitForTimeout(300);
}

export async function readAccountMode(page: Page) {
  return page.locator(pocketOptionSelectors.accountModeLabel).first().innerText().catch(() => "");
}

export async function readCurrentAsset(page: Page) {
  return page.locator(pocketOptionSelectors.currentAsset).first().innerText().catch(() => "");
}

export async function readTradeAmount(page: Page) {
  return page.locator(pocketOptionSelectors.amountInput).first().inputValue().catch(() => "");
}

export async function readExpiry(page: Page) {
  return page.locator(pocketOptionSelectors.expiryValue).first().innerText().catch(() => "");
}

function normalize(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function clickAssetOption(page: Page, asset: string) {
  const modalOption = page.locator(`.ReactModalPortal ${pocketOptionSelectors.assetOption}`, { hasText: asset }).first();

  if (await modalOption.isVisible().catch(() => false)) {
    await modalOption.click({ timeout: 3_000 }).catch(async () => {
      await modalOption.click({ force: true, timeout: 3_000 });
    });
    return;
  }

  const option = page.locator(pocketOptionSelectors.assetOption, { hasText: asset }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click({ timeout: 3_000 }).catch(async () => {
      await option.click({ force: true, timeout: 3_000 });
    });
    return;
  }

  const options = page.locator(`.ReactModalPortal ${pocketOptionSelectors.assetOption}, ${pocketOptionSelectors.assetOption}`);
  const count = await options.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const candidate = options.nth(index);
    const text = await candidate.textContent().catch(() => "");
    if (!normalize(text ?? "").includes(normalize(asset))) {
      continue;
    }

    await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
    await candidate.click({ force: true, timeout: 3_000 });
    return;
  }

  throw new Error(`Asset option ${asset} was not found in Pocket Option asset picker`);
}

async function waitForPromotionalModalToClose(page: Page) {
  const modal = await findVisiblePromotionalModal(page);
  if (!modal) {
    return true;
  }

  await modal.waitFor({ state: "hidden", timeout: 1_000 }).catch(() => undefined);
  return !(await (await findVisiblePromotionalModal(page))?.isVisible().catch(() => false));
}

async function hidePromotionalModal(page: Page) {
  await page
    .evaluate(`
      (() => {
        const modals = Array.from(document.querySelectorAll(".modal"));
        for (const modal of modals) {
          if (!${PROMOTIONAL_MODAL_TEXT_PATTERN}.test(modal.textContent || "")) {
            continue;
          }

          const overlay = modal.closest(".ReactModalPortal") || modal.closest(".ReactModal__Overlay") || modal;
          modal.style.display = "none";
          modal.style.pointerEvents = "none";
          overlay.style.display = "none";
          overlay.style.pointerEvents = "none";
        }
      })()
    `)
    .catch(() => undefined);
}

async function findVisiblePromotionalModal(page: Page): Promise<Locator | null> {
  const modals = page.locator(pocketOptionSelectors.promotionalModal);
  const count = await modals.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const modal = modals.nth(index);
    if (!(await modal.isVisible().catch(() => false))) {
      continue;
    }

    const text = await modal.textContent().catch(() => "");
    if (isPromotionalModalText(text)) {
      return modal;
    }
  }

  return null;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function isPromotionalModalText(text: string | null | undefined) {
  return PROMOTIONAL_MODAL_TEXT_PATTERN.test(text ?? "");
}
