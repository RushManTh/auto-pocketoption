import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant =
    normalized.includes("win") || normalized.includes("open") || normalized.includes("connected") || normalized.includes("allowed")
      ? "success"
      : normalized.includes("loss") || normalized.includes("fail") || normalized.includes("reject") || normalized.includes("kill")
        ? "destructive"
        : normalized.includes("pending") || normalized.includes("waiting") || normalized.includes("queued")
          ? "warning"
          : "secondary";

  return (
    <Badge variant={variant} className="max-w-36 shrink-0 truncate">
      {status}
    </Badge>
  );
}
