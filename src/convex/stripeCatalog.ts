import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---------------------------------------------------------------------------
// Stripe product catalog (Node actions live in stripe.ts; DB access lives here)
// ---------------------------------------------------------------------------

/**
 * Canonical membership pricing — the single source of truth for what the
 * app charges per tier. The Stripe action module (stripe.ts, "use node")
 * imports this constant so the checkout fallback, the catalog sync, and
 * this operator view can never drift apart.
 */
export const TIER_PRICING: Record<string, { name: string; unitAmount: number }> = {
  cadet: { name: "Star Force Cadet", unitAmount: 500 },
  officer: { name: "Star Force Officer", unitAmount: 1200 },
  command: { name: "Star Force Command", unitAmount: 1900 },
  elite: { name: "Star Force Elite", unitAmount: 2500 },
  gia_agent: { name: "GIA Agent", unitAmount: 4900 },
};

function assertOperator(
  user: { role?: string; opRole?: string } | null,
) {
  if (!user) throw new Error("User not found.");
  if (
    user.role !== "admin" &&
    user.opRole !== "operator" &&
    user.opRole !== "senior_operator"
  ) {
    throw new Error("Forbidden.");
  }
}

/** Internal lookup — the Price ID recorded for a tier, if it was synced. */
export const getCatalogEntry = internalQuery({
  args: { tier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stripeCatalog")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();
  },
});

/** Internal upsert — persist one synced tier mapping. */
export const saveCatalogEntry = internalMutation({
  args: {
    tier: v.string(),
    productId: v.string(),
    priceId: v.string(),
    unitAmount: v.number(),
    currency: v.string(),
    interval: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeCatalog")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, syncedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("stripeCatalog", {
      ...args,
      syncedAt: Date.now(),
    });
  },
});

/** Internal audit — one row per catalog sync run. */
export const auditCatalogSync = internalMutation({
  args: { actorId: v.id("users"), synced: v.number(), created: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      actorId: args.actorId,
      action: "stripe.catalog_sync",
      target: `stripe:${args.synced}-tiers`,
      meta: JSON.stringify({ synced: args.synced, created: args.created }),
      createdAt: Date.now(),
    });
  },
});

/**
 * Operator-facing view of the catalog: every tier the app charges for,
 * with the synced Stripe Product/Price IDs when the sync has run.
 */
export const getCatalog = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (me === null) throw new Error("Sign in required.");
    assertOperator(await ctx.db.get(me));
    const rows = await ctx.db.query("stripeCatalog").collect();
    const byTier = new Map(rows.map((r) => [r.tier, r]));
    return Object.entries(TIER_PRICING).map(([tier, pricing]) => {
      const row = byTier.get(tier);
      return {
        tier,
        name: pricing.name,
        unitAmount: pricing.unitAmount,
        synced: !!row,
        productId: row?.productId,
        priceId: row?.priceId,
        syncedAt: row?.syncedAt,
      };
    });
  },
});
