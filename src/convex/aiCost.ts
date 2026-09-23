import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// =========================================================================
// AI cost ledger (AI Spend console)
//
// One row per successful provider call. Token counts come from the
// provider response's `usage` field (Groq returns OpenAI-compatible
// usage on every completion). Cost is estimated at known per-model
// rates; unknown models fall back to the default rate so nothing
// silently drops from the ledger.
//
// Rates (USD per 1M tokens) — gpt-oss-120b on Groq, published pricing.
// If you switch models, update PRICING here.
// =========================================================================

export type ModelRate = { input: number; output: number };

const PRICING: Record<string, ModelRate> = {
  // Groq, per 1M tokens.
  "openai/gpt-oss-120b": { input: 0.15, output: 0.6 },
  // Fallback for anything not listed — rough blended rate.
  default: { input: 0.15, output: 0.6 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = PRICING[model] ?? PRICING.default;
  const cost =
    (inputTokens / 1_000_000) * rate.input +
    (outputTokens / 1_000_000) * rate.output;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6-decimal dollars
}

// =========================================================================
// Ledger mutations (internal — actions call via ctx.runMutation)
// =========================================================================

export const logAiCall = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    surface: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costUsd: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiCostLogs", {
      userId: args.userId ?? undefined,
      surface: args.surface,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costUsd: args.costUsd,
      createdAt: args.createdAt,
    });
  },
});

/** Pull `usage` out of an OpenAI-compatible completion response body. */
export type ProviderUsage = { inputTokens: number; outputTokens: number };

export function readProviderUsage(data: unknown): ProviderUsage {
  const usage = (
    data as { usage?: { prompt_tokens?: number; completion_tokens?: number } }
  )?.usage;
  return {
    inputTokens: Math.max(0, Math.round(usage?.prompt_tokens ?? 0)),
    outputTokens: Math.max(0, Math.round(usage?.completion_tokens ?? 0)),
  };
}
