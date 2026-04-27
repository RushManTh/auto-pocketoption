import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Execution, risk limits, and safety defaults.</p>
      </div>
      <SettingsForm />
    </div>
  );
}
