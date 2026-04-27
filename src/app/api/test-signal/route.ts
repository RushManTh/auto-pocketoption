import { NextResponse } from "next/server";
import { z } from "zod";
import { parseSignalMessage } from "@/domain/signals/parser";
import {
  getTelegramBotChat,
  getTelegramBotMe,
  sendTelegramBotMessage,
  TelegramBotApiError,
  testSignalTemplates
} from "@/lib/telegram-bot";

const requestSchema = z.object({
  message: z.string().min(1).max(1000),
  chatId: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const telegram = await sendTelegramBotMessage(body.message, body.chatId);
    const parsed = parseSignalMessage(body.message);

    return NextResponse.json({
      ok: true,
      parsed,
      signalId: null,
      signalCreated: false,
      persistedBy: "telegram_worker",
      telegram
    });
  } catch (error) {
    return telegramErrorResponse(error);
  }
}

export async function GET() {
  try {
    const me = await getTelegramBotMe().catch((error) => ({
      ok: false,
      error: formatTelegramError(error)
    }));
    const chat = await getTelegramBotChat().catch((error) => ({
      ok: false,
      error: formatTelegramError(error)
    }));

    return NextResponse.json({
      ok: true,
      templates: testSignalTemplates,
      diagnostics: {
        bot: me,
        chat
      }
    });
  } catch (error) {
    return telegramErrorResponse(error);
  }
}

function telegramErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: formatTelegramError(error),
      hint:
        "If Telegram says 'chat not found', check TELEGRAM_TEST_CHAT_ID, add the bot to the channel/group, and make the bot an admin for channels."
    },
    {
      status: error instanceof TelegramBotApiError ? 400 : 500
    }
  );
}

function formatTelegramError(error: unknown) {
  if (error instanceof TelegramBotApiError) {
    return {
      type: "TelegramBotApiError",
      status: error.status,
      errorCode: error.errorCode,
      description: error.description
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message
    };
  }

  return {
    type: "UnknownError",
    message: "Unknown error"
  };
}
