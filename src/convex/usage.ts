import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { tierValidator, type TierId } from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAiCapForTier, getStorageCapForTier } from "./tiers";

// 30 days in ms.
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export type UsageSnapshot = {
  userId: string;
  tier: TierId;
  ai: { used: number; cap: number; percent: number; exceeds: boolean };
  storage: { usedGb: number; capGb: number; percent: number; exceeds: boolean };
  periodStart: number;
  periodEnd: number;
};

type Ctx = QueryCtx | MutationCtx;

async function loadUserOrThrow(ctx: Ctx, userId: Id<"users">) {
  const u = await ctx.db.get(userId);
  if (!u) throw new Error("User not found.");
  return u as Doc<"users">;
}

async function snapshotForCtx(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{
  user: Doc<"users">;
  periodStart: number;
  periodEnd: number;
  sinceReset: boolean;
  aiUsed: number;
  storageUsedGb: number;
  aiCap: number;
  storageCap: number;
}> {
  const user = await loadUserOrThrow(ctx, userId);
  const tier = (user.tier ?? "free") as TierId;
  const now = Date.now();
  const periodStart = user.monthlyResetAt ?? now;
  const periodEnd = periodStart + MONTH_MS;
  const sinceReset = now >= periodEnd;

  const aiUsed = sinceReset ? 0 : user.monthlyAiUsed ?? 0;
  const storageUsedGb = user.storageUsedGb ?? 0;
  const aiCap = getAiCapForTier(tier);
  const storageCap = getStorageCapForTier(tier);
  return {
    user,
    periodStart: sinceReset ? now : periodStart,
    periodEnd: sinceReset ? now + MONTH_MS : periodEnd,
    sinceReset,
    aiUsed,
    storageUsedGb,
    aiCap,
    storageCap,
  };
}

// In mutations only — apply the period reset (writes are not allowed in queries).
async function applyPeriodResetIfDue(
  ctx: MutationCtx,
  userId: Id<"users">,
  sinceReset: boolean,
) {
  if (!sinceReset) return;
  await ctx.db.patch(userId, {
    monthlyAiUsed: 0,
    monthlyResetAt: Date.now(),
  });
}

export const userUsage = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const id = args.userId ?? (await getAuthUserId(ctx));
    if (!id) return null;
    const snap = await snapshotForCtx(ctx, id);
    const aiCap = snap.aiCap;
    const storageCap = snap.storageCap;
    const aiPercent =
      aiCap === Infinity
        ? 0
        : Math.min(999, Math.max(0, Math.round((snap.aiUsed / Math.max(1, aiCap)) * 100)));
    const storagePercent =
      storageCap === Infinity
        ? 0
        : Math.min(999, Math.max(0, Math.round((snap.storageUsedGb / Math.max(1, storageCap)) * 100)));
    const out: UsageSnapshot = {
      userId: String(id),
      tier: (snap.user.tier ?? "free") as TierId,
      ai: {
        used: snap.aiUsed,
        cap: aiCap === Infinity ? -1 : aiCap,
        percent: aiPercent,
        exceeds: snap.aiUsed > aiCap,
      },
      storage: {
        usedGb: snap.storageUsedGb,
        capGb: storageCap === Infinity ? -1 : storageCap,
        percent: storagePercent,
        exceeds: snap.storageUsedGb > storageCap,
      },
      periodStart: snap.periodStart,
      periodEnd: snap.periodEnd,
    };
    return out;
  },
});

export const previewAiGeneration = query({
  args: { count: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const snap = await snapshotForCtx(ctx, me);
    const count = Math.max(1, args.count ?? 1);
    const projected = snap.aiUsed + count;
    const aiCap = snap.aiCap;
    const wouldExceed = aiCap !== Infinity && projected > aiCap;
    return {
      current: snap.aiUsed,
      projected,
      cap: aiCap === Infinity ? -1 : aiCap,
      wouldExceed,
      tier: (snap.user.tier ?? "free") as TierId,
    };
  },
});

