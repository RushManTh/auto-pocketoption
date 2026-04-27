import { NextResponse } from "next/server";
import { z } from "zod";
import type { ExecutionResult } from "@/domain/trading/result";
import { tradeIntentSchema } from "@/domain/trading/trade-intent";
import { createExecutor } from "@/executors";
import { prisma } from "@/lib/db";
import { pocketOptionLiveSession } from "@/lib/pocket-option-live-session";
import { writeWorkerLog } from "@/lib/worker-log";

const manualApprovalRequestSchema = z.object({
  tradeIntentId: z.string(),
  decision: z.enum(["approve", "reject"])
});

export async function POST(request: Request) {
  const body = manualApprovalRequestSchema.parse(await request.json());

  const tradeIntent = await prisma.tradeIntent.findUnique({
    where: {
      id: body.tradeIntentId
    }
  });

  if (!tradeIntent) {
    return NextResponse.json(
      {
        ok: false,
        message: "Trade intent was not found"
      },
      {
        status: 404
      }
    );
  }

  if (tradeIntent.status !== "WAITING_APPROVAL") {
    return NextResponse.json(
      {
        ok: false,
        message: `Trade intent is ${tradeIntent.status}, not WAITING_APPROVAL`
      },
      {
        status: 409
      }
    );
  }

  if (body.decision === "reject") {
    await prisma.tradeIntent.update({
      where: {
        id: tradeIntent.id
      },
      data: {
        status: "REJECTED",
        riskReason: `${tradeIntent.riskReason}; manually rejected`
      }
    });
    await prisma.signal.update({
      where: {
        id: tradeIntent.signalId
      },
      data: {
        status: "REJECTED"
      }
    });
    await writeWorkerLog({
      event: "manual_approval.rejected",
      message: `Trade intent rejected: ${tradeIntent.asset} ${tradeIntent.direction}`,
      entityId: tradeIntent.id
    });

    return NextResponse.json({
      ok: true,
      tradeIntentId: body.tradeIntentId,
      decision: body.decision
    });
  }

  await prisma.tradeIntent.update({
    where: {
      id: tradeIntent.id
    },
    data: {
      status: "EXECUTING",
      riskReason: `${tradeIntent.riskReason}; manually approved`
    }
  });

  const intent = tradeIntentSchema.parse({
    signalId: tradeIntent.signalId,
    broker: "pocket_option",
    mode: tradeIntent.mode,
    asset: tradeIntent.asset,
    direction: tradeIntent.direction,
    amount: tradeIntent.amount,
    expirySeconds: tradeIntent.expirySeconds,
    executeAt: tradeIntent.executeAt
  });

  const result = await executeApprovedIntent(intent).catch((error): ExecutionResult => ({
    ok: false,
    status: "FAILED",
    message: error instanceof Error ? error.message : "Unknown manual approval execution error"
  }));

  const finishedAt = new Date();
  const order = await prisma.order.create({
    data: {
      tradeIntentId: tradeIntent.id,
      broker: "pocket_option",
      brokerOrderRef: result.orderId,
      asset: intent.asset,
      direction: intent.direction,
      amount: intent.amount,
      expirySeconds: intent.expirySeconds,
      openedAt: result.ok ? finishedAt : undefined,
      status: result.ok ? result.status : "FAILED",
      executorLog: JSON.stringify({
        message: result.message,
        metadata: result.metadata ?? {}
      })
    }
  });

  await prisma.tradeIntent.update({
    where: {
      id: tradeIntent.id
    },
    data: {
      status: result.ok ? "COMPLETED" : "FAILED"
    }
  });
  await prisma.signal.update({
    where: {
      id: tradeIntent.signalId
    },
    data: {
      status: result.ok ? "OPENED" : "FAILED"
    }
  });
  await writeWorkerLog({
    event: result.ok ? "manual_approval.executed" : "manual_approval.failed",
    message: result.message,
    level: result.ok ? "info" : "warn",
    entityId: tradeIntent.id,
    metadata: {
      orderId: order.id,
      result
    }
  });

  return NextResponse.json({
    ok: true,
    tradeIntentId: body.tradeIntentId,
    decision: body.decision,
    result
  });
}

async function executeApprovedIntent(intent: z.output<typeof tradeIntentSchema>) {
  if (intent.mode === "live_playwright") {
    return pocketOptionLiveSession.executeApproved(intent);
  }

  return createExecutor(intent.mode).execute(intent);
}
