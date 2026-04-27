PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "TelegramMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "telegramMessageId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "rawPayload" TEXT,
  "messageDate" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Signal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "telegramMessageId" TEXT,
  "asset" TEXT,
  "direction" TEXT,
  "expirySeconds" INTEGER,
  "candleSeconds" INTEGER,
  "waitForGo" BOOLEAN NOT NULL DEFAULT false,
  "martingale" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "confidence" REAL NOT NULL DEFAULT 0,
  "sourceText" TEXT NOT NULL,
  "goMessageId" TEXT,
  "goReceivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Signal_telegramMessageId_fkey" FOREIGN KEY ("telegramMessageId") REFERENCES "TelegramMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TradeIntent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "signalId" TEXT NOT NULL,
  "asset" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "expirySeconds" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "executeAt" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "riskAllowed" BOOLEAN NOT NULL DEFAULT false,
  "riskReason" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TradeIntent_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tradeIntentId" TEXT NOT NULL,
  "broker" TEXT NOT NULL,
  "brokerOrderRef" TEXT,
  "asset" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" REAL NOT NULL,
  "expirySeconds" INTEGER NOT NULL,
  "openedAt" DATETIME,
  "closedAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "result" TEXT,
  "profitLoss" REAL,
  "executorLog" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Order_tradeIntentId_fkey" FOREIGN KEY ("tradeIntentId") REFERENCES "TradeIntent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramMessage_telegramMessageId_channelId_key" ON "TelegramMessage"("telegramMessageId", "channelId");
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
