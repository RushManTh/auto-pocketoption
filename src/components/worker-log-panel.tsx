"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CircleAlert, CircleCheck, Loader2, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkerLog = {
  id: string;
  time: string;
  event: string;
  level: "info" | "warn" | "error" | string;
  message: string;
};

const maxRows = 80;

export function WorkerLogPanel() {
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

  const latestStatus = useMemo(() => rows[0]?.message ?? "Waiting for worker logs", [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          Worker Log
        </CardTitle>
        <Badge variant="outline" className="shrink-0 gap-1.5">
          {connected ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {connected ? "Live" : "Connecting"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{latestStatus}</span>
        </div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              No worker activity yet.
            </div>
          ) : (
            rows.map((row) => <WorkerLogRow key={row.id} row={row} />)
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkerLogRow({ row }: { row: WorkerLog }) {
  const isError = row.level === "error";
  const isWarn = row.level === "warn";

  return (
    <div className="grid gap-2 rounded-md border px-3 py-2 text-sm sm:grid-cols-[72px_1fr] sm:gap-3">
      <span className="text-muted-foreground">{formatTime(row.time)}</span>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {isError || isWarn ? (
            <CircleAlert className={`h-3.5 w-3.5 ${isError ? "text-destructive" : "text-amber-500"}`} />
          ) : (
            <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
          )}
          <span className="truncate font-medium">{row.event}</span>
        </div>
        <p className="break-words text-muted-foreground">{row.message}</p>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}
