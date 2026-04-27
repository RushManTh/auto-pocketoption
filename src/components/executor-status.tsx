import { Bot, CircleCheck, CircleDashed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/lib/env";
import { evaluateLivePlaywrightGuard } from "@/lib/live-trading-guard";

export function ExecutorStatus() {
  const liveGuard = evaluateLivePlaywrightGuard();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Executor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Mode</span>
          <span className="font-medium capitalize">{env.EXECUTION_MODE}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Queue</span>
          <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CircleCheck className="h-3.5 w-3.5" />
            Ready
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Browser</span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <CircleDashed className="h-3.5 w-3.5" />
            {env.POCKET_OPTION_HEADLESS ? "Headless" : "Visible"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Live Playwright</span>
          <span className={`flex items-center gap-2 ${liveGuard.allowed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
            {liveGuard.allowed ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
            {liveGuard.allowed ? "Unlocked" : "Locked"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Live approval</span>
          <span className="font-medium">{env.LIVE_REQUIRE_MANUAL_APPROVAL ? "Required" : "Automatic"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
