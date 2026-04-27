import { env } from "@/lib/env";

export type TelegramSendMessageResult = {
  ok: boolean;
  error_code?: number;
  description?: string;
  result?: unknown;
};

export class TelegramBotApiError extends Error {
  readonly status: number;
  readonly errorCode?: number;
  readonly description: string;

  constructor(status: number, payload: TelegramSendMessageResult) {
    super(payload.description ?? `Telegram Bot API failed with ${status}`);
    this.name = "TelegramBotApiError";
    this.status = status;
    this.errorCode = payload.error_code;
    this.description = payload.description ?? this.message;
  }
}

export async function sendTelegramBotMessage(text: string, chatId = env.TELEGRAM_TEST_CHAT_ID) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  if (!chatId) {
    throw new Error("TELEGRAM_TEST_CHAT_ID is not set.");
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  const payload = (await response.json()) as TelegramSendMessageResult;

  if (!response.ok || !payload.ok) {
    throw new TelegramBotApiError(response.status, payload);
  }

  return payload;
}

export async function getTelegramBotMe() {
  return callTelegramBotApi("getMe");
}

export async function getTelegramBotChat(chatId = env.TELEGRAM_TEST_CHAT_ID) {
  if (!chatId) {
    throw new Error("TELEGRAM_TEST_CHAT_ID is not set.");
  }

  return callTelegramBotApi("getChat", {
    chat_id: chatId
  });
}

async function callTelegramBotApi(method: string, body?: Record<string, unknown>) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "content-type": "application/json"
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = (await response.json()) as TelegramSendMessageResult;

  if (!response.ok || !payload.ok) {
    throw new TelegramBotApiError(response.status, payload);
  }

  return payload;
}

export const testSignalTemplates = {
  setup: "5min Candle\n5min expiry\nwait for go\nWithout martingale",
  entryCall: "OPEN EUR / AUD HIGHER FOR 5 MIN",
  entryPut: "OPEN EUR / AUD LOWER FOR 5 MIN",
  go: "Go",
  loss: "Lost option",
  win: "Win option"
} as const;
