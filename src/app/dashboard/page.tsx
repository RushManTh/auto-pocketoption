import { Activity, Clock3, DollarSign, TrendingDown } from "lucide-react";
import { ExecutorStatus } from "@/components/executor-status";
import { OrderTable } from "@/components/order-table";
import { RiskStatus } from "@/components/risk-status";
import { SignalTable } from "@/components/signal-table";
import { SystemStatusPanel } from "@/components/system-status-panel";
import { WorkerLogPanel } from "@/components/worker-log-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData, type DashboardMetric } from "@/lib/app-data";

export const dynamic = "force-dynamic";

const metricIcons = {
  trades: Activity,
  pl: DollarSign,
  losses: TrendingDown,
  age: Clock3
} satisfies Record<DashboardMetric["kind"], typeof Activity>;

export default async function DashboardPage() {
  const { metrics, signals, orders } = await getDashboardData();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">Dashboard</h2>
        <p className="mt-1 text-sm text-muted-foreground">Minimal control surface for signal intake, risk, and execution.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">{metric.label}</CardTitle>
              {(() => {
                const Icon = metricIcons[metric.kind];
                return <Icon className="h-4 w-4 text-muted-foreground" />;
              })()}
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold sm:text-2xl">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SystemStatusPanel />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Recent Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <SignalTable rows={signals} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          <RiskStatus />
          <ExecutorStatus />
        </div>
      </div>

      <WorkerLogPanel />

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderTable rows={orders} />
        </CardContent>
      </Card>
    </div>
  );
}
