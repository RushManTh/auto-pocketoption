import { setTimeout as sleep } from "node:timers/promises";
import { Api, TelegramClient } from "telegram";
import { NewMessage, type NewMessageEvent } from "telegram/events";
import { StringSession } from "telegram/sessions";

process.on("unhandledRejection", (reason) => {
  if (reason instanceof Error && reason.message === "TIMEOUT") {
    return;
  }

  console.error(reason);
  process.exitCode = 1;
});

type TelegramEntitySummary = {
  id?: { toString(): string } | string | number;
  title?: string;
  firstName?: string;
  username?: string;
  className?: string;
  megagroup?: boolean;
  broadcast?: boolean;
};

type CliOptions = {
  channels: string[];
  historyLimit: number;
  listenSeconds: number;
};

type TargetChannel = {
  configured: string;
  peerId: string;
  lastMessageId: number;
  canUseChannelDifference: boolean;
  nextHistoryPollAt: number;
  pts?: number;
};

async function main() {
  const { env } = await import("../src/lib/env");

  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH || !env.TELEGRAM_SESSION) {
    throw new Error("Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION in .env first.");
  }

  const options = parseCliOptions(process.argv.slice(2), env.TELEGRAM_CHANNEL_ID);
  if (options.channels.length === 0) {
    throw new Error("Set TELEGRAM_CHANNEL_ID or pass --channel <id-or-username>.");
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

  try {
    const targets: TargetChannel[] = [];

    for (const channel of options.channels) {
      const peerId = await client.getPeerId(channel);
      const entity = (await client.getEntity(channel)) as TelegramEntitySummary;
      const canUseChannelDifference = entity.className === "Channel";
      const pts = canUseChannelDifference ? await readChannelPts(client, peerId) : undefined;
      console.log(
        JSON.stringify(
          {
            check: "resolved_channel",
            configured: channel,
            peerId,
            title: entity.title ?? entity.firstName ?? null,
            username: entity.username ? `@${entity.username}` : null,
            type: entity.className ?? null,
            broadcast: entity.broadcast ?? null,
            megagroup: entity.megagroup ?? null
          },
          null,
          2
        )
      );

      const messages = await client.getMessages(channel, { limit: options.historyLimit });
      const lastMessageId = Math.max(0, ...messages.map((message) => message.id));
      targets.push({
        configured: channel,
        peerId,
        lastMessageId,
        canUseChannelDifference,
        nextHistoryPollAt: 0,
        pts
      });

      console.log(
        JSON.stringify(
          {
            check: "history_read",
            peerId,
            readable: true,
            messageCount: messages.length
          },
          null,
          2
        )
      );

      for (const message of messages) {
        console.log(
          JSON.stringify(
            {
              check: "history_message",
              peerId,
              messageId: message.id,
              date: message.date ? new Date(message.date * 1000).toISOString() : null,
              text: previewText(message.message)
            },
            null,
            2
          )
        );
      }
    }

    if (options.listenSeconds > 0) {
      await listenForNewMessages(client, targets, options.listenSeconds);
    }
  } finally {
    await client.disconnect();
  }
}

function parseCliOptions(args: string[], envChannelId?: string): CliOptions {
  const channels: string[] = [];
  let historyLimit = 5;
  let listenSeconds = 0;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--channel") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--channel requires a value.");
      }
      channels.push(...splitChannels(value));
      index += 1;
      continue;
    }

    if (arg === "--history") {
      historyLimit = readPositiveInt(args[index + 1], "--history");
      index += 1;
      continue;
    }

    if (arg === "--listen") {
      listenSeconds = readPositiveInt(args[index + 1], "--listen");
      index += 1;
      continue;
    }
  }

  if (channels.length === 0) {
    channels.push(...splitChannels(envChannelId ?? ""));
  }

  return {
    channels,
    historyLimit,
    listenSeconds
  };
}

function splitChannels(value: string) {
  return value
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);
}