export const consumeAi = mutation({
  args: {
    count: v.optional(v.number()),
    confirmOverage: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const snap = await snapshotForCtx(ctx, me);
    await applyPeriodResetIfDue(ctx, me, snap.sinceReset);
    const count = Math.max(1, args.count ?? 1);
    const projected = snap.aiUsed + count;
    const cap = snap.aiCap;
    const isOperator = !!snap.user.opRole || snap.user.role === "admin";
    if (
      cap !== Infinity &&
      projected > cap &&
      !args.confirmOverage &&
      !isOperator
    ) {
      throw new Error(
        JSON.stringify({
          code: "ultraforce_overage_requires_confirm",
          kind: "ai",
          current: snap.aiUsed,
          projected,
          cap,
          tier: snap.user.tier ?? "free",
        }),
      );
    }
    await ctx.db.patch(me, {
      monthlyAiUsed: projected,
      monthlyResetAt: snap.periodStart,
    });
    return {
      ok: true,
      used: projected,
      cap: cap === Infinity ? -1 : cap,
      overageConfirmed: projected > cap && !isOperator,
      operatorOverride: isOperator,
    };
  },
});

export const consumeStorage = mutation({
  args: {
    gb: v.optional(v.number()),
    confirmOverage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const snap = await snapshotForCtx(ctx, me);
    await applyPeriodResetIfDue(ctx, me, snap.sinceReset);
    const gb = Math.max(0, args.gb ?? 0);
    const projected = +(snap.storageUsedGb + gb).toFixed(3);
    const cap = snap.storageCap;
    const isOperator = !!snap.user.opRole || snap.user.role === "admin";
    if (cap !== Infinity && projected > cap && !args.confirmOverage && !isOperator) {
      throw new Error(
        JSON.stringify({
          code: "ultraforce_overage_requires_confirm",
          kind: "storage",
          current: snap.storageUsedGb,
          projected,
          cap,
          tier: snap.user.tier ?? "free",
        }),
      );
    }
    await ctx.db.patch(me, { storageUsedGb: projected });
    return {
      ok: true,
      used: projected,
      cap: cap === Infinity ? -1 : cap,
      overageConfirmed: projected > cap && !isOperator,
    };
  },
});

export const setUsage = mutation({
  args: {
    userId: v.id("users"),
    monthlyAiUsed: v.optional(v.number()),
    storageUsedGb: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const operator = await ctx.db.get(me);
    if (!operator || (operator.role !== "admin" && !operator.opRole)) {
      throw new Error("Forbidden.");
    }
    await ctx.db.patch(args.userId, {
      monthlyAiUsed: args.monthlyAiUsed,
      storageUsedGb: args.storageUsedGb,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.usage.override",
      target: `user:${args.userId}`,
      meta: JSON.stringify({
        monthlyAiUsed: args.monthlyAiUsed,
        storageUsedGb: args.storageUsedGb,
        reason: args.reason,
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const usersUsageForOperator = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const operator = await ctx.db.get(me);
    if (!operator || (operator.role !== "admin" && !operator.opRole)) {
      throw new Error("Forbidden.");
    }
    const all = await ctx.db.query("users").take(args.limit ?? 200);
    const now = Date.now();
    return all.map((u) => {
      const tier = (u.tier ?? "free") as TierId;
      const aiCap = getAiCapForTier(tier);
      const storageCap = getStorageCapForTier(tier);
      const aiUsed = u.monthlyAiUsed ?? 0;
      const storageUsedGb = u.storageUsedGb ?? 0;
      const aiPercent = aiCap === Infinity ? 0 : Math.round((aiUsed / Math.max(1, aiCap)) * 100);
      const storagePercent =
        storageCap === Infinity ? 0 : Math.round((storageUsedGb / Math.max(1, storageCap)) * 100);
      const periodStart = u.monthlyResetAt ?? now;
      return {
        userId: String(u._id),
        tier,
        ai: { used: aiUsed, cap: aiCap, percent: aiPercent },
        storage: { usedGb: storageUsedGb, capGb: storageCap, percent: storagePercent },
        periodStart,
      };
    });
  },
});
