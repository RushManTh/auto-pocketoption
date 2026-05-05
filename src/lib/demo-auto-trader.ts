import type { ParsedSignal } from "@/domain/signals/types";
import type { ExecutionResult } from "@/domain/trading/result";
import { tradeIntentSchema, type ExecutionMode, type TradeIntent } from "@/domain/trading/trade-intent";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { evaluateLivePlaywrightGuard } from "@/lib/live-trading-guard";
import { logger } from "@/lib/logger";
import { pocketOptionDemoSession } from "@/lib/pocket-option-demo-session";
import { pocketOptionLiveSession } from "@/lib/pocket-option-live-session";
import { writeWorkerLog } from "@/lib/worker-log";

export type DemoAutoTradeInput = {
  parsed: ParsedSignal;
  signalId: string;
  signalCreated: boolean;
};

type PlaywrightTradeSession = {
  warmUp(reason: string): Promise<void>;
  prepare(intent: TradeIntent): Promise<void>;
  execute(intent: TradeIntent): Promise<ExecutionResult>;
};

type AutoTradeStrategy = {
  mode: Extract<ExecutionMode, "demo" | "live_playwright">;
  label: "Demo" | "Live";
  session: PlaywrightTradeSession;
  amount: number;
  requireGo: boolean;
  requireManualApproval: boolean;
};

export async function handleDemoAutoTrade(input: DemoAutoTradeInput) {
  const strategy = await getAutoTradeStrategy();
  if (!strategy) {
    return skip("Playwright auto trade is disabled");
  }

  if (!input.signalCreated) {
    return skip("Signal already existed");
  }

  if (input.parsed.type === "SETUP") {
    await writeWorkerLog({
      event: "signal.setup",
      message: `Setup signal received, warming up ${strategy.label.toLowerCase()} Pocket Option browser`,
      entityId: input.signalId,
      metadata: {
        mode: strategy.mode,
        expirySeconds: input.parsed.expirySeconds,
        candleSeconds: input.parsed.candleSeconds,
        waitForGo: input.parsed.waitForGo
      }
    });
    await strategy.session.warmUp("setup signal received");
    return skip("Pocket Option warmed up, waiting for entry signal");
  }

  if (input.parsed.type === "ENTRY") {
    if (strategy.requireGo) {
      await markSignalWaitingForGo(input.signalId);
      return prepareSignal(input.signalId, strategy);
    }

    return executeSignal(input.signalId, "ENTRY", strategy);
  }

  if (input.parsed.type === "GO") {
    const candidate = await findLatestEntryWaitingForGo();
    if (!candidate) {
      await writeWorkerLog({
        event: "trade.execute.skipped",
        message: "No recent entry signal is waiting for GO",
        level: "warn",
        entityId: input.signalId
      });
      return skip("No recent entry signal is waiting for GO");
    }

    await prisma.signal.update({
      where: {
        id: candidate.id
      },
      data: {
        goMessageId: input.signalId,
        goReceivedAt: new Date()
      }
    });

    return executeSignal(candidate.id, "GO", strategy);
  }

  if (input.parsed.type === "CANCEL") {
    const candidate = await findLatestEntryWaitingForGo();
    if (!candidate) {
      await writeWorkerLog({
        event: "trade.cancel.skipped",
        message: "No recent entry signal is waiting for NO",
        level: "warn",
        entityId: input.signalId
      });
      return skip("No recent entry signal is waiting for NO");
    }

    await prisma.signal.update({
      where: {
        id: candidate.id
      },
      data: {
        status: "REJECTED",
        goMessageId: input.signalId,
        goReceivedAt: new Date()
      }
    });

    await writeWorkerLog({
      event: "trade.cancelled",
      message: `Trade signal cancelled by NO: ${candidate.asset} ${candidate.direction}`,
      level: "warn",
      entityId: candidate.id,
      metadata: {
        cancelSignalId: input.signalId
      }
    });

    return skip("Pending trade signal cancelled by NO");
  }

  return skip(`Signal type ${input.parsed.type} cannot trigger ${strategy.label.toLowerCase()} execution`);
}

async function getAutoTradeStrategy(): Promise<AutoTradeStrategy | null> {
  if (!env.AUTO_TRADE_ENABLED || env.KILL_SWITCH) {
    return null;
  }

  if (env.EXECUTION_MODE === "demo" && env.DEMO_AUTO_TRADE_ENABLED) {
    return {
      mode: "demo",
      label: "Demo",
      session: pocketOptionDemoSession,
      amount: env.POCKET_OPTION_DEMO_TRADE_AMOUNT,
      requireGo: env.DEMO_AUTO_TRADE_REQUIRE_GO,
      requireManualApproval: false
    };
  }

  if (env.EXECUTION_MODE === "live_playwright") {
    const guard = evaluateLivePlaywrightGuard();
    if (!guard.allowed) {
      await writeWorkerLog({
        event: "live.trade.locked",
        message: guard.reason,
        level: "warn"
      });
      return null;
    }

    return {
      mode: "live_playwright",
      label: "Live",
      session: pocketOptionLiveSession,
      amount: env.POCKET_OPTION_LIVE_TRADE_AMOUNT,
      requireGo: env.DEMO_AUTO_TRADE_REQUIRE_GO,
      requireManualApproval: env.LIVE_REQUIRE_MANUAL_APPROVAL
    };
  }

  return null;
}

async function markSignalWaitingForGo(signalId: string) {
  await prisma.signal.update({
    where: {
      id: signalId
    },
    data: {
      status: "WAITING_GO",
      waitForGo: true
    }
  });
}

