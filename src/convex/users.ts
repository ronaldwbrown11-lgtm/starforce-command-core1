import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Signed-in upload URL for user-owned files (avatars, manuscript uploads).
 * Unlike assets.generateUploadUrl this is NOT operator-gated — any signed-in
 * user may upload within Convex's standard storage limits.
 */
export const generateUserUploadUrl = mutation({
  args: { purpose: v.optional(v.string()) },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Edit your public identity: display name, bio, and avatar. Passing
 * avatarStorageId: null removes the current avatar (and its stored file).
 */
const TIER_IDS = ["free", "cadet", "officer", "command", "gia_agent"] as const;
type TierId = (typeof TIER_IDS)[number];

/**
 * Self-serve membership tier switching (Upgrade / Downgrade) from the
 * public Membership page. No operator needed. Each switch is audit-logged
 * and resets the monthly usage counters so limits re-balance immediately.
 *
 * Paid upgrades go through Stripe checkout (api.stripe.createCheckoutSession)
 * and are fulfilled by the webhook. This mutation remains the path for:
 *  - instant demo switching when Stripe is not configured,
 *  - downgrades to Free (called by api.stripe.cancelMySubscription).
 */
export const changeMyTier = mutation({
  args: { tier: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    if (!(TIER_IDS as readonly string[]).includes(args.tier)) {
      throw new Error("Unknown tier.");
    }
    const target = args.tier as TierId;
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    const from = (user.tier ?? "free") as TierId;
    if (from === target) {
      throw new Error(`You are already on the ${target} tier.`);
    }
    await ctx.db.patch(userId, {
      tier: target,
      // Re-balance limits immediately: reset counters so the new tier's
      // caps apply from the switch moment.
      monthlyAiUsed: 0,
      monthlyResetAt: Date.now(),
      // Downgrading to Free also severs the Stripe subscription link
      // (billing was cancelled by the caller / webhook).
      stripeSubscriptionId: target === "free" ? undefined : user.stripeSubscriptionId,
    });
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "membership.tier_change",
      target: `user:${userId}`,
      meta: JSON.stringify({ from, to: target, selfServe: true }),
      createdAt: Date.now(),
    });
    return { ok: true, from, to: target };
  },
});

/**
 * INTERNAL (Stripe webhook): grant a tier after a successful checkout.
 * Sets the Stripe customer/subscription links, re-balances usage counters,
 * and audit-logs the change. Idempotent — safe to re-run on webhook retries.
 */
export const fulfillTier = mutation({
  args: {
    userId: v.id("users"),
    tier: v.string(),
    customerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(TIER_IDS as readonly string[]).includes(args.tier)) {
      throw new Error("Unknown tier.");
    }
    const target = args.tier as TierId;
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found.");
    }
    const from = (user.tier ?? "free") as TierId;
    const changed = from !== target;
    const patch: Record<string, unknown> = {
      tier: target,
      stripeCustomerId: args.customerId ?? user.stripeCustomerId,
      stripeSubscriptionId: args.subscriptionId ?? user.stripeSubscriptionId,
    };
    if (changed) {
      patch.monthlyAiUsed = 0;
      patch.monthlyResetAt = Date.now();
    }
    await ctx.db.patch(args.userId, patch);
    if (changed) {
      await ctx.db.insert("auditLog", {
        actorId: args.userId,
        action: "membership.tier_change",
        target: `user:${args.userId}`,
        meta: JSON.stringify({ from, to: target, source: "stripe" }),
        createdAt: Date.now(),
      });
    }
    return {
      ok: true,
      from,
      to: target,
      supersededSubscriptionId:
        user.stripeSubscriptionId && user.stripeSubscriptionId !== args.subscriptionId
          ? user.stripeSubscriptionId
          : null,
    };
  },
});

/**
 * INTERNAL (Stripe webhook): revert a user to Free when their Stripe
 * subscription is cancelled. Only applies if the cancelled subscription is
 * still the user's current one (guards against superseded-subscription
 * delete events firing after an upgrade).
 */
