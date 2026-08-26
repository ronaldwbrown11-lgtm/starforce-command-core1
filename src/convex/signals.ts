import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import { grantCredits } from "./economy";

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
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_active", (q) => q.eq("active", true))
      .order("desc")
      .take(50);
    return signals.map((s) => ({
      _id: s._id,
      title: s.title,
      ciphertext: s.ciphertext,
      hint: s.hint,
      rewardXp: s.rewardXp ?? DEFAULT_REWARD_XP,
      rewardCredits: s.rewardCredits ?? DEFAULT_REWARD_CREDITS,
      solved: !!me && s.solvedBy.includes(me),
      createdAt: s.createdAt,
    }));
  },
});

export const solveSignal = mutation({
  args: { signalId: v.id("signals"), answer: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required to decrypt signals.");

    const signal = await ctx.db.get(args.signalId);
    if (!signal || !signal.active) throw new Error("Signal not found.");

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

    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, { xp: (user.xp ?? 0) + xp });
    }
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
    const id = await ctx.db.insert("signals", {
      title,
      ciphertext,
      hint,
      plaintext,
      rewardXp: args.rewardXp,
      rewardCredits: args.rewardCredits,
      solvedBy: [],
      active: true,
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
