import { TestSignalForm } from "@/components/test-signal-form";

export default function TestSignalPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-normal sm:text-2xl">Test Signal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send controlled Telegram messages to a test channel, then let the worker read and parse them.
        </p>
      </div>
      <TestSignalForm />
    </div>
  );
}
