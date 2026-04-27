import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function main() {
  const { env } = await import("../src/lib/env");

  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH || !env.TELEGRAM_SESSION) {
    throw new Error("Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION in .env first.");
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
  const dialogs = await client.getDialogs({ limit: 100 });

  for (const dialog of dialogs) {
    const entity = dialog.entity as {
      id?: { toString(): string } | string | number;
      title?: string;
      firstName?: string;
      username?: string;
      className?: string;
      megagroup?: boolean;
      broadcast?: boolean;
    };
    const rawId = entity.id?.toString() ?? "";
    const title = entity.title ?? entity.firstName ?? "(no title)";
    const username = entity.username ? `@${entity.username}` : "-";
    const type = entity.className ?? "Unknown";
    const recommendedId = recommendTelegramChatId(rawId, entity);

    console.log(
      JSON.stringify(
        {
          title,
          username,
          type,
          rawId,
          recommendedId
        },
        null,
        2
      )
    );
  }

  await client.disconnect();
}

function recommendTelegramChatId(rawId: string, entity: { className?: string; megagroup?: boolean; broadcast?: boolean }) {
  if (!rawId) {
    return "";
  }

  if (entity.className === "Channel" || entity.megagroup || entity.broadcast) {
    return rawId.startsWith("-100") ? rawId : `-100${rawId}`;
  }

  return rawId;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
