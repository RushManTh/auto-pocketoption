import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, type NewMessageEvent } from "telegram/events";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { handleDemoAutoTrade } from "@/lib/demo-auto-trader";
import { persistTelegramSignal } from "@/lib/signal-persistence";
import { writeWorkerLog } from "@/lib/worker-log";

type TelegramTextMessage = {
  id: number;
  date?: number;
  message?: string;
  peerId?: {
    className?: string;
  };
};

type TargetChannel = {
  configured: string;
  inputEntity: Awaited<ReturnType<TelegramClient["getInputEntity"]>>;
  peerId: string;
  lastMessageId: number;
  canUseChannelDifference: boolean;
  nextHistoryPollAt: number;
  pts?: number;
};

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
  const targetFilteringEnabled = parseConfiguredChannelIds(env.TELEGRAM_CHANNEL_ID).length > 0;
  const targetChannels = await resolveTargetChannels(client, env.TELEGRAM_CHANNEL_ID);
  const targetChatIds = new Set(targetChannels.map((target) => target.peerId));
  logger.info("Telegram worker connected");
  await writeWorkerLog({
    event: "telegram.connected",
    message: "Telegram worker connected",
    metadata: {
      channelId: env.TELEGRAM_CHANNEL_ID,
      resolvedChannelIds: [...targetChatIds],
      pollIntervalSeconds: env.TELEGRAM_POLL_INTERVAL_SECONDS
    }
  });

  client.addEventHandler(async (event) => {
    const message = event.message;
    const eventChatId = readEventChatId(event);

    if (targetFilteringEnabled && (!eventChatId || !targetChatIds.has(eventChatId))) {
      return;
    }

    markTargetSeen(targetChannels, eventChatId, message.id);
    await handleTelegramMessage(message, eventChatId ?? env.TELEGRAM_CHANNEL_ID ?? "unknown", "event");
  }, new NewMessage({}));

  startPollingTargetChannels(client, targetChannels);
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

function readEventChatId(event: NewMessageEvent) {
  return event.chatId?.toString();
}

async function resolveTargetChannels(client: TelegramClient, configuredChannelId?: string): Promise<TargetChannel[]> {
  const targets = parseConfiguredChannelIds(configuredChannelId);
  const channels: TargetChannel[] = [];
  const dialogs = await client.getDialogs({ limit: 200 });

  for (const target of targets) {
    const resolved = await resolveTargetInput(client, target, dialogs);
    if (!resolved) {
      await writeWorkerLog({
        event: "telegram.target.skipped",
        message: `Telegram target could not be resolved: ${target}`,
        level: "warn",
        metadata: {
          target
        }
      });
      continue;
    }

    const canUseChannelDifference = isChannelEntity(resolved.entity) || isInputChannelEntity(resolved.inputEntity);
    const pts = canUseChannelDifference ? readChannelPtsFromDialogs(dialogs, resolved.peerId) : undefined;
    const latest = await client.getMessages(resolved.inputEntity, { limit: 1 });
    const lastMessageId = Math.max(0, ...latest.map((message) => message.id));

    channels.push({
      configured: target,
      inputEntity: resolved.inputEntity,
      peerId: resolved.peerId,
      lastMessageId,
      canUseChannelDifference,
      nextHistoryPollAt: 0,
      pts
    });
  }

  return channels;
}

function startPollingTargetChannels(client: TelegramClient, targets: TargetChannel[]) {
  if (targets.length === 0) {
    return;
  }

  void writeWorkerLog({
    event: "telegram.polling.started",
    message: `Telegram channel difference polling started every ${env.TELEGRAM_POLL_INTERVAL_SECONDS}s`,
    metadata: {
      channels: targets.map(({ configured, peerId, lastMessageId, canUseChannelDifference, pts }) => ({
        configured,
        peerId,
        lastMessageId,
        canUseChannelDifference,
        pts
      }))
    }
  });

  let polling = false;
  setInterval(() => {
    if (polling) {
      return;
    }

    polling = true;
    pollTargetChannels(client, targets)
      .catch((error) => {
        void writeWorkerLog({
          event: "telegram.polling.failed",
          message: error instanceof Error ? error.message : "Telegram polling failed",
          level: "warn"
        });
      })
      .finally(() => {
        polling = false;
      });
  }, env.TELEGRAM_POLL_INTERVAL_SECONDS * 1000);
}

async function pollTargetChannels(client: TelegramClient, targets: TargetChannel[]) {
  for (const target of targets) {
    if (target.canUseChannelDifference && target.pts !== undefined) {
      await pollChannelDifference(client, target);
      continue;
    }

    if (Date.now() < target.nextHistoryPollAt) {
      continue;
    }

    target.nextHistoryPollAt = Date.now() + Math.max(env.TELEGRAM_POLL_INTERVAL_SECONDS * 1000, 5_000);
    const messages = await client.getMessages(target.inputEntity, { limit: 10 });
    await handlePolledMessages(messages, target, "poll");
  }
}

