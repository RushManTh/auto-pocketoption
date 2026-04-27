import { parseSignalMessage } from "@/domain/signals/parser";
import type { ParsedSignal } from "@/domain/signals/types";
import { prisma } from "@/lib/db";

export type PersistTelegramSignalInput = {
  telegramMessageId: string;
  channelId: string;
  text: string;
  messageDate: Date;
  rawPayload?: unknown;
};

export async function persistTelegramSignal(input: PersistTelegramSignalInput) {
  const parsed = parseSignalMessage(input.text);

  const telegramMessage = await prisma.telegramMessage.upsert({
    where: {
      telegramMessageId_channelId: {
        telegramMessageId: input.telegramMessageId,
        channelId: input.channelId
      }
    },
    update: {
      text: input.text,
      rawPayload: input.rawPayload ? JSON.stringify(input.rawPayload) : undefined,
      messageDate: input.messageDate
    },
    create: {
      telegramMessageId: input.telegramMessageId,
      channelId: input.channelId,
      text: input.text,
      rawPayload: input.rawPayload ? JSON.stringify(input.rawPayload) : undefined,
      messageDate: input.messageDate
    }
  });

  const existingSignal = await prisma.signal.findFirst({
    where: {
      telegramMessageId: telegramMessage.id
    },
    select: {
      id: true
    }
  });

  if (existingSignal) {
    return {
      parsed,
      telegramMessage,
      signal: existingSignal,
      created: false
    };
  }

  const signal = await prisma.signal.create({
    data: {
      telegramMessageId: telegramMessage.id,
      asset: parsed.asset,
      direction: parsed.direction,
      expirySeconds: parsed.expirySeconds,
      candleSeconds: parsed.candleSeconds,
      waitForGo: parsed.waitForGo ?? false,
      martingale: parsed.martingale ?? false,
      status: await statusForParsedSignal(parsed),
      confidence: parsed.confidence,
      sourceText: parsed.sourceText,
      goMessageId: parsed.type === "GO" ? input.telegramMessageId : undefined,
      goReceivedAt: parsed.type === "GO" ? new Date() : undefined
    }
  });

  return {
    parsed,
    telegramMessage,
    signal,
    created: true
  };
}

async function statusForParsedSignal(parsed: ParsedSignal) {
  switch (parsed.type) {
    case "SETUP":
      return "SETUP_RECEIVED";
    case "ENTRY": {
      const latestWaitSetup = await prisma.signal.findFirst({
        where: {
          status: "SETUP_RECEIVED",
          waitForGo: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      return latestWaitSetup ? "WAITING_GO" : "ENTRY_RECEIVED";
    }
    case "GO":
      return "GO_RECEIVED";
    case "RESULT":
      return parsed.result === "WIN" ? "WON" : "LOST";
    default:
      return "REJECTED";
  }
}
