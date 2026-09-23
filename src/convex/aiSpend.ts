import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

// =========================================================================
// AI Spend — operator console analytics over the aiCostLogs ledger.
//
// Answers "what is AI actually costing me?" with real dollars from the
// provider-reported token usage. All queries are operator-gated.
//
// Windows are rolling (24h / 7d / 30d) so no cron is needed.
// =========================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireOperator(ctx: QueryCtx) {
  const me = await getAuthUserId(ctx);
  if (!me) throw new Error("Sign in required.");
  const operator = await ctx.db.get(me);
  if (!operator || (operator.role !== "admin" && !operator.opRole)) {
    throw new Error("Forbidden.");
  }
  return operator;
}

type LedgerRow = Doc<"aiCostLogs">;

function sumCost(rows: LedgerRow[]): number {
  return Math.round(rows.reduce((acc, r) => acc + r.costUsd, 0) * 1_000_000) / 1_000_000;
}

function sumTokens(rows: LedgerRow[]): { inTok: number; outTok: number } {
  return rows.reduce(
    (acc, r) => ({ inTok: acc.inTok + r.inputTokens, outTok: acc.outTok + r.outputTokens }),
    { inTok: 0, outTok: 0 },
  );
}

async function getUserBrief(ctx: QueryCtx, userId: string) {
  const u = await ctx.db.get(userId as Id<"users">);
  if (!u) return { displayName: "Unknown", tier: "free" as string };
  return {
    displayName: (u as Doc<"users">).displayName ?? (u as Doc<"users">).name ?? "Unknown",
    tier: (u as Doc<"users">).tier ?? "free",
  };
}

export const spendSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const now = Date.now();
    const rows = await ctx.db.query("aiCostLogs").collect();
    const windows = [1, 7, 30].map((days) => {
      const since = now - days * DAY_MS;
      const slice = rows.filter((r) => r.createdAt >= since);
      const tok = sumTokens(slice);
      const calls = slice.length;
      const total = sumCost(slice);
      const bySurface: Record<string, { calls: number; costUsd: number }> = {};
      for (const r of slice) {
        const entry = bySurface[r.surface] ?? { calls: 0, costUsd: 0 };
        entry.calls += 1;
        entry.costUsd = Math.round((entry.costUsd + r.costUsd) * 1_000_000) / 1_000_000;
        bySurface[r.surface] = entry;
      }
      return {
        days,
        calls,
        costUsd: total,
        avgCostUsd: calls ? Math.round((total / calls) * 1_000_000) / 1_000_000 : 0,
        inputTokens: tok.inTok,
        outputTokens: tok.outTok,
        bySurface: Object.entries(bySurface)
          .map(([surface, s]) => ({ surface, ...s }))
          .sort((a, b) => b.costUsd - a.costUsd),
      };
    });
    return { windows, totalRows: rows.length };
  },
});

export const spendDailySeries = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    await requireOperator(ctx);
    const n = Math.min(90, Math.max(1, days ?? 30));
    const now = Date.now();
    const since = now - n * DAY_MS;
    const rows = (await ctx.db.query("aiCostLogs").collect()).filter(
      (r) => r.createdAt >= since,
    );
    // Bucket by UTC day.
    const buckets = new Map<
      string,
      { calls: number; costUsd: number; inTok: number; outTok: number }
    >();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      buckets.set(d.toISOString().slice(0, 10), { calls: 0, costUsd: 0, inTok: 0, outTok: 0 });
    }
    for (const r of rows) {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.calls += 1;
      b.costUsd = Math.round((b.costUsd + r.costUsd) * 1_000_000) / 1_000_000;
      b.inTok += r.inputTokens;
      b.outTok += r.outputTokens;
    }
    return Array.from(buckets.entries()).map(([day, b]) => ({ day, ...b }));
  },
});

export const spendByMember = query({
  args: { days: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { days, limit }) => {
    await requireOperator(ctx);
    const since = Date.now() - Math.min(90, Math.max(1, days ?? 30)) * DAY_MS;
    const rows = (await ctx.db.query("aiCostLogs").collect()).filter(
      (r) => r.createdAt >= since && r.userId,
    );
    const byUser = new Map<string, { calls: number; costUsd: number; surfaces: Set<string> }>();
    for (const r of rows) {
      const key = String(r.userId);
      const entry = byUser.get(key) ?? { calls: 0, costUsd: 0, surfaces: new Set<string>() };
      entry.calls += 1;
      entry.costUsd = Math.round((entry.costUsd + r.costUsd) * 1_000_000) / 1_000_000;
      entry.surfaces.add(r.surface);
      byUser.set(key, entry);
    }
    const ranked = Array.from(byUser.entries())
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
      .slice(0, Math.min(50, limit ?? 20));
    return Promise.all(
      ranked.map(async ([userId, s]) => {
        const brief = await getUserBrief(ctx, userId);
        return {
          userId,
          ...brief,
          calls: s.calls,
          costUsd: s.costUsd,
          surfaces: Array.from(s.surfaces).sort(),
        };
      }),
    );
  },
});

export const spendRecentCalls = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireOperator(ctx);
    const rows = await ctx.db
      .query("aiCostLogs")
      .withIndex("by_created")
      .order("desc")
      .take(Math.min(200, Math.max(1, limit ?? 50)));
    const userIds = Array.from(
      new Set(rows.map((r) => r.userId).filter((x): x is Id<"users"> => Boolean(x))),
    );
    const nameById = new Map<string, string>();
    for (const id of userIds) {
      const u = await ctx.db.get(id);
      if (u) nameById.set(String(id), u.displayName ?? u.name ?? "Member");
    }
    return rows.map((r) => ({
      _id: String(r._id),
      createdAt: r.createdAt,
      surface: r.surface,
      model: r.model,
      who: r.userId ? nameById.get(String(r.userId)) ?? "Member" : "System",
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      costUsd: r.costUsd,
    }));
  },
});
