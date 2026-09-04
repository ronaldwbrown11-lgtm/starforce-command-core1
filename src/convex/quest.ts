import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { applyXpGain, grantCredits } from "./economy";

// =========================================================================
// Cadet Induction quest (#38)
//
// A guided first-week mission that teaches new members the loop that keeps
// the fleet alive: build a profile, join a group, react to a story, file a
// field report, and earn a badge. Completion is *derived* from the member's
// real activity (no fake checkboxes), so the panel updates reactively the
// moment each step is genuinely done. Completing all five pays a one-time
// XP + Star Credits bonus and a feed entry.
// =========================================================================

export const QUEST_REWARD = { xp: 150, credits: 25 } as const;

export const QUEST_STEPS = [
  { key: "profile", label: "Set up your pilot profile", href: "/account", cta: "Open profile" },
  { key: "group", label: "Join a fleet group", href: "/groups", cta: "Browse groups" },
  { key: "react", label: "React to a story", href: "/stories", cta: "Open stories" },
  { key: "report", label: "File a field report", href: "/missions", cta: "Pick a mission" },
  { key: "badge", label: "Earn your first badge", href: "/activity", cta: "View your feed" },
] as const;

export const getQuestStatus = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (!user) return null;

    const [memberships, reactions, reports] = await Promise.all([
      ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", me))
        .collect(),
      (await ctx.db.query("reactions").collect()).filter((r) => r.userId === me),
      (await ctx.db.query("fleetReports").collect()).filter(
        (r) => r.authorId === me,
      ),
    ]);

    const profileDone = !!(
      user.displayName &&
      (user.bio || user.rank || user.fleet || user.avatarStorageId || user.flair)
    );

    const done: Record<string, boolean> = {
      profile: profileDone,
      group: memberships.length > 0,
      react: reactions.length > 0,
      report: reports.length > 0,
      badge: (user.achievements ?? []).length > 0,
    };

    return {
      steps: QUEST_STEPS.map((s) => ({
        key: s.key,
        label: s.label,
        href: s.href,
        cta: s.cta,
        done: !!done[s.key],
      })),
      completedCount: Object.values(done).filter(Boolean).length,
      total: QUEST_STEPS.length,
      allDone: Object.values(done).every(Boolean),
      claimed: !!user.questClaimedAt,
      dismissed: !!user.questDismissedAt,
      reward: QUEST_REWARD,
    };
  },
});

export const claimQuestReward = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user) throw new Error("Account not found.");
    if (user.questClaimedAt) {
      throw new Error("Induction reward already claimed.");
    }

    // Inline re-check of the same rules getQuestStatus uses (a mutation
    // cannot call a query directly).
    const [memberships, reactions, reports] = await Promise.all([
      ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q) => q.eq("userId", me))
        .collect(),
      (await ctx.db.query("reactions").collect()).filter((r) => r.userId === me),
      (await ctx.db.query("fleetReports").collect()).filter(
        (r) => r.authorId === me,
      ),
    ]);
    const allDone =
      !!user.displayName &&
      !!(user.bio || user.rank || user.fleet || user.avatarStorageId || user.flair) &&
      memberships.length > 0 &&
      reactions.length > 0 &&
      reports.length > 0 &&
      (user.achievements ?? []).length > 0;
    if (!allDone) {
      throw new Error("Complete every induction step first.");
    }

    const now = Date.now();
    const xp = QUEST_REWARD.xp;
    const credits = QUEST_REWARD.credits;
    await applyXpGain(ctx, me, xp);
    await ctx.db.patch(me, {
      questClaimedAt: now,
    });
    await grantCredits(ctx, me, credits, "quest_induction");
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "xp.grant",
      target: `user:${me}`,
      meta: JSON.stringify({ source: "quest_induction", amount: xp }),
      createdAt: now,
    });
    await ctx.db.insert("activityFeed", {
      actorId: me,
      verb: "completed",
      targetType: "quest",
      targetId: "cadet-induction",
      summary: "Completed the Cadet Induction — welcome to the fleet",
      createdAt: now,
    });
    return { ok: true, xp, credits };
  },
});

export const dismissQuest = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    await ctx.db.patch(me, { questDismissedAt: Date.now() });
    return { ok: true };
  },
});

export const showQuestAgain = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    await ctx.db.patch(me, { questDismissedAt: undefined });
    return { ok: true };
  },
});
