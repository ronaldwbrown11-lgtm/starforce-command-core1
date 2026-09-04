import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { CREDIT_RATES, FRAME_CATALOG, type FrameId } from "../lib/economy";

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

/** Award XP to a member, scaled by their tier's multiplier. Returns XP granted. */
export async function applyXpGain(
  ctx: MutationCtx,
  userId: Id<"users">,
  baseXp: number,
): Promise<number> {
  if (!baseXp || baseXp <= 0) return 0;
  const user = await ctx.db.get(userId);
  if (!user) return 0;
  const gained = Math.round(baseXp * tierXpMultiplier(user.tier));
  await ctx.db.patch(userId, { xp: (user.xp ?? 0) + gained });
  return gained;
}

/**
 * Credit a user's Star Credits balance and record the grant in the audit
 * log. Best-effort — a missing user is silently skipped.
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
  await ctx.db.patch(userId, { credits: (user.credits ?? 0) + amount });
  await ctx.db.insert("auditLog", {
    actorId: userId,
    action: "credits.grant",
    target: `user:${userId}`,
    meta: JSON.stringify({ source: reason, amount }),
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
