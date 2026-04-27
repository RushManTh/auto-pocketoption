import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type WorkerLogLevel = "info" | "warn" | "error";

export type WorkerLogInput = {
  event: string;
  message: string;
  level?: WorkerLogLevel;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeWorkerLog(input: WorkerLogInput) {
  const level = input.level ?? "info";
  const payload = {
    event: input.event,
    entityId: input.entityId,
    metadata: input.metadata
  };

  logger[level](payload, input.message);

  await prisma.auditLog
    .create({
      data: {
        eventType: `worker.${input.event}`,
        entityType: "worker",
        entityId: input.entityId ?? "telegram-worker",
        message: input.message,
        metadata: JSON.stringify({
          level,
          ...(input.metadata ?? {})
        })
      }
    })
    .catch((error) => {
      logger.error({ error, input }, "Failed to persist worker log");
    });
}