async function pollChannelDifference(client: TelegramClient, target: TargetChannel) {
  const diff = await client.invoke(
    new Api.updates.GetChannelDifference({
      channel: target.inputEntity,
      filter: new Api.ChannelMessagesFilterEmpty(),
      pts: target.pts ?? 0,
      limit: 20
    })
  );

  if (diff.className === "updates.ChannelDifference" || diff.className === "updates.ChannelDifferenceEmpty") {
    target.pts = diff.pts;
  }

  if (diff.className === "updates.ChannelDifferenceTooLong") {
    const dialogPts = "pts" in diff.dialog ? diff.dialog.pts : undefined;
    target.pts = dialogPts ?? target.pts;
    await handlePolledMessages(diff.messages, target, "difference");
    return;
  }

  if (diff.className === "updates.ChannelDifference") {
    await handlePolledMessages(diff.newMessages, target, "difference");
  }
}

async function handlePolledMessages(messages: unknown[], target: TargetChannel, source: "poll" | "difference") {
  const newMessages = messages
    .filter(isTelegramTextMessage)
    .filter((message) => message.id > target.lastMessageId)
    .sort((a, b) => a.id - b.id);

  for (const message of newMessages) {
    target.lastMessageId = Math.max(target.lastMessageId, message.id);
    await handleTelegramMessage(message, target.peerId, source);
  }
}

function readChannelPtsFromDialogs(dialogs: Awaited<ReturnType<TelegramClient["getDialogs"]>>, peerId: string) {
  const dialog = dialogs.find((candidate) => candidate.id?.toString() === peerId);
  return dialog?.dialog?.pts;
}

function isTelegramTextMessage(message: unknown): message is TelegramTextMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<TelegramTextMessage>;
  return typeof candidate.id === "number";
}

function isChannelEntity(entity: unknown) {
  return !!entity && typeof entity === "object" && (entity as { className?: string }).className === "Channel";
}

function isInputChannelEntity(entity: unknown) {
  return !!entity && typeof entity === "object" && (entity as { className?: string }).className === "InputPeerChannel";
}

async function resolveTargetInput(
  client: TelegramClient,
  target: string,
  dialogs: Awaited<ReturnType<TelegramClient["getDialogs"]>>
) {
  try {
    const inputEntity = await client.getInputEntity(target);
    const peerId = await client.getPeerId(inputEntity);
    const dialog = dialogs.find((candidate) => candidate.id?.toString() === peerId);

    return {
      inputEntity,
      peerId,
      entity: dialog?.entity
    };
  } catch (error) {
    const peerId = await client.getPeerId(target).catch(() => null);
    const dialog = peerId ? dialogs.find((candidate) => candidate.id?.toString() === peerId) : undefined;

    if (!dialog) {
      await writeWorkerLog({
        event: "telegram.target.resolve_failed",
        message: error instanceof Error ? error.message : `Could not resolve Telegram target ${target}`,
        level: "warn",
        metadata: {
          target,
          peerId
        }
      });
      return null;
    }

    const dialogPeerId = dialog.id?.toString();
    if (!dialogPeerId) {
      return null;
    }

    return {
      inputEntity: dialog.inputEntity,
      peerId: dialogPeerId,
      entity: dialog.entity
    };
  }
}

async function handleTelegramMessage(message: TelegramTextMessage, channelId: string, source: "event" | "poll" | "difference") {
  const text = message.message;

  if (!text) {
    return;
  }

  const telegramMessageId = String(message.id);
  await writeWorkerLog({
    event: "signal.received",
    message: `Telegram message received: ${text.slice(0, 120)}`,
    entityId: telegramMessageId,
    metadata: {
      channelId,
      telegramMessageId,
      source
    }
  });

  const persisted = await persistTelegramSignal({
    telegramMessageId,
    channelId,
    text,
    messageDate: toTelegramMessageDate(message.date),
    rawPayload: {
      id: message.id,
      date: message.date,
      chatId: channelId,
      peerId: message.peerId?.className,
      source
    }
  });

  logger.info(
    {
      messageId: message.id,
      signalId: persisted.signal.id,
      signalCreated: persisted.created,
      parsed: persisted.parsed,
      source
    },
    "Telegram signal parsed"
  );
  await writeWorkerLog({
    event: "signal.parsed",
    message: `Parsed signal as ${persisted.parsed.type}`,
    entityId: persisted.signal.id,
    metadata: {
      parsed: persisted.parsed,
      signalCreated: persisted.created,
      source
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
      autoTrade,
      source
    },
    "Telegram signal auto trade handled"
  );
}

function markTargetSeen(targets: TargetChannel[], chatId: string | undefined, messageId: number) {
  if (!chatId) {
    return;
  }

  const target = targets.find((candidate) => candidate.peerId === chatId);
  if (target) {
    target.lastMessageId = Math.max(target.lastMessageId, messageId);
  }
}

function parseConfiguredChannelIds(configuredChannelId?: string) {
  return (configuredChannelId ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
