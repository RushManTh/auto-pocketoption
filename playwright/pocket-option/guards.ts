import type { Page } from "playwright";
import { closeAssetPicker, closePromotionalModals } from "./actions";
import { pocketOptionSelectors } from "./selectors";

export type GuardInput = {
  expectedAsset: string;
  expectedExpirySeconds: number;
  expectedAmount: number;
  signalReceivedAt: Date;
  maxSignalAgeSeconds: number;
  enforceExpiryMatch: boolean;
};

export type GuardResult = {
  ok: boolean;
  reason: string;
};

export async function validateBeforeClick(page: Page, input: GuardInput): Promise<GuardResult> {
  const signalAgeSeconds = (Date.now() - input.signalReceivedAt.getTime()) / 1000;

  if (signalAgeSeconds > input.maxSignalAgeSeconds) {
    return fail("Signal is stale");
  }

  await closeAssetPicker(page);
  await closePromotionalModals(page);
  const blockingModalText = await readBlockingModalText(page);
  if (blockingModalText) {
    return fail(`Blocking modal is visible: ${blockingModalText}`);
  }

  const accountMode = await readText(page, pocketOptionSelectors.accountModeLabel);
  if (!accountMode || !/QT\s+Demo/i.test(accountMode)) {
    return fail(`Demo account is not active: ${accountMode ?? "unknown"}`);
  }

  const currentAsset = await readText(page, pocketOptionSelectors.currentAsset);
  if (currentAsset && !normalizeAssetText(currentAsset).includes(normalizeAssetText(input.expectedAsset))) {
    return fail(`Asset mismatch: expected ${input.expectedAsset}, saw ${currentAsset}`);
  }

  const amountValue = await page.locator(pocketOptionSelectors.amountInput).inputValue().catch(() => "");
  if (amountValue) {
    const numericAmount = Number(amountValue.replace(/[^\d.]/g, ""));
    if (Number.isFinite(numericAmount) && numericAmount !== input.expectedAmount) {
      return fail(`Amount mismatch: expected ${input.expectedAmount}, saw ${numericAmount}`);
    }
  }

  const expiryText = await readText(page, pocketOptionSelectors.expiryValue);
  if (input.enforceExpiryMatch && expiryText && !expiryMatches(expiryText, input.expectedExpirySeconds)) {
    return fail(`Expiry mismatch: expected ${formatDuration(input.expectedExpirySeconds)}, saw ${expiryText}`);
  }

  return {
    ok: true,
    reason: "Guards passed"
  };
}

async function readText(page: Page, selector: string) {
  return page.locator(selector).first().textContent({ timeout: 1000 }).catch(() => null);
}

async function readBlockingModalText(page: Page) {
  const modals = page.locator(pocketOptionSelectors.blockingModal);
  const count = await modals.count().catch(() => 0);

  for (let index = 0; index < count; index += 1) {
    const modal = modals.nth(index);
    if (!(await modal.isVisible().catch(() => false))) {
      continue;
    }

    if ((await modal.locator(pocketOptionSelectors.assetOption).count().catch(() => 0)) > 0) {
      continue;
    }

    return (await modal.textContent().catch(() => "Blocking modal"))?.replace(/\s+/g, " ").trim().slice(0, 160) || "Blocking modal";
  }

  return null;
}

function normalizeAssetText(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function expiryMatches(value: string, expectedSeconds: number) {
  return value.trim() === formatDuration(expectedSeconds);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function fail(reason: string): GuardResult {
  return {
    ok: false,
    reason
  };
}