export const revertStripeSubscription = mutation({
  args: {
    userId: v.id("users"),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { ok: false, reason: "no_user" };
    }
    if (user.stripeSubscriptionId !== args.subscriptionId) {
      return { ok: false, reason: "stale_subscription" };
    }
    await ctx.db.patch(args.userId, {
      tier: "free",
      stripeSubscriptionId: undefined,
      monthlyAiUsed: 0,
      monthlyResetAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: args.userId,
      action: "membership.tier_change",
      target: `user:${args.userId}`,
      meta: JSON.stringify({
        from: user.tier ?? "free",
        to: "free",
        source: "stripe_subscription_deleted",
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * INTERNAL (Stripe actions): persist the Stripe customer id on the current
 * user so later checkouts reuse the same customer (and its payment history).
 */
export const saveStripeCustomer = mutation({
  args: { customerId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    await ctx.db.patch(userId, { stripeCustomerId: args.customerId });
    return { ok: true };
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    rank: v.optional(v.string()),
    fleet: v.optional(v.string()),
    // Paid-tier perk (#32): custom display flair.
    flair: v.optional(v.string()),
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }

    const patch: {
      displayName?: string;
      bio?: string;
      rank?: string;
      fleet?: string;
      flair?: string;
      avatarStorageId?: Id<"_storage">;
      onboarded?: boolean;
    } = {};

    // Editing your identity counts as completing the first-run orientation.
    patch.onboarded = true;

    // Flair is a paid-tier perk (#32) — enforce server-side so the gate
    // can't be bypassed from the client.
    if (args.flair !== undefined) {
      if ((user.tier ?? "free") === "free") {
        throw new Error(
          "Custom flair is a paid-member perk — upgrade to claim yours.",
        );
      }
      const flair = args.flair.trim().slice(0, 40);
      patch.flair = flair || undefined;
    }

    if (args.displayName !== undefined) {
      const name = args.displayName.trim();
      if (!name) {
        throw new Error("Display name cannot be empty.");
      }
      if (name.length > 60) {
        throw new Error("Display name must be 60 characters or fewer.");
      }
      patch.displayName = name;
    }

    if (args.bio !== undefined) {
      const bio = args.bio.trim();
      if (bio.length > 280) {
        throw new Error("Bio must be 280 characters or fewer.");
      }
      patch.bio = bio.length ? bio : undefined;
    }

    if (args.rank !== undefined) {
      const rank = args.rank.trim();
      if (rank.length > 40) {
        throw new Error("Rank must be 40 characters or fewer.");
      }
      patch.rank = rank.length ? rank : undefined;
    }

    if (args.fleet !== undefined) {
      const fleet = args.fleet.trim();
      if (fleet.length > 60) {
        throw new Error("Fleet must be 60 characters or fewer.");
      }
      patch.fleet = fleet.length ? fleet : undefined;
    }

    if (args.avatarStorageId !== undefined) {
      const prior = user.avatarStorageId;
      if (args.avatarStorageId === null) {
        patch.avatarStorageId = undefined;
        if (prior) {
          try {
            await ctx.storage.delete(prior);
          } catch {
            // Non-fatal — the row update already landed.
          }
        }
      } else {
        patch.avatarStorageId = args.avatarStorageId;
        if (prior && prior !== args.avatarStorageId) {
          try {
            await ctx.storage.delete(prior);
          } catch {
            // Non-fatal.
          }
        }
      }
    }

    await ctx.db.patch(userId, patch);
    return { ok: true };
  },
});

// Canonical rank ladder offered by the first-run pilot orientation. Kept
// server-side too so the onboarding picker can't drift from what's accepted.
const ONBOARD_RANKS = [
  "Recruit",
  "Aspirant",
  "Pilot",
  "Commander",
  "Captain",
  "Admiral",
] as const;

/**
 * One-screen pilot orientation completed at first login: pick a rank, a
 * fleet, and optionally a starter mission, then get flagged onboarded.
 * `skip: true` marks the account onboarded without selections. The starter
 * mission is validated as an active, free-cleared operation before the
 * client is allowed to deep-link into it.
 */
export const completeOnboarding = mutation({
  args: {
    displayName: v.optional(v.string()),
    rank: v.optional(v.string()),
    fleet: v.optional(v.string()),
    starterMissionSlug: v.optional(v.string()),
    skip: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Account not found.");
    }

    const patch: {
      displayName?: string;
      rank?: string;
      fleet?: string;
      onboarded: boolean;
    } = { onboarded: true };

    if (!args.skip) {
      if (args.displayName !== undefined) {
        const name = args.displayName.trim();
        if (!name) {
          throw new Error("Display name cannot be empty.");
        }
        if (name.length > 60) {
          throw new Error("Display name must be 60 characters or fewer.");
        }
        patch.displayName = name;
      }

      if (args.rank !== undefined) {
        const rank = args.rank.trim();
        if (!ONBOARD_RANKS.includes(rank as (typeof ONBOARD_RANKS)[number])) {
          throw new Error("Pick a valid rank.");
        }
        patch.rank = rank;
      }

      if (args.fleet !== undefined) {
        const fleet = args.fleet.trim();
        if (fleet.length > 60) {
          throw new Error("Fleet must be 60 characters or fewer.");
        }
        patch.fleet = fleet.length ? fleet : undefined;
      }

      if (args.starterMissionSlug) {
        const mission = await ctx.db
          .query("missions")
          .withIndex("by_slug", (q) => q.eq("slug", args.starterMissionSlug!))
          .first();
        if (!mission) {
          throw new Error("That operation hasn't been launched yet.");
        }
        if (mission.missionStatus !== "active") {
          throw new Error("That operation is not open to new pilots.");
        }
        if (mission.tierRequired) {
          throw new Error("That operation requires higher clearance.");
        }
      }
    }

    await ctx.db.patch(userId, patch);
    return {
      ok: true,
      starterMissionSlug: args.skip ? null : (args.starterMissionSlug ?? null),
    };
  },
});

/**
 * Set (or clear) the "message email" on your account — a secondary contact
 * address for site correspondence, separate from the email you sign in with.
 * Pass an empty string or null to remove it. Audit-logged.
 */
export const setMyContactEmail = mutation({
  args: { contactEmail: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    const raw = (args.contactEmail ?? "").trim();
    if (raw) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        throw new Error("Enter a valid email address.");
      }
      if (raw.length > 254) {
        throw new Error("Email is too long.");
      }
      if (raw.toLowerCase() === (user.email ?? "").toLowerCase()) {
        throw new Error("That's already your sign-in email.");
      }
    }
    const contactEmail = raw || undefined;
    await ctx.db.patch(userId, { contactEmail });
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "account.contact_email",
      target: `user:${userId}`,
      meta: JSON.stringify({ contactEmail: contactEmail ?? null }),
      createdAt: Date.now(),
    });
    return { ok: true, contactEmail: contactEmail ?? null };
  },
});