async function prepareSignal(signalId: string, strategy: AutoTradeStrategy) {
  const signal = await prisma.signal.findUnique({
    where: {
      id: signalId
    }
  });

  if (!signal) {
    return skip(`Signal ${signalId} was not found`);
  }

  if (!signal.asset || !signal.direction || !signal.expirySeconds) {
    await prisma.signal.update({
      where: {
        id: signal.id
      },
      data: {
        status: "REJECTED"
      }
    });
    return skip("Signal is missing asset, direction, or expiry");
  }

  if (strategy.requireManualApproval) {
    await writeWorkerLog({
      event: "live.trade.prepare.manual_approval_required",
      message: "Live trade preparation is waiting for GO and manual approval; browser preparation skipped",
      entityId: signal.id
    });
    return {
      executed: false,
      prepared: false,
      reason: "Live signal is waiting for GO and manual approval"
    };
  }

  try {
    const intent = buildIntent(signal, strategy);
    await strategy.session.prepare(intent);
    return {
      executed: false,
      prepared: true,
      reason: `Prepared ${intent.asset} ${intent.direction}; waiting for GO`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown prepare error";
    await prisma.signal.update({
      where: {
        id: signal.id
      },
      data: {
        status: "FAILED"
      }
    });
    await writeWorkerLog({
      event: strategy.mode === "live_playwright" ? "live.trade.prepare.failed" : "trade.prepare.failed",
      message,
      level: "error",
      entityId: signal.id
    });
    return {
      executed: false,
      prepared: false,
      reason: message
    };
  }
}

async function findLatestEntryWaitingForGo() {
  const cutoff = new Date(Date.now() - env.DEMO_AUTO_TRADE_ENTRY_LOOKBACK_SECONDS * 1000);

  const baseWhere = {
    asset: {
      not: null
    },
    direction: {
      not: null
    },
    expirySeconds: {
      not: null
    },
    createdAt: {
      gte: cutoff
    },
    tradeIntents: {
      none: {}
    }
  };

  return (
    (await prisma.signal.findFirst({
      where: {
        ...baseWhere,
        status: "WAITING_GO"
      },
      orderBy: {
        createdAt: "desc"
      }
    })) ??
    prisma.signal.findFirst({
      where: {
        ...baseWhere,
        status: "ENTRY_RECEIVED"
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  );
}

async function executeSignal(signalId: string, trigger: "ENTRY" | "GO", strategy: AutoTradeStrategy) {
  const signal = await prisma.signal.findUnique({
    where: {
      id: signalId
    },
    include: {
      tradeIntents: true
    }
  });

  if (!signal) {
    return skip(`Signal ${signalId} was not found`);
  }

  if (signal.tradeIntents.length > 0) {
    return skip(`Signal ${signalId} already has a trade intent`);
  }

  if (!signal.asset || !signal.direction || !signal.expirySeconds) {
    await prisma.signal.update({
      where: {
        id: signal.id
      },
      data: {
        status: "REJECTED"
      }
    });
    return skip("Signal is missing asset, direction, or expiry");
  }

  const intent = buildIntent(signal, strategy);
  const isWaitingApproval = strategy.requireManualApproval;

  const tradeIntent = await prisma.tradeIntent.create({
    data: {
      signalId: intent.signalId,
      asset: intent.asset,
      direction: intent.direction,
      amount: intent.amount,
      expirySeconds: intent.expirySeconds,
      mode: intent.mode,
      executeAt: intent.executeAt,
      status: isWaitingApproval ? "WAITING_APPROVAL" : "EXECUTING",
      riskAllowed: true,
      riskReason: `${strategy.label} auto trade triggered by ${trigger}`
    }
  });

  await prisma.signal.update({
    where: {
      id: signal.id
    },
    data: {
      status: isWaitingApproval ? "WAITING_APPROVAL" : "EXECUTING"
    }
  });

  if (isWaitingApproval) {
    await writeWorkerLog({
      event: "live.trade.manual_approval.required",
      message: `Real-money trade is waiting for manual approval: ${intent.asset} ${intent.direction}`,
      entityId: tradeIntent.id,
      metadata: {
        signalId: signal.id,
        trigger,
        amount: intent.amount,
        expirySeconds: intent.expirySeconds
      }
    });

    logger.info(
      {
        signalId: signal.id,
        tradeIntentId: tradeIntent.id
      },
      "Live auto trade is waiting for manual approval"
    );

    return {
      executed: false,
      reason: "Real-money trade is waiting for manual approval",
      tradeIntentId: tradeIntent.id
    };
  }

  const result: ExecutionResult = await strategy.session.execute(intent).catch((error): ExecutionResult => ({
    ok: false,
    status: "FAILED" as const,
    message: error instanceof Error ? error.message : "Unknown Playwright execution error"
  }));
  const finishedAt = new Date();
  const orderStatus = result.ok ? result.status : "FAILED";

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
      status: orderStatus,
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
      id: signal.id
    },
    data: {
      status: result.ok ? "OPENED" : "FAILED"
    }
  });

  logger.info(
    {
      signalId: signal.id,
      tradeIntentId: tradeIntent.id,
      orderId: order.id,
      result
    },
    `${strategy.label} auto trade completed`
  );

  return {
    executed: result.ok,
    reason: result.message,
    tradeIntentId: tradeIntent.id,
    orderId: order.id
  };
}

function skip(reason: string) {
  logger.info({ reason }, "Playwright auto trade skipped");
  return {
    executed: false,
    reason
  };
}

function buildIntent(signal: {
  id: string;
  asset: string | null;
  direction: string | null;
  expirySeconds: number | null;
}, strategy: AutoTradeStrategy) {
  return tradeIntentSchema.parse({
    signalId: signal.id,
    mode: strategy.mode,
    asset: signal.asset,
    direction: signal.direction,
    expirySeconds: signal.expirySeconds,
    amount: strategy.amount,
    executeAt: new Date()
  });
}
