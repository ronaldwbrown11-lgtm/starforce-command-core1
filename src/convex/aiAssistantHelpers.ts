import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Lore Assistant — shared helpers for the Node-runtime action in
// aiAssistant.ts. Queries and mutations live here (non-Node), the action
// lives next door ("use node") and calls these via ctx.runQuery /
// ctx.runMutation.
//
// Two-layer metering (#28):
//   1. MONTHLY POOL — the advertised per-tier budget (matches tiers.ts
//      aiCap and the membership page copy: 10 → 2,000 runs/month). This is
//      the real budget; enforcement makes the pricing page literally true.
//   2. DAILY PACE CAP — a per-day sanity ceiling that paces spending so a
//      pool can't be torched in one sitting (and the daily-return habit
//      loop keeps working). The cap never makes the monthly pool
//      unreachable: cap × 30 ≥ pool for every tier.
//
// Worst-case provider cost stays well under subscription price at 100%
// burn (~$0.0023/run on Groq gpt-oss-120b).
// =========================================================================

export const DAILY_LIMITS: Record<string, number> = {
  free: 3,
  cadet: 25,
  officer: 25,
  command: 50,
  // Elite was missing — it silently fell back to the free-tier limit (3/day)
  // while members paid $25/mo for the "1,200 generations" tier.
  elite: 75,
  // 50 made the advertised 2,000/mo unreachable (50 × 30 = 1,500 max).
  gia_agent: 75,
};

// Advertised monthly pools — MUST stay in sync with tiers.ts META and the
// membership page copy.
export const MONTHLY_POOLS: Record<string, number> = {
  free: 10,
  cadet: 100,
  officer: 300,
  command: 750,
  elite: 1200,
  gia_agent: 2000,
};

// 30-day rolling period, identical to usage.ts.
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export const getAssistantUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await ctx.db.get(userId);
    if (!me) return null;
    return {
      tier: me.tier ?? "free",
      displayName: me.displayName ?? me.name ?? "Recruit",
    };
  },
});

export const countTodayUses = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const rows = await ctx.db
      .query("aiAssistantLogs")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((r) => r.createdAt >= dayStart.getTime()).length;
  },
});

export const getMonthlyAiState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await ctx.db.get(userId);
    if (!me) return null;
    const tier = me.tier ?? "free";
    const pool = MONTHLY_POOLS[tier] ?? MONTHLY_POOLS.free;
    const now = Date.now();
    const periodStart = me.monthlyResetAt ?? now;
    const sinceReset = now >= periodStart + MONTH_MS;
    const aiUsed = sinceReset ? 0 : me.monthlyAiUsed ?? 0;
    const isOperator = !!me.opRole || me.role === "admin";
    return { aiUsed, pool, sinceReset, periodStart, isOperator };
  },
});

/** Consume one run from the monthly pool, applying the period reset if due. */
export const consumeMonthlyAi = internalMutation({
  args: { userId: v.id("users"), periodStart: v.number() },
  handler: async (ctx, { userId, periodStart }) => {
    const me = await ctx.db.get(userId);
    if (!me) return { ok: false };
    const sinceReset = Date.now() >= periodStart + MONTH_MS;
    const used = sinceReset ? 0 : me.monthlyAiUsed ?? 0;
    await ctx.db.patch(userId, {
      monthlyAiUsed: used + 1,
      monthlyResetAt: sinceReset ? Date.now() : periodStart,
    });
    return { ok: true, used: used + 1 };
  },
});

export const recordAssistantUse = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await ctx.db.insert("aiAssistantLogs", {
      userId,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