function readPositiveInt(value: string | undefined, flag: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} requires a positive integer.`);
  }

  return parsed;
}

async function listenForNewMessages(client: TelegramClient, targets: TargetChannel[], listenSeconds: number) {
  const targetChatIds = new Set(targets.map((target) => target.peerId));
  const seen = new Set<string>();
  let eventReceived = 0;
  let pollReceived = 0;
  let polling = false;

  client.addEventHandler((event: NewMessageEvent) => {
    const chatId = event.chatId?.toString();
    if (!chatId || !targetChatIds.has(chatId)) {
      return;
    }

    const key = `${chatId}:${event.message.id}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    eventReceived += 1;
    markTargetSeen(targets, chatId, event.message.id);
    console.log(
      JSON.stringify(
        {
          check: "live_message",
          peerId: chatId,
          messageId: event.message.id,
          date: event.message.date ? new Date(event.message.date * 1000).toISOString() : null,
          text: previewText(event.message.message)
        },
        null,
        2
      )
    );
  }, new NewMessage({}));

  const pollTimer = setInterval(() => {
    if (polling) {
      return;
    }

    polling = true;
    pollForNewMessages(client, targets, seen)
      .then((count) => {
        pollReceived += count;
      })
      .catch((error) => {
        console.error(
          JSON.stringify(
            {
              check: "poll_failed",
              error: error instanceof Error ? error.message : String(error)
            },
            null,
            2
          )
        );
      })
      .finally(() => {
        polling = false;
      });
  }, 1_000);

  console.log(
    JSON.stringify(
      {
        check: "live_listen_started",
        seconds: listenSeconds,
        peerIds: [...targetChatIds],
        differencePollingSeconds: 1,
        historyFallbackSeconds: 5
      },
      null,
      2
    )
  );

  await sleep(listenSeconds * 1000);
  clearInterval(pollTimer);
  pollReceived += await pollForNewMessages(client, targets, seen);

  console.log(
    JSON.stringify(
      {
        check: "live_listen_completed",
        seconds: listenSeconds,
        eventReceived,
        pollReceived,
        received: eventReceived + pollReceived
      },
      null,
      2
    )
  );
}

async function pollForNewMessages(client: TelegramClient, targets: TargetChannel[], seen: Set<string>) {
  let received = 0;

  for (const target of targets) {
    if (target.canUseChannelDifference && target.pts !== undefined) {
      received += await pollChannelDifference(client, target, seen);
      continue;
    }

    if (Date.now() < target.nextHistoryPollAt) {
      continue;
    }

    target.nextHistoryPollAt = Date.now() + 5_000;
    const messages = await client.getMessages(target.configured, { limit: 10 });
    received += await reportNewMessages(messages, target, seen, "poll_message");
  }

  return received;
}

async function pollChannelDifference(client: TelegramClient, target: TargetChannel, seen: Set<string>) {
  const diff = await client.invoke(
    new Api.updates.GetChannelDifference({
      channel: target.configured,
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
    return reportNewMessages(diff.messages, target, seen, "difference_message");
  }

  if (diff.className === "updates.ChannelDifference") {
    return reportNewMessages(diff.newMessages, target, seen, "difference_message");
  }

  return 0;
}

async function reportNewMessages(
  messages: unknown[],
  target: TargetChannel,
  seen: Set<string>,
  check: "poll_message" | "difference_message"
) {
  let received = 0;
  const newMessages = messages
    .filter(isTelegramTextMessage)
    .filter((message) => message.id > target.lastMessageId)
    .sort((a, b) => a.id - b.id);

  for (const message of newMessages) {
    target.lastMessageId = Math.max(target.lastMessageId, message.id);

    const key = `${target.peerId}:${message.id}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    received += 1;
    console.log(
      JSON.stringify(
        {
          check,
          peerId: target.peerId,
          messageId: message.id,
          date: message.date ? new Date(message.date * 1000).toISOString() : null,
          text: previewText(message.message)
        },
        null,
        2
      )
    );
  }

  return received;
}

async function readChannelPts(client: TelegramClient, peerId: string) {
  const dialogs = await client.getDialogs({ limit: 100 });
  const dialog = dialogs.find((candidate) => candidate.id?.toString() === peerId);
  return dialog?.dialog?.pts;
}

function isTelegramTextMessage(message: unknown): message is { id: number; date?: number; message?: string } {
  if (!message || typeof message !== "object") {
    return false;
  }

  return typeof (message as { id?: unknown }).id === "number";
}

function markTargetSeen(targets: TargetChannel[], chatId: string, messageId: number) {
  const target = targets.find((candidate) => candidate.peerId === chatId);
  if (target) {
    target.lastMessageId = Math.max(target.lastMessageId, messageId);
  }
}

function previewText(text: string | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
