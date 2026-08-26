import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  awardAchievements,
  bumpContribution,
  evaluateAchievements,
} from "./achievements";
import { CREDIT_RATES, grantCredits } from "./economy";

// Canonical tier rank (mirrors src/lib/tiers.ts TIER_ORDER). Used to enforce
// mission clearance server-side so the client lock is not the only gate.
const TIER_RANK: Record<string, number> = {
  free: 0,
  cadet: 1,
  officer: 2,
  command: 3,
  gia_agent: 4,
};

export const missionBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return (
      (await ctx.db
        .query("missions")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()) ?? null
    );
  },
});

// The signed-in member's own report against a mission — returned regardless of
// review status so rejected/flagged reports (hidden from the public feed) can
// still be surfaced to their author with the operator's note.
export const myMissionReport = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return (
      (await ctx.db
        .query("fleetReports")
        .withIndex("by_author_mission", (q) =>
          q.eq("authorId", userId).eq("missionId", args.missionId),
        )
        .first()) ?? null
    );
  },
});

// Field reports filed against a mission, newest first, with the author's
// public identity joined in so the page doesn't need a second roundtrip.
export const missionReports = query({
  args: { missionId: v.id("missions"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("fleetReports")
      .withIndex("by_mission", (q) => q.eq("missionId", args.missionId))
      .order("desc")
      .take(args.limit ? args.limit * 3 : 36);
    // Rejected/flagged reports are pulled from the public feed once reviewed;
    // pending + approved stay visible.
    const visible = rows.filter((r) => {
      const s = r.reviewStatus ?? "pending";
      return s !== "rejected" && s !== "flagged";
    }).slice(0, args.limit ?? 12);
    return Promise.all(
      visible.map(async (r) => {
        const author = r.authorId ? await ctx.db.get(r.authorId) : null;
        return {
          _id: r._id,
          title: r.title,
          content: r.content,
          xpAwarded: r.xpAwarded ?? null,
          reviewStatus: r.reviewStatus ?? "pending",
          createdAt: r.createdAt,
          author: author
            ? {
                _id: author._id,
                displayName: author.displayName ?? null,
                rank: author.rank ?? null,
              }
            : null,
        };
      }),
    );
  },
});

// How many field reports this member has filed. Used by the activity feed
// to show a "Pick your first mission" CTA until the pilot has run one.
export const myReportCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const all = await ctx.db.query("fleetReports").collect();
    return all.filter((r) => r.authorId === userId).length;
  },
});

export const fileMissionReport = mutation({
  args: { missionId: v.id("missions"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");

    const mission = await ctx.db.get(args.missionId);
    if (!mission) throw new Error("Mission not found.");
    if (mission.missionStatus === "completed")
      throw new Error("This operation has closed; reports are no longer accepted.");
    if (mission.missionStatus === "locked")
      throw new Error("This briefing is classified above your clearance.");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");

    // Enforce clearance server-side — never trust the client lock.
    if (mission.tierRequired) {
      const userTier = (user.tier ?? "free") as string;
      if ((TIER_RANK[userTier] ?? 0) < (TIER_RANK[mission.tierRequired] ?? 0)) {
        throw new Error(
          `This operation requires ${mission.tierRequired} clearance.`,
        );
      }
    }

    const body = args.content.trim();
    if (body.length < 20)
      throw new Error("Reports must be at least 20 characters.");
    if (body.length > 2000)
      throw new Error("Reports are limited to 2,000 characters.");

    // One report per member per operation — keeps XP honest and the board
    // readable.
    const existing = await ctx.db
      .query("fleetReports")
      .withIndex("by_author_mission", (q) =>
        q.eq("authorId", userId).eq("missionId", args.missionId),
      )
      .first();
    if (existing)
      throw new Error("You already filed a report for this operation.");

    const xpAwarded = mission.xpReward ?? 0;
    const reportId = await ctx.db.insert("fleetReports", {
      title: `${mission.title} — field report`,
      content: body,
      authorId: userId,
      missionId: args.missionId,
      xpAwarded: xpAwarded || undefined,
      reviewStatus: "pending",
      createdAt: Date.now(),
    });

    await ctx.db.patch(userId, { xp: (user.xp ?? 0) + xpAwarded });

    // Achievement + economy hooks — filed reports count as verified
    // contributions and earn credits.
    await awardAchievements(ctx, userId, ["explorer"]);
    await bumpContribution(ctx, userId);
    await evaluateAchievements(ctx, userId);
    await grantCredits(
      ctx,
      userId,
      CREDIT_RATES.missionReport,
      "mission.report",
    );

    await ctx.db.insert("activityFeed", {
      actorId: userId,
      verb: "filed_report",
      targetType: "mission",
      targetId: args.missionId,
      url: `/missions/${mission.slug}`,
      summary: `Filed a field report on ${mission.title}`,
      createdAt: Date.now(),
    });

    return { reportId, xpAwarded };
  },
});
