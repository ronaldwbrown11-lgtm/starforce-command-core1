import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Lore Assistant — shared helpers for the Node-runtime action in
// aiAssistant.ts. Queries and mutations live here (non-Node), the action
// lives next door ("use node") and calls these via ctx.runQuery /
// ctx.runMutation.
//
// Daily per-tier allowance (#28): free members get a taste (3 uses/day),
// paid tiers get the full toolkit. Limits keep the Groq bill near zero.
// =========================================================================

export const DAILY_LIMITS: Record<string, number> = {
  free: 3,
  cadet: 25,
  officer: 25,
  command: 50,
  gia_agent: 50,
};

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
