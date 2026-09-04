import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import { applyXpGain, grantCredits } from "./economy";
import type { Id } from "./_generated/dataModel";
import { TIER_ORDER, type TierId } from "../lib/tiers";

// Clearance layer: signals can be gated to a tier. Helpers shared by the
// list / solve / create paths so the gate can never be bypassed client-side.
function tierIndex(tier: string | null | undefined): number {
  if (!tier) return 0;
  return TIER_ORDER.indexOf(tier as TierId);
}

export function signalLockedFor(
  viewerTier: string | null | undefined,
  requiredTier: string | null | undefined,
): boolean {
  return !!requiredTier && tierIndex(requiredTier) > tierIndex(viewerTier);
}

// =========================================================================
// Signal Vault (#4 — Mini-ARGs)
//
// Intercepted Ultra Force ciphers. Each signal carries a public ciphertext
// and hint; members submit a decrypted answer for a one-time reward of XP
// and Star Credits. Rewards are guarded by the solvedBy list so a solve
// pays out exactly once per member. Operators create and retire signals.
// =========================================================================

const DEFAULT_REWARD_XP = 20;
const DEFAULT_REWARD_CREDITS = 15;

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export const listSignals = query({
  args: { campaignId: v.optional(v.id("argCampaigns")) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    const viewer = me ? await ctx.db.get(me) : null;
    let signals = await ctx.db
      .query("signals")
      .withIndex("by_active", (q) => q.eq("active", true))
      .order("desc")
      .take(50);
    // Seasonal campaigns: only surface the active season's signals.
    if (args.campaignId) {
      signals = signals.filter(
        (s: { campaignId?: Id<"argCampaigns"> }) => s.campaignId === args.campaignId,
      );
    }
    return signals.map((s) => {
      const locked = signalLockedFor(viewer?.tier ?? null, s.tierRequired ?? null);
      return {
        _id: s._id,
        title: s.title,
        // Locked signals stay visible (they advertise the clearance) but the
        // ciphertext and hint are withheld until the viewer qualifies.
        ciphertext: locked ? "" : s.ciphertext,
        hint: locked ? "" : s.hint,
        rewardXp: s.rewardXp ?? DEFAULT_REWARD_XP,
        rewardCredits: s.rewardCredits ?? DEFAULT_REWARD_CREDITS,
        solved: !!me && s.solvedBy.includes(me),
        locked,
        requiredTier: s.tierRequired ?? null,
        campaignId: s.campaignId ?? null,
        createdAt: s.createdAt,
      };
    });
  },
});

export const solveSignal = mutation({
  args: { signalId: v.id("signals"), answer: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required to decrypt signals.");

    const signal = await ctx.db.get(args.signalId);
    if (!signal || !signal.active) throw new Error("Signal not found.");

    // Clearance gate — enforced server-side, never trusted from the client.
    const me = await ctx.db.get(userId);
    if (signalLockedFor(me?.tier ?? null, signal.tierRequired ?? null)) {
      throw new Error(
        "Clearance denied — this signal requires a higher membership tier.",
      );
    }

    const normalized = normalizeAnswer(args.answer);
    if (!normalized) throw new Error("Enter a decrypted answer.");

    if (normalized !== signal.plaintext) {
      return { solved: false, alreadySolved: false, message: "Decryption failed — the signal remains scrambled." };
    }

    if (signal.solvedBy.includes(userId)) {
      return { solved: true, alreadySolved: true, message: "Signal already decoded — no further reward." };
    }

    const xp = signal.rewardXp ?? DEFAULT_REWARD_XP;
    const credits = signal.rewardCredits ?? DEFAULT_REWARD_CREDITS;

    await applyXpGain(ctx, userId, xp);
    await ctx.db.patch(args.signalId, { solvedBy: [...signal.solvedBy, userId] });
    await grantCredits(ctx, userId, credits, "signal.solved");

    await ctx.db.insert("notifications", {
      userId,
      kind: "signal_solved",
      title: "Signal decoded",
      body: `You decrypted \"${signal.title}\" and earned ${xp} XP and ${credits} Star Credits.`,
      url: "/vault",
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "signal.solved",
      target: `signal:${args.signalId}`,
      meta: JSON.stringify({ xp, credits }),
      createdAt: Date.now(),
    });

    return { solved: true, alreadySolved: false, message: "Signal decoded — reward transmitted." };
  },
});

export const createSignal = mutation({
  args: {
    title: v.string(),
    ciphertext: v.string(),
    hint: v.string(),
    plaintext: v.string(),
    rewardXp: v.optional(v.number()),
    rewardCredits: v.optional(v.number()),
    // Clearance gate: tierRequired locks the signal to that tier or higher.
    tierRequired: v.optional(v.string()),
    campaignId: v.optional(v.id("argCampaigns")),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "lore_archivist",
    ]);
    const title = args.title.trim();
    const ciphertext = args.ciphertext.trim();
    const hint = args.hint.trim();
    const plaintext = normalizeAnswer(args.plaintext);
    if (!title || !ciphertext || !hint || !plaintext) {
      throw new Error("Title, ciphertext, hint, and answer are required.");
    }
    if (args.tierRequired && !TIER_ORDER.includes(args.tierRequired as TierId)) {
      throw new Error("Unknown clearance tier.");
    }
    const id = await ctx.db.insert("signals", {
      title,
      ciphertext,
      hint,
      plaintext,
      rewardXp: args.rewardXp,
      rewardCredits: args.rewardCredits,
      solvedBy: [],
      active: true,
      tierRequired: (args.tierRequired as TierId | undefined) ?? undefined,
      campaignId: args.campaignId ?? undefined,
      createdBy: me,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "signal.create",
      target: `signal:${id}`,
      meta: JSON.stringify({ title }),
      createdAt: Date.now(),
    });
    return id;
  },
});

export const archiveSignal = mutation({
  args: { id: v.id("signals") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "lore_archivist",
    ]);
    await ctx.db.patch(args.id, { active: false });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "signal.archive",
      target: `signal:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
