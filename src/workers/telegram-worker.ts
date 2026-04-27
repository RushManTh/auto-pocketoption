import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { handleDemoAutoTrade } from "@/lib/demo-auto-trader";
import { persistTelegramSignal } from "@/lib/signal-persistence";
import { writeWorkerLog } from "@/lib/worker-log";

async function main() {
  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH || !env.TELEGRAM_SESSION) {
    logger.warn("Telegram env is incomplete. Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION.");
    await writeWorkerLog({
      event: "telegram.config.missing",
      message: "Telegram worker is not running because Telegram env is incomplete",
      level: "warn"
    });
    return;
  }

  const client = new TelegramClient(
    new StringSession(env.TELEGRAM_SESSION),
    Number(env.TELEGRAM_API_ID),
    env.TELEGRAM_API_HASH,
    {
      connectionRetries: 5
    }
  );

  await client.connect();
  logger.info("Telegram worker connected");
  await writeWorkerLog({
    event: "telegram.connected",
    message: "Telegram worker connected",
    metadata: {
      channelId: env.TELEGRAM_CHANNEL_ID
    }
  });

  client.addEventHandler(async (event) => {
    const message = event.message;
    const text = message.message;

    if (!text) {
      return;
    }

    const channelId = env.TELEGRAM_CHANNEL_ID ?? "unknown";
    const telegramMessageId = String(message.id);
    await writeWorkerLog({
      event: "signal.received",
      message: `Telegram message received: ${text.slice(0, 120)}`,
      entityId: telegramMessageId,
      metadata: {
        channelId,
        telegramMessageId
      }
    });

    const persisted = await persistTelegramSignal({
      telegramMessageId,
      channelId,
      text,
      messageDate: toTelegramMessageDate(message.date),
      rawPayload: {
        id: message.id,
        date: message.date
      }
    });

    logger.info(
      {
        messageId: message.id,
        signalId: persisted.signal.id,
        signalCreated: persisted.created,
        parsed: persisted.parsed
      },
      "Telegram signal parsed"
    );
    await writeWorkerLog({
      event: "signal.parsed",
      message: `Parsed signal as ${persisted.parsed.type}`,
      entityId: persisted.signal.id,
      metadata: {
        parsed: persisted.parsed,
        signalCreated: persisted.created
      }
    });

    const autoTrade = await handleDemoAutoTrade({
      parsed: persisted.parsed,
      signalId: persisted.signal.id,
      signalCreated: persisted.created
    });

    logger.info(
      {
        messageId: message.id,
        autoTrade
      },
      "Telegram signal auto trade handled"
    );
  }, new NewMessage({ chats: env.TELEGRAM_CHANNEL_ID ? [env.TELEGRAM_CHANNEL_ID] : undefined }));
}

main().catch((error) => {
  logger.error({ error }, "Telegram worker crashed");
  void writeWorkerLog({
    event: "telegram.crashed",
    message: error instanceof Error ? error.message : "Telegram worker crashed",
    level: "error"
  });
  process.exitCode = 1;
});

function toTelegramMessageDate(date?: number) {
  return date ? new Date(date * 1000) : new Date();
}
