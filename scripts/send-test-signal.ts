import { sendTelegramBotMessage, testSignalTemplates } from "../src/lib/telegram-bot";
import { parseSignalMessage } from "../src/domain/signals/parser";

const sequence = process.argv[2] ?? "full";

const sequences: Record<string, string[]> = {
  setup: [testSignalTemplates.setup],
  call: [testSignalTemplates.entryCall],
  put: [testSignalTemplates.entryPut],
  go: [testSignalTemplates.go],
  result: [testSignalTemplates.loss],
  full: [testSignalTemplates.setup, testSignalTemplates.entryCall, testSignalTemplates.go, testSignalTemplates.loss]
};

async function main() {
  const messages = sequences[sequence];

  if (!messages) {
    throw new Error(`Unknown sequence "${sequence}". Use one of: ${Object.keys(sequences).join(", ")}`);
  }

  for (const message of messages) {
    const parsed = parseSignalMessage(message);
    await sendTelegramBotMessage(message);
    console.log(JSON.stringify({ sent: message, parsed }, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