/**
 * Toggle the weekly fleet digest email (account settings). Audited so the
 * choice is traceable; digest.ts reads `emailOptOut` when batching.
 */
export const setMyEmailOptOut = mutation({
  args: { optOut: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    await ctx.db.patch(userId, { emailOptOut: args.optOut || undefined });
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "account.digest_pref",
      target: `user:${userId}`,
      meta: JSON.stringify({ optOut: args.optOut }),
      createdAt: Date.now(),
    });
    return { ok: true, optOut: args.optOut };
  },
});

/**
 * DEV-ONLY: Promote the current signed-in user to admin (role "admin" +
 * opRole "senior_operator"). OTP / anonymous sign-in provisions a users row
 * with no role, so this is the escape hatch to reach the operator console.
 *
 * Lock it down before production: either delete this function or set the
 * DISABLE_DEV_ADMIN environment variable to "true" in the Convex dashboard.
 */
export const devPromoteSelf = mutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.DISABLE_DEV_ADMIN === "true") {
      throw new Error("Forbidden.");
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found.");
    }
    await ctx.db.patch(userId, {
      role: "admin",
      opRole: "senior_operator",
    });
    return {
      ok: true,
      displayName: user.displayName ?? user.email ?? userId,
    };
  },
});

/**
 * Record a login attempt for the operator Login Logs screen. Called from the
 * auth page after a sign-in succeeds or fails. Unauthenticated on purpose so
 * failures can be logged before a session exists.
 */
export const recordLoginAttempt = mutation({
  args: {
    result: v.union(v.literal("success"), v.literal("fail")),
    reason: v.optional(v.string()),
    ua: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("loginAttempts", {
      ip: "",
      ua: (args.ua ?? "").slice(0, 400),
      result: args.result,
      reason: args.reason?.slice(0, 400),
      time: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Paid-tier perk (#32): set (or clear) the custom display flair shown next
 * to the member's name on profiles, story bylines, and comments.
 * Free members get the default rank-based treatment.
 */
export const updateMyFlair = mutation({
  args: { flair: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to set a flair.");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Account not found.");
    if ((me.tier ?? "free") === "free") {
      throw new Error("Custom flair is a paid-member perk — upgrade to claim yours.");
    }
    const flair = args.flair.trim().slice(0, 40);
    await ctx.db.patch(userId, { flair: flair || undefined });
    return { ok: true, flair };
  },
});

/**
 * Opt in/out of the weekly fleet digest email (#20). Digest delivery also
 * requires a verified sign-in email or a message (contact) email, which is
 * checked per recipient when the Monday cron runs.
 */
export const setEmailPrefs = mutation({
  args: { digestOptOut: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Account not found.");
    await ctx.db.patch(userId, { emailOptOut: args.digestOptOut || undefined });
    return { ok: true, digestOptOut: !!args.digestOptOut };
  },
});
