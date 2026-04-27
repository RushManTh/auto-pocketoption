import type { OrderRow } from "@/components/order-table";
import type { SignalRow } from "@/components/signal-table";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export type DashboardMetric = {
  label: string;
  value: string;
  kind: "trades" | "pl" | "losses" | "age";
};

export type ManualApprovalIntentRow = {
  id: string;
  asset: string;
  direction: string;
  amount: string;
  expiry: string;
  risk: string;
  createdAt: string;
};

export async function getDashboardData() {
  const [signals, orders, metrics] = await Promise.all([
    getSignalRows(8),
    getOrderRows(8),
    getDashboardMetrics()
  ]);

  return {
    signals,
    orders,
    metrics
  };
}

export async function getSignalRows(take = 50): Promise<SignalRow[]> {
  const signals = await prisma.signal.findMany({
    take,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      telegramMessage: true
    }
  });

  return signals.map((signal) => ({
    id: signal.id,
    time: formatTime(signal.createdAt),
    source: signal.sourceText,
    asset: signal.asset ?? "-",
    direction: signal.direction ?? "-",
    expiry: signal.expirySeconds ? formatExpiry(signal.expirySeconds) : "-",
    status: signal.status,
    confidence: `${Math.round(signal.confidence * 100)}%`
  }));
}

export async function getOrderRows(take = 50): Promise<OrderRow[]> {
  const orders = await prisma.order.findMany({
    take,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      tradeIntent: true
    }
  });

  return orders.map((order) => ({
    id: order.id,
    time: formatTime(order.createdAt),
    asset: order.asset,
    direction: order.direction,
    amount: `$${order.amount.toFixed(2)}`,
    expiry: formatExpiry(order.expirySeconds),
    mode: order.tradeIntent.mode,
    status: order.status,
    result: order.result ?? "-"
  }));
}

export async function getManualApprovalIntentRows(): Promise<ManualApprovalIntentRow[]> {
  const intents = await prisma.tradeIntent.findMany({
    where: {
      status: "WAITING_APPROVAL"
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  return intents.map((intent) => ({
    id: intent.id,
    asset: intent.asset,
    direction: intent.direction,
    amount: `$${intent.amount.toFixed(2)}`,
    expiry: formatExpiry(intent.expirySeconds),
    risk: intent.riskAllowed ? "Allowed" : intent.riskReason,
    createdAt: formatTime(intent.createdAt)
  }));
}

async function getDashboardMetrics(): Promise<DashboardMetric[]> {
  const today = startOfToday();
  const [tradesToday, ordersToday, latestOrders] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: {
          gte: today
        }
      }
    }),
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: today
        }
      },
      select: {
        profitLoss: true
      }
    }),
    prisma.order.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: 20,
      select: {
        result: true
      }
    })
  ]);

  const dailyPl = ordersToday.reduce((sum, order) => sum + (order.profitLoss ?? 0), 0);
  const consecutiveLosses = countConsecutiveLosses(latestOrders.map((order) => order.result));

  return [
    { label: "Trades today", value: String(tradesToday), kind: "trades" },
    { label: "Daily P/L", value: `$${dailyPl.toFixed(2)}`, kind: "pl" },
    { label: "Consecutive losses", value: String(consecutiveLosses), kind: "losses" },
    { label: "Signal max age", value: `${env.SIGNAL_MAX_AGE_SECONDS}s`, kind: "age" }
  ];
}

function countConsecutiveLosses(results: Array<string | null>) {
  let count = 0;

  for (const result of results) {
    if (result === "LOSS") {
      count += 1;
      continue;
    }

    if (result) {
      break;
    }
  }

  return count;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatExpiry(seconds: number) {
  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }

  return `${seconds}s`;
}
