import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const tradeExecutionQueue = new Queue("trade-execution", {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 100
  }
});

export type TradeExecutionJob = {
  tradeIntentId: string;
  signalId: string;
  requestedAt: string;
};

