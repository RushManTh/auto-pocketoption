"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, CircleCheck, Loader2, MonitorUp, Radio, Send, SquareActivity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkerLog = {
  id: string;
  time: string;
  event: string;
  level: "info" | "warn" | "error" | string;
  message: string;
};

type StatusTone = "success" | "warning" | "destructive" | "secondary";

type StatusItem = {
  key: string;
  label: string;
  status: string;
  detail: string;
  time?: string;
  tone: StatusTone;
  icon: typeof Bot;
};

const maxRows = 80;

export function SystemStatusPanel() {
  const [rows, setRows] = useState<WorkerLog[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const source = new EventSource("/api/worker-logs/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as WorkerLog;
      setRows((current) => {
        if (current.some((row) => row.id === parsed.id)) {
          return current;
        }

        return [parsed, ...current].slice(0, maxRows);
      });
    };

    return () => {
      source.close();
    };
  }, []);

  const statuses = useMemo(() => buildStatuses(rows), [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <SquareActivity className="h-4 w-4" />
          System Status
        </CardTitle>
        <Badge variant="outline" className="shrink-0 gap-1.5">
          {connected ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {connected ? "Live" : "Connecting"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {statuses.map((item) => (
            <StatusTile key={item.key} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusTile({ item }: { item: StatusItem }) {
  const Icon = item.icon;

  return (
    <div className="min-w-0 rounded-md border bg-muted/20 p-3">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{item.label}</span>
        </div>
        <Badge variant={item.tone} className="shrink-0">
          {item.status}
        </Badge>
      </div>
      <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{item.detail}</p>
      <p className="mt-3 text-xs text-muted-foreground">{item.time ? `Updated ${formatTime(item.time)}` : "Waiting for activity"}</p>
    </div>
  );
}

function buildStatuses(rows: WorkerLog[]): StatusItem[] {
  const telegram = latestMatching(rows, (row) => row.event.startsWith("telegram."));
  const browser = latestMatching(rows, (row) => row.event.startsWith("browser.") || row.event.startsWith("live.browser."));
  const pocketPage = latestMatching(
    rows,
    (row) => row.event.startsWith("pocket-option.page.") || row.event.startsWith("live.pocket-option.page.")
  );
  const trade = latestMatching(rows, (row) => row.event.startsWith("trade."));
  const liveTrade = latestMatching(rows, (row) => row.event.startsWith("live.trade."));

  return [
    buildTelegramStatus(telegram),
    buildBrowserStatus(browser),
    buildPocketPageStatus(pocketPage),
    buildLiveTradeStatus(liveTrade),
    buildTradeStatus(trade)
  ];
}

function buildTelegramStatus(row: WorkerLog | undefined): StatusItem {
  if (!row) {
    return idleStatus("telegram", "Telegram", "No connection log yet", "Waiting for Telegram worker", Bot);
  }

  if (row.event === "telegram.connected") {
    return activeStatus("telegram", "Telegram", "Running", row.message, row.time, Bot);
  }

  if (row.level === "error" || row.event === "telegram.config.missing") {
    return errorStatus("telegram", "Telegram", "Needs attention", row.message, row.time, Bot);
  }

  return activeStatus("telegram", "Telegram", "Active", row.message, row.time, Bot);
}

function buildBrowserStatus(row: WorkerLog | undefined): StatusItem {
  if (!row) {
    return idleStatus("browser", "Playwright Browser", "No browser activity yet", "Waiting for Playwright to launch Pocket Option", MonitorUp);
  }

  if (row.event === "browser.opening" || row.event === "live.browser.opening") {
    return warningStatus("browser", "Playwright Browser", "Opening", row.message, row.time, MonitorUp);
  }

  if (row.event === "browser.closed" || row.event === "live.browser.closed") {
    return idleStatus("browser", "Playwright Browser", "Closed", row.message, MonitorUp, row.time);
  }

  if (row.event === "browser.closing" || row.event === "live.browser.closing") {
    return warningStatus("browser", "Playwright Browser", "Closing", row.message, row.time, MonitorUp);
  }

  return activeStatus("browser", "Playwright Browser", "Open", row.message, row.time, MonitorUp);
}

function buildPocketPageStatus(row: WorkerLog | undefined): StatusItem {
  if (!row) {
    return idleStatus("pocket-page", "Pocket Option Page", "Not opened yet", "Waiting for Playwright to open Pocket Option", Radio);
  }

  if (row.event === "pocket-option.page.opening" || row.event === "live.pocket-option.page.opening") {
    return warningStatus("pocket-page", "Pocket Option Page", "Opening", row.message, row.time, Radio);
  }

  if (row.level === "error" || row.event === "pocket-option.page.failed" || row.event === "live.pocket-option.page.failed") {
    return errorStatus("pocket-page", "Pocket Option Page", "Failed", row.message, row.time, Radio);
  }

  return activeStatus("pocket-page", "Pocket Option Page", "Opened", row.message, row.time, Radio);
}

function buildTradeStatus(row: WorkerLog | undefined): StatusItem {
  if (!row) {
    return idleStatus("trade", "Demo Trade", "Idle", "No trade preparation or execution yet", Send);
  }

  if (row.event.endsWith(".started")) {
    return warningStatus("trade", "Demo Trade", "Working", row.message, row.time, Send);
  }

  if (row.level === "error" || row.event.endsWith(".failed")) {
    return errorStatus("trade", "Demo Trade", "Failed", row.message, row.time, Send);
  }

  if (row.event.endsWith(".completed") || row.event.endsWith(".opened")) {
    return activeStatus("trade", "Demo Trade", "Ready", row.message, row.time, Send);
  }

  return warningStatus("trade", "Demo Trade", "Pending", row.message, row.time, Send);
}

function buildLiveTradeStatus(row: WorkerLog | undefined): StatusItem {
  if (!row) {
    return idleStatus("live-trade", "Live Trading", "Locked", "No real-money trading activity yet", Send);
  }

  if (row.event === "live.trade.locked" || row.event === "live.trade.execute.blocked") {
    return warningStatus("live-trade", "Live Trading", "Locked", row.message, row.time, Send);
  }

  if (row.event === "live.trade.manual_approval.required" || row.event.includes("manual_approval_required")) {
    return warningStatus("live-trade", "Live Trading", "Approval", row.message, row.time, Send);
  }

  if (row.event.endsWith(".started")) {
    return warningStatus("live-trade", "Live Trading", "Working", row.message, row.time, Send);
  }

  if (row.level === "error" || row.event.endsWith(".failed")) {
    return errorStatus("live-trade", "Live Trading", "Failed", row.message, row.time, Send);
  }

  if (row.event.endsWith(".opened")) {
    return activeStatus("live-trade", "Live Trading", "Opened", row.message, row.time, Send);
  }

  return activeStatus("live-trade", "Live Trading", "Ready", row.message, row.time, Send);
}

function latestMatching(rows: WorkerLog[], predicate: (row: WorkerLog) => boolean) {
  return rows.find(predicate);
}

function activeStatus(key: string, label: string, status: string, detail: string, time: string, icon: typeof Bot): StatusItem {
  return {
    key,
    label,
    status,
    detail,
    time,
    tone: "success",
    icon
  };
}

function warningStatus(key: string, label: string, status: string, detail: string, time: string, icon: typeof Bot): StatusItem {
  return {
    key,
    label,
    status,
    detail,
    time,
    tone: "warning",
    icon
  };
}

function errorStatus(key: string, label: string, status: string, detail: string, time: string, icon: typeof Bot): StatusItem {
  return {
    key,
    label,
    status,
    detail,
    time,
    tone: "destructive",
    icon
  };
}

function idleStatus(key: string, label: string, status: string, detail: string, icon: typeof Bot, time?: string): StatusItem {
  return {
    key,
    label,
    status,
    detail,
    time,
    tone: "secondary",
    icon
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}
