import { getTelegramBotChat, getTelegramBotMe } from "../src/lib/telegram-bot";

async function main() {
  const me = await getTelegramBotMe();
  console.log("Bot OK:");
  console.log(JSON.stringify(me.result, null, 2));

  const chat = await getTelegramBotChat();
  console.log("\nChat OK:");
  console.log(JSON.stringify(chat.result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
