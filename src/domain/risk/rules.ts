import { z } from "zod";

export const riskSettingsSchema = z.object({
  autoTradeEnabled: z.boolean().default(false),
  killSwitch: z.boolean().default(false),
  defaultTradeAmount: z.number().positive().default(1),
  maxTradesPerDay: z.number().int().positive().default(3),
  maxDailyLoss: z.number().nonnegative().default(3),
  maxConsecutiveLosses: z.number().int().nonnegative().default(1),
  signalMaxAgeSeconds: z.number().int().positive().default(5),
  allowMartingale: z.boolean().default(false),
  assetWhitelist: z.array(z.string()).default(["EUR/AUD", "EUR/USD", "GBP/USD"])
});

export type RiskSettings = z.infer<typeof riskSettingsSchema>;

export type RiskRuntimeState = {
  tradesToday: number;
  dailyLoss: number;
  consecutiveLosses: number;
  hasOpenOrderForAsset: boolean;
};

