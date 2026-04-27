import { ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export function RiskStatus() {
  const checks = [
    { label: "Auto trade", status: "disabled" },
    { label: "Kill switch", status: "inactive" },
    { label: "Martingale", status: "disabled" },
    { label: "Daily loss", status: "allowed" }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Risk Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm text-muted-foreground">{check.label}</span>
            <StatusBadge status={check.status} />
          </div>
        ))}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <ShieldX className="mt-0.5 h-3.5 w-3.5" />
          Live auto execution stays locked until demo and compliance checks pass.
        </div>
      </CardContent>
    </Card>
  );
}
