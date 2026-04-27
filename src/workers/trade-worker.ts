import { Worker } from "bullmq";
import { tradeIntentSchema } from "@/domain/trading/trade-intent";
import { createExecutor } from "@/executors";
import { connection } from "@/lib/queue";
import { logger } from "@/lib/logger";

const worker = new Worker(
  "trade-execution",
  async (job) => {
    const intent = tradeIntentSchema.parse({
      ...job.data.intent,
      executeAt: new Date(job.data.intent.executeAt)
    });
    const executor = createExecutor(intent.mode);
    const result = await executor.execute(intent);

    logger.info({ jobId: job.id, result }, "Trade execution finished");
    return result;
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 20_000
  }
);

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "Trade execution failed");
});

logger.info("Trade worker started");

