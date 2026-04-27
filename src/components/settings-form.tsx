"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function SettingsForm() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Execution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Auto trade" description="Keep off until demo checks pass.">
            <Switch />
          </SettingRow>
          <SettingRow label="Kill switch" description="Stops queue execution immediately.">
            <Switch />
          </SettingRow>
          <SettingRow label="Execution mode" description="Current demo automation mode.">
            <Input defaultValue="demo" />
          </SettingRow>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Risk Limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Default amount" description="Base order size.">
            <Input defaultValue="1" type="number" />
          </SettingRow>
          <SettingRow label="Max trades/day" description="Daily hard cap.">
            <Input defaultValue="3" type="number" />
          </SettingRow>
          <SettingRow label="Signal max age" description="Reject stale Go messages.">
            <Input defaultValue="60" type="number" />
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
