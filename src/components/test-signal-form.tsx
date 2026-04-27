"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const templates = {
  setup: "5min Candle\n5min expiry\nwait for go\nWithout martingale",
  entryCall: "OPEN EUR / AUD HIGHER FOR 5 MIN",
  entryPut: "OPEN EUR / AUD LOWER FOR 5 MIN",
  go: "Go",
  loss: "Lost option",
  win: "Win option"
};

type SendState =
  | {
      status: "idle";
      message?: string;
      detail?: string;
    }
  | {
      status: "sending";
      message: string;
      detail?: string;
    }
  | {
      status: "sent" | "error";
      message: string;
      detail?: string;
    };

export function TestSignalForm() {
  const [message, setMessage] = useState(templates.entryCall);
  const [chatId, setChatId] = useState("");
  const [state, setState] = useState<SendState>({ status: "idle" });

  const preview = useMemo(() => {
    const text = message.toUpperCase();
    if (/^GO[.! ]*$/i.test(message.trim())) {
      return "Type: GO";
    }
    if (text.includes("OPEN") && text.includes("HIGHER")) {
      return "Type: ENTRY, Direction: CALL";
    }
    if (text.includes("OPEN") && text.includes("LOWER")) {
      return "Type: ENTRY, Direction: PUT";
    }
    if (text.includes("LOST") || text.includes("LOSS")) {
      return "Type: RESULT, Result: LOSS";
    }
    if (text.includes("WIN") || text.includes("WON")) {
      return "Type: RESULT, Result: WIN";
    }
    if (text.includes("WAIT FOR GO") || text.includes("EXPIRY") || text.includes("CANDLE")) {
      return "Type: SETUP";
    }
    return "Type: UNKNOWN";
  }, [message]);

  async function send() {
    setState({ status: "sending", message: "Sending test signal to Telegram..." });

    try {
      const response = await fetch("/api/test-signal", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          message,
          chatId: chatId || undefined
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.description ?? payload.error?.message ?? payload.message ?? "Send failed");
      }

      setState({
        status: "sent",
        message: "Signal sent to Telegram. The Telegram worker will persist and process it.",
        detail: JSON.stringify(payload.parsed, null, 2)
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Send Test Signal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {Object.entries(templates).map(([key, value]) => (
              <Button key={key} type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setMessage(value)}>
                {key}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-h-36"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="chat-id">
              Override chat id
            </label>
            <Input
              id="chat-id"
              placeholder="Optional, uses TELEGRAM_TEST_CHAT_ID"
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
            />
          </div>

          <Button className="w-full sm:w-auto" onClick={send} disabled={state.status === "sending"}>
            <Send className="h-4 w-4" />
            Send to Telegram
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parse Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">{preview}</div>
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Status</p>
            <p className="mt-1 text-muted-foreground">{state.message ?? "Ready"}</p>
          </div>
          {state.detail ? (
            <pre className="max-h-80 max-w-full overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{state.detail}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
