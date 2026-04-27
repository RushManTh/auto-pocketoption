import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

async function main() {
  const { env } = await import("../src/lib/env");

  if (!env.TELEGRAM_API_ID || !env.TELEGRAM_API_HASH) {
    throw new Error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first.");
  }

  const rl = createInterface({ input, output });
  const client = new TelegramClient(new StringSession(""), Number(env.TELEGRAM_API_ID), env.TELEGRAM_API_HASH, {
    connectionRetries: 5
  });

  await client.start({
    phoneNumber: async () => rl.question("Telegram phone number: "),
    password: async () => rl.question("Telegram 2FA password, if enabled: "),
    phoneCode: async () => rl.question("Telegram login code: "),
    onError: (error) => console.error(error)
  });

  console.log("\nTELEGRAM_SESSION=");
  console.log(client.session.save());
  console.log("\nPaste that value into .env.");

  await client.disconnect();
  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
