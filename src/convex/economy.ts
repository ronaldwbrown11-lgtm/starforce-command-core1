import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  CREDIT_RATES,
  FRAME_CATALOG,
  TITLE_CATALOG,
  BOOST_CATALOG,
  type FrameId,
} from "../lib/economy";

// =========================================================================
// Star Credits (#8 — Ultra Force virtual currency)
//
// Credits are earned at contribution sites (published stories, approved
// lore, certified discoveries, mission reports, comments) and spent in the
// Cosmetic Lab on profile cosmetics. Balances live on the user document;
// every grant and spend is recorded in the audit log so the economy stays
// auditable. Rates and the cosmetic catalog live in src/lib/economy.ts.
// =========================================================================

export { CREDIT_RATES, FRAME_CATALOG };

// ---------------------------------------------------------------------------
// XP multipliers (identity layer #43) — paid tiers earn XP faster.
// Multipliers apply at every XP grant site (missions, quests, signals, poll
// votes). `applyXpGain` reads the member's tier server-side, so the boost
// can't be faked from the client.
// ---------------------------------------------------------------------------

export const XP_MULTIPLIERS: Record<string, number> = {
  free: 1,
  cadet: 1.25,
  officer: 1.5,
  command: 2,
  elite: 2.5,
  gia_agent: 3,
};

export function tierXpMultiplier(tier: string | null | undefined): number {
  return XP_MULTIPLIERS[tier ?? "free"] ?? 1;
}

/**
 * Server-side boost multipliers — read from the user document so they can't
 * be faked from the client. A boost is active if its expiry timestamp is in
 * the future.
 */
function xpSurgeActive(user: { xpSurgeUntil?: number }): boolean {
  return !!user.xpSurgeUntil && user.xpSurgeUntil > Date.now();
}

function creditSurgeActive(user: { creditSurgeUntil?: number }): boolean {
  return !!user.creditSurgeUntil && user.creditSurgeUntil > Date.now();
}

/**
 * Award XP to a member, scaled by their tier's multiplier and any active
 * XP Surge. Returns XP granted.
 */
export async function applyXpGain(
  ctx: MutationCtx,
  userId: Id<"users">,
  baseXp: number,
): Promise<number> {
  if (!baseXp || baseXp <= 0) return 0;
  const user = await ctx.db.get(userId);
  if (!user) return 0;
  const surge = xpSurgeActive(user) ? 2 : 1;
  const gained = Math.round(baseXp * tierXpMultiplier(user.tier) * surge);
  await ctx.db.patch(userId, { xp: (user.xp ?? 0) + gained });
  return gained;
}

/**
 * Credit a user's Star Credits balance and record the grant in the audit
 * log. Best-effort — a missing user is silently skipped.
 */
/**
 * Credit a user's Star Credits balance — with Credit Surge doubling at every
 * earning site (not operator grants or purchases, which pass through
 * `grantCreditsExact`) — and record the grant in the audit log. Best-effort:
 * a missing user is silently skipped.
 */
export async function grantCredits(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  reason: string,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const user = await ctx.db.get(userId);
  if (!user) return;
  // Earnings sites surge; operator grants and store fulfillments don't (they
  // route through grantCreditsExact).
  const surged = creditSurgeActive(user) ? amount * 2 : amount;
  await ctx.db.patch(userId, { credits: (user.credits ?? 0) + surged });
  await ctx.db.insert("auditLog", {
    actorId: userId,
    action: "credits.grant",
    target: `user:${userId}`,
    meta: JSON.stringify({
      source: reason,
      amount: surged,
      base: surged !== amount ? amount : undefined,
      surge: surged !== amount,
    }),
    createdAt: Date.now(),
  });
}

/**
 * Grant an exact credit amount with no surge multiplier — used for store
 * fulfillment of Star Credit caches and direct operator adjustments.
 */
export async function grantCreditsExact(
  ctx: MutationCtx,
  userId: Id<"users">,
  amount: number,
  reason: string,
): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const user = await ctx.db.get(userId);
  if (!user) return;
  await ctx.db.patch(userId, { credits: (user.credits ?? 0) + amount });
  await ctx.db.insert("auditLog", {
    actorId: userId,
    action: "credits.grant",
    target: `user:${userId}`,
    meta: JSON.stringify({ source: reason, amount, exact: true }),
    createdAt: Date.now(),
  });
}

/**
 * Buy a frame from the Cosmetic Lab (deducts once, marks it owned) or re-
 * equip an already-owned frame (free). Returns the new balance.
 */
