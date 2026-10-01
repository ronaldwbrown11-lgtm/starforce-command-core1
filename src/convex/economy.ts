import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  CREDIT_RATES,
  FRAME_CATALOG,
  TITLE_CATALOG,
  BOOST_CATALOG,
  type FrameId,
} from "../lib/economy";
import {
  DAILY_XP_CAP,
  FLAG_OFFICER_MIN_XP,
  deriveRankKey,
  rankSpec,
  utcDayKey,
  type XpCategory,
} from "../lib/ranks";

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
 * Optional grant metadata for the Capped Star Force progression system.
 * `category: "daily"` engagement XP counts against the hard 50 XP/day cap
 * (enforced from the xpLedger); every grant is journaled + evaluated for
 * rank promotion.
 */
export interface XpGrantOptions {
  source?: string; // e.g. "daily_activity", "quest_induction", "signal_solve"
  category?: XpCategory;
}

/**
 * Award XP to a member, scaled by their tier's multiplier and any active
 * XP Surge. Returns XP granted (0 when the daily engagement cap blocked it).
 *
 * Side effects (Capped Star Force progression system):
 *  - journals the grant to `xpLedger` (daily-cap accounting + XP history),
 *  - refreshes `lastXpAt` (Rear Admiral inactivity decay clock),
 *  - mirrors excess >35,000 into `prestigeXp`,
 *  - evaluates ladder promotion up to Captain (Fleet). Ensign → Lieutenant
 *    is checklist-gated and handled exclusively by
 *    `progression.onboardingComplete`; Rear Admiral seats are granted only
 *    by the Admiral Queue cron — never by XP alone.
 */
export async function applyXpGain(
  ctx: MutationCtx,
  userId: Id<"users">,
  baseXp: number,
  opts: XpGrantOptions = {},
): Promise<number> {
  if (!baseXp || baseXp <= 0) return 0;
  const user = await ctx.db.get(userId);
  if (!user) return 0;
  const surge = xpSurgeActive(user) ? 2 : 1;
  let gained = Math.round(baseXp * tierXpMultiplier(user.tier) * surge);

  const category: XpCategory = opts.category ?? "other";
  const source = opts.source ?? "activity";
  const now = Date.now();
  const day = utcDayKey(now);

  // Hard cap: max 50 engagement XP per UTC day (spec §2). Counted from the
  // ledger, so multiple daily-category grants in one day can't exceed it.
  if (category === "daily") {
    const todayRows = await ctx.db
      .query("xpLedger")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
    // Only engagement XP counts against the engagement cap — story/lore/
    // milestone awards landing the same day never block a daily check-in.
    const used = todayRows
      .filter((r) => r.category === "daily")
      .reduce((sum, r) => sum + r.amount, 0);
    gained = Math.min(gained, Math.max(0, DAILY_XP_CAP - used));
    if (gained <= 0) return 0;
  }

  const totalXp = (user.xp ?? 0) + gained;

  const patch: Partial<Doc<"users">> = { xp: totalXp, lastXpAt: now };
  // Prestige XP — a Captain's excess above the 35,000 flag-officer floor is
  // held while they wait on the Rear Admiral Queue (spec §1.5).
  if (totalXp > FLAG_OFFICER_MIN_XP) {
    patch.prestigeXp = totalXp - FLAG_OFFICER_MIN_XP;
  }

  // Ladder evaluation. Captains crossing 35,000 join the queue as
  // "waiting" (Rear Admiral Eligible) — seats are assigned by the cron.
  const seatActive = user.rankKey === "rear_admiral";
  const nextKey = deriveRankKey({
    xp: totalXp,
    currentRankKey: user.rankKey,
    checklistComplete: false,
    seatActive,
  });
  const prevKey = user.rankKey ?? null;
  const promoted = nextKey !== prevKey;
  if (promoted) {
    const spec = rankSpec(nextKey);
    patch.rankKey = nextKey;
    // Keep the legacy display string in step with the system rank on promotion.
    patch.rank = spec.label;
  }

  await ctx.db.patch(userId, patch);
  await ctx.db.insert("xpLedger", {
    userId,
    amount: gained,
    source,
    category,
    day,
    createdAt: now,
  });

  if (promoted) {
    await recordPromotion(ctx, userId, prevKey, nextKey, now);
  }

  // Admiral Queue bookkeeping: only actual Captains (or seated Rear
  // Admirals) join the waitlist — an Ensign sitting on unspent XP or an
  // operator-assigned custom rank never enters the queue automatically.
  if (
    totalXp >= FLAG_OFFICER_MIN_XP &&
    (nextKey === "captain" || nextKey === "rear_admiral")
  ) {
    const queueRow = await ctx.db
      .query("admiralQueue")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!queueRow) {
      await ctx.db.insert("admiralQueue", {
        userId,
        status: "waiting",
        totalXp,
        joinedAt: now,
        lastXpAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(queueRow._id, {
        totalXp,
        lastXpAt: now,
        updatedAt: now,
      });
    }
  }

  return gained;
}

/**
 * Notify + record a system rank promotion (shared by the XP pipeline and
 * the onboarding/queue evaluators in progression.ts).
 */
export async function recordPromotion(
  ctx: MutationCtx,
  userId: Id<"users">,
  prevKey: string | null,
  nextKey: string,
  now: number,
): Promise<void> {
  const spec = rankSpec(nextKey);
  await ctx.db.insert("notifications", {
    userId,
    kind: "promotion",
    title: `Promoted to ${spec.label}`,
    body: prevKey
      ? `Your commission advanced from ${rankSpec(prevKey).label} to ${spec.label}.`
      : `Your commission is now ${spec.label}. Report to the High Command dashboard.`,
    url: "/high-command",
    createdAt: now,
  });
  await ctx.db.insert("activityFeed", {
    actorId: userId,
    verb: "completed",
    targetType: "rank",
    targetId: nextKey,
    url: "/high-command",
    summary: `was promoted to ${spec.label}`,
    createdAt: now,
  });
  await ctx.db.insert("auditLog", {
    actorId: userId,
    action: "rank.promote",
    target: `user:${userId}`,
    meta: JSON.stringify({ from: prevKey, to: nextKey, tier: spec.tier }),
    createdAt: now,
  });
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