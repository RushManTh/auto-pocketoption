import { z } from "zod";

export const executionModeSchema = z.enum(["paper", "manual", "demo", "live_playwright", "official_api", "live"]);

export const tradeIntentSchema = z.object({
  signalId: z.string(),
  broker: z.literal("pocket_option").default("pocket_option"),
  mode: executionModeSchema,
  asset: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}(?: OTC)?$/),
  direction: z.enum(["CALL", "PUT"]),
  expirySeconds: z.number().int().positive(),
  amount: z.number().positive(),
  executeAt: z.date()
});

export type ExecutionMode = z.infer<typeof executionModeSchema>;
export type TradeIntentInput = z.input<typeof tradeIntentSchema>;
export type TradeIntent = z.output<typeof tradeIntentSchema>;
