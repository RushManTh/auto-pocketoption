export const pocketOptionSelectors = {
  accountModeLabel: ".balance-info-block",
  demoAccountOption: ".drop-down-modal--balance a.balance-item",
  assetButton: ".pair-number-wrap",
  currentAsset: ".current-symbol",
  assetOption: ".alist__link",
  assetPickerModal: ".ReactModalPortal:has(.alist__link)",
  assetSearchInput:
    ".ReactModalPortal input[type='search'], .ReactModalPortal input[placeholder*='Search' i], .ReactModalPortal input[class*='search' i], .ReactModalPortal .search input, .ReactModalPortal input",
  amountInput: ".block--bet-amount input",
  expiryControl: ".block--expiration-inputs .control__value",
  expiryValue: ".block--expiration-inputs .value__val",
  expiryModeButton: ".block--expiration-inputs .control__buttons a",
  higherButton: ".btn-call",
  lowerButton: ".btn-put",
  openOrderPanel: ".deals-list",
  welcomeBonusModal: ".modal:has-text('Welcome Bonus')",
  promotionalModal: "[role='dialog'], .modal, .ReactModalPortal",
  blockingModal: "[role='dialog'], .modal, .ReactModalPortal"
} as const;
