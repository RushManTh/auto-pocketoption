"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionState = "idle" | "approving" | "rejecting";

export function ManualApprovalActions({ tradeIntentId }: { tradeIntentId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>("idle");
  const [message, setMessage] = useState<string>();

  async function decide(decision: "approve" | "reject") {
    setState(decision === "approve" ? "approving" : "rejecting");
    setMessage(undefined);

    try {
      const response = await fetch("/api/manual-approval", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          tradeIntentId,
          decision
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Manual approval request failed");
      }

      setMessage(decision === "approve" ? "Approved and submitted." : "Rejected.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown manual approval error");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <Button size="sm" className="w-full sm:w-auto" disabled={state !== "idle"} onClick={() => decide("approve")}>
          <Check className="h-4 w-4" />
          {state === "approving" ? "Approving" : "Approve"}
        </Button>
        <Button size="sm" variant="outline" className="w-full sm:w-auto" disabled={state !== "idle"} onClick={() => decide("reject")}>
          <X className="h-4 w-4" />
          {state === "rejecting" ? "Rejecting" : "Reject"}
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