export const purchaseFrame = mutation({
  args: { frame: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const spec = FRAME_CATALOG[args.frame as FrameId];
    if (!spec) throw new Error("Unknown frame designation.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");

    const owned = user.frames ?? [];
    const alreadyOwned = owned.includes(args.frame);
    const credits = user.credits ?? 0;

    let cost = 0;
    if (!alreadyOwned) {
      if (credits < spec.cost) {
        throw new Error(
          `This frame costs ${spec.cost} Star Credits — your balance is ${credits}.`,
        );
      }
      cost = spec.cost;
    }

    await ctx.db.patch(userId, {
      credits: credits - cost,
      frame: args.frame,
      frames: alreadyOwned ? owned : [...owned, args.frame],
    });

    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: alreadyOwned ? "cosmetic.equip" : "cosmetic.purchase",
      target: `user:${userId}`,
      meta: JSON.stringify({ frame: args.frame, cost }),
      createdAt: Date.now(),
    });

    return {
      ok: true,
      frame: args.frame,
      newlyOwned: !alreadyOwned,
      credits: credits - cost,
    };
  },
});

/**
 * Buy (first call) or equip (owned) a Cosmetic Lab title. Mission-line
 * titles (cost: null) can only be equipped if already owned — they arrive
 * via operator award, never purchase.
 */
export const purchaseTitle = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const spec = TITLE_CATALOG[args.title];
    if (!spec) throw new Error("Unknown title designation.");
    if (spec.cost === null && !(await ownsTitle(ctx, userId, args.title))) {
      throw new Error("This title is awarded by command, not purchasable.");
    }
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");

    const owned = user.titles ?? [];
    const alreadyOwned = owned.includes(args.title);
    const credits = user.credits ?? 0;

    let cost = 0;
    if (!alreadyOwned) {
      if (spec.cost === null) {
        throw new Error("This title is awarded by command, not purchasable.");
      }
      if (credits < spec.cost) {
        throw new Error(
          `This title costs ${spec.cost} Star Credits — your balance is ${credits}.`,
        );
      }
      cost = spec.cost;
    }

    await ctx.db.patch(userId, {
      credits: credits - cost,
      title: args.title,
      titles: alreadyOwned ? owned : [...owned, args.title],
    });

    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: alreadyOwned ? "cosmetic.equip_title" : "cosmetic.purchase_title",
      target: `user:${userId}`,
      meta: JSON.stringify({ title: args.title, cost }),
      createdAt: Date.now(),
    });

    return {
      ok: true,
      title: args.title,
      newlyOwned: !alreadyOwned,
      credits: credits - cost,
    };
  },
});

async function ownsTitle(
  ctx: MutationCtx,
  userId: Id<"users">,
  titleId: string,
): Promise<boolean> {
  const u = await ctx.db.get(userId);
  return !!u && (u.titles ?? []).includes(titleId);
}

/**
 * Clear the equipped title (back to no title). Free.
 */
export const clearTitle = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    await ctx.db.patch(userId, { title: undefined });
    return { ok: true };
  },
});

/**
 * Activate a consumable boost. Buying extends the current expiry (so an
 * active surge can be stacked before it lapses, up to 7 days out) rather
 * than restarting it.
 */
export const activateBoost = mutation({
  args: { boost: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const spec = BOOST_CATALOG[args.boost as keyof typeof BOOST_CATALOG];
    if (!spec) throw new Error("Unknown boost designation.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");
    const credits = user.credits ?? 0;
    if (credits < spec.cost) {
      throw new Error(
        `${spec.label} costs ${spec.cost} Star Credits — your balance is ${credits}.`,
      );
    }

    const now = Date.now();
    const durationMs = spec.hours * 3_600_000;
    const MAX_STACK_MS = 7 * 24 * 3_600_000;
    const currentUntil =
      args.boost === "xp_surge" ? user.xpSurgeUntil : user.creditSurgeUntil;
    // Stacking extends from the later of now/current expiry, capped 7 days.
    const base = Math.max(now, currentUntil ?? 0);
    let until = base + durationMs;
    if (until - now > MAX_STACK_MS) until = now + MAX_STACK_MS;

    const patch: { credits: number; xpSurgeUntil?: number; creditSurgeUntil?: number } = {
      credits: credits - spec.cost,
    };
    if (args.boost === "xp_surge") patch.xpSurgeUntil = until;
    else patch.creditSurgeUntil = until;
    await ctx.db.patch(userId, patch);

    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "cosmetic.boost",
      target: `user:${userId}`,
      meta: JSON.stringify({ boost: args.boost, cost: spec.cost, until }),
      createdAt: now,
    });

    return { ok: true, boost: args.boost, activeUntil: until, credits: patch.credits };
  },
});