import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type WorkerLogPayload = {
  id: string;
  time: string;
  event: string;
  level: string;
  message: string;
  metadata: unknown;
};

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  let interval: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      async function poll() {
        const logs = await prisma.auditLog.findMany({
          where: {
            entityType: "worker"
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 50
        });

        for (const log of logs.reverse()) {
          if (seen.has(log.id)) {
            continue;
          }

          seen.add(log.id);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(toPayload(log))}\n\n`));
        }
      }

      await poll();
      interval = setInterval(() => {
        void poll().catch((error) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: `error-${Date.now()}`,
                time: new Date().toISOString(),
                event: "stream.error",
                level: "error",
                message: error instanceof Error ? error.message : "Worker log stream failed",
                metadata: {}
              })}\n\n`
            )
          );
        });
      }, 1000);

      request.signal.addEventListener("abort", () => {
        if (interval) {
          clearInterval(interval);
        }
        controller.close();
      });
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function toPayload(log: {
  id: string;
  eventType: string;
  message: string;
  metadata: string | null;
  createdAt: Date;
}): WorkerLogPayload {
  const metadata = parseMetadata(log.metadata);

  return {
    id: log.id,
    time: log.createdAt.toISOString(),
    event: log.eventType.replace(/^worker\./, ""),
    level: readLevel(metadata),
    message: log.message,
    metadata
  };
}

function parseMetadata(value: string | null) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readLevel(metadata: unknown) {
  if (metadata && typeof metadata === "object" && "level" in metadata) {
    const level = (metadata as { level?: unknown }).level;
    if (typeof level === "string") {
      return level;
    }
  }

  return "info";
}
