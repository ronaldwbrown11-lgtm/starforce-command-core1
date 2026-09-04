import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { requireOperatorCapability } from "./admin";
import { grantCredits } from "./economy";

// =========================================================================
// Member-created lore contests (#40)
//
// Operators launch a themed contest with an open submission window; any
// signed-in member can enter (one entry each). When the window closes,
// operators judge entries, mark finalists + winners, and winners receive
// XP + Star Credits. Contest state is stored on the row but the *open* gate
// always also checks the clock, so a contest can never be submitted to after
// its deadline even if an operator forgets to flip status.
// =========================================================================

export const CONTEST_JURY_CAPS = [
  "operator",
  "senior_operator",
  "lore_archivist",
  "story_editor",
] as const;

const ENTRY_MAX_TITLE = 120;
const ENTRY_MAX_BODY = 6000;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 64) || "contest"
  );
}

function contestOpen(
  contest: { startsAt: number; endsAt: number; status: string },
  now = Date.now(),
): boolean {
  return contest.startsAt <= now && now <= contest.endsAt;
}

function describeContest(
  contest: {
    _id: Id<"contests">;
    title: string;
    slug: string;
    description: string;
    prompt?: string;
    rules?: string;
    status: string;
    startsAt: number;
    endsAt: number;
    judgingEndsAt?: number;
    rewardXp?: number;
    rewardCredits?: number;
    winnerCount?: number;
    createdAt: number;
  },
  now = Date.now(),
) {
  const over = now > contest.endsAt;
  let status = contest.status;
  if (contest.status === "upcoming" && now >= contest.startsAt && !over) {
    status = "open";
  } else if (contest.status === "open" && over) {
    status = "closed";
  }
  return {
    _id: contest._id,
    title: contest.title,
    slug: contest.slug,
    description: contest.description,
    prompt: contest.prompt ?? null,
    rules: contest.rules ?? null,
    status,
    startsAt: contest.startsAt,
    endsAt: contest.endsAt,
    judgingEndsAt: contest.judgingEndsAt ?? null,
    rewardXp: contest.rewardXp ?? null,
    rewardCredits: contest.rewardCredits ?? null,
    winnerCount: contest.winnerCount ?? 1,
    canEnter: contestOpen(contest, now) && contest.status !== "closed",
    createdAt: contest.createdAt,
  };
}

// ---- Public reads --------------------------------------------------------

export const listContests = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("contests").order("desc").take(args.limit ?? 50);
    const ids = new Set(rows.map((c) => c._id));
    const submissions = await ctx.db.query("contestSubmissions").collect();
    const perContest = new Map<Id<"contests">, number>();
    for (const s of submissions) {
      if (ids.has(s.contestId)) {
        perContest.set(s.contestId, (perContest.get(s.contestId) ?? 0) + 1);
      }
    }
    return rows.map((c) => ({
      ...describeContest(c),
      entryCount: perContest.get(c._id) ?? 0,
    }));
  },
});

export const contestBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const contest = await ctx.db
      .query("contests")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!contest) return null;

    const entries = await ctx.db
      .query("contestSubmissions")
      .withIndex("by_contest", (q) => q.eq("contestId", contest._id))
      .order("desc")
      .collect();
    const authorIds = Array.from(new Set(entries.map((e) => e.authorId)));
    const users = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const byId = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));
    const creator = await ctx.db.get(contest.createdBy);

    return {
      contest: describeContest(contest),
      entryCount: entries.length,
      creatorName:
        creator?.displayName ?? creator?.name ?? "Fleet Operator",
      entries: entries.map((e) => {
        const u = byId.get(e.authorId);
        return {
          _id: e._id,
          title: e.title,
          body: e.body,
          status: e.status,
          createdAt: e.createdAt,
          author: u
            ? {
                displayName: u.displayName ?? u.name ?? "Unknown pilot",
                rank: u.rank ?? null,
                avatarUrl: u.avatarUrl ?? null,
                xp: u.xp ?? 0,
              }
            : null,
        };
      }),
    };
  },
});

export const myContestEntry = query({
  args: { contestId: v.id("contests") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    return await ctx.db
      .query("contestSubmissions")
      .withIndex("by_contest", (q) => q.eq("contestId", args.contestId))
      .filter((q) => q.eq(q.field("authorId"), me))
      .first();
  },
});

// ---- Member submission ---------------------------------------------------

export const submitContestEntry = mutation({
  args: {
    contestId: v.id("contests"),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const contest = await ctx.db.get(args.contestId);
    if (!contest) throw new Error("Contest not found.");

    if (contest.status === "closed" || !contestOpen(contest)) {
      throw new Error("This contest's submission window is closed.");
    }

    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Give your entry a title.");
    if (!body) throw new Error("Entry body cannot be empty.");
    if (title.length > ENTRY_MAX_TITLE) {
      throw new Error(`Title must be ${ENTRY_MAX_TITLE} characters or fewer.`);
    }
    if (body.length > ENTRY_MAX_BODY) {
      throw new Error(`Entry must be ${ENTRY_MAX_BODY} characters or fewer.`);
    }

    const existing = await ctx.db
      .query("contestSubmissions")
      .withIndex("by_contest", (q) => q.eq("contestId", args.contestId))
      .filter((q) => q.eq(q.field("authorId"), me))
      .first();

    const now = Date.now();
    if (existing) {
      // One entry per pilot — allow refining until the window closes.
      await ctx.db.patch(existing._id, {
        title,
        body,
        status: "submitted",
        updatedAt: now,
      });
      return { ok: true, updated: true, id: existing._id };
    }

    const id = await ctx.db.insert("contestSubmissions", {
      contestId: args.contestId,
      authorId: me,
      title,
      body,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("activityFeed", {
      actorId: me,
      verb: "entered_contest",
      targetType: "contest",
      targetId: contest._id,
      url: `/contests/${contest.slug}`,
      summary: `Entered “${contest.title}” with “${title}”`,
      createdAt: now,
    });
    return { ok: true, updated: false, id };
  },
});

export const deleteMyContestEntry = mutation({
  args: { id: v.id("contestSubmissions") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Entry not found.");
    if (row.authorId !== me) throw new Error("You can only remove your own entry.");
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

// ---- Operator judging -----------------------------------------------------

export const createContest = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    prompt: v.optional(v.string()),
    rules: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.number(),
    judgingEndsAt: v.optional(v.number()),
    rewardXp: v.optional(v.number()),
    rewardCredits: v.optional(v.number()),
    winnerCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      ...CONTEST_JURY_CAPS,
      "community_moderator",
    ]);
    const title = args.title.trim();
    const description = args.description.trim();
    if (!title || !description) {
      throw new Error("Title and description are required.");
    }
    if (!Number.isFinite(args.startsAt) || !Number.isFinite(args.endsAt)) {
      throw new Error("Pick valid dates.");
    }
    if (args.endsAt <= args.startsAt) {
      throw new Error("The deadline must be after the start.");
    }

    const base = slugify(title);
    let slug = base;
    let attempt = 1;
    while (true) {
      const clash = await ctx.db
        .query("contests")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!clash) break;
      slug = `${base}-${attempt++}`;
    }

    const now = Date.now();
    const status = args.startsAt > now ? "upcoming" : "open";
    const id = await ctx.db.insert("contests", {
      title,
      slug,
      description,
      prompt: args.prompt?.trim() || undefined,
      rules: args.rules?.trim() || undefined,
      status,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      judgingEndsAt: args.judgingEndsAt ?? undefined,
      createdBy: me,
      rewardXp: args.rewardXp && args.rewardXp > 0 ? args.rewardXp : undefined,
      rewardCredits:
        args.rewardCredits && args.rewardCredits > 0 ? args.rewardCredits : undefined,
      winnerCount:
        args.winnerCount && args.winnerCount > 0 ? Math.min(10, args.winnerCount) : 1,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "contest.create",
      target: `contest:${id}`,
      meta: JSON.stringify({ title, slug }),
      createdAt: now,
    });
    return { ok: true, id, slug };
  },
});

export const setContestStatus = mutation({
  args: {
    id: v.id("contests"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("open"),
      v.literal("voting"),
      v.literal("closed"),
      v.literal("announced"),
    ),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      ...CONTEST_JURY_CAPS,
      "community_moderator",
    ]);
    const contest = await ctx.db.get(args.id);
    if (!contest) throw new Error("Contest not found.");
    await ctx.db.patch(args.id, { status: args.status });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "contest.status",
      target: `contest:${args.id}`,
      meta: JSON.stringify({ status: args.status }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const listContestEntries = query({
  args: { contestId: v.id("contests") },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      ...CONTEST_JURY_CAPS,
      "community_moderator",
    ]);
    const rows = await ctx.db
      .query("contestSubmissions")
      .withIndex("by_contest", (q) => q.eq("contestId", args.contestId))
      .order("desc")
      .collect();
    const users = await Promise.all(
      Array.from(new Set(rows.map((r) => r.authorId))).map((id) => ctx.db.get(id)),
    );
    const byId = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));
    return rows.map((r) => {
      const u = byId.get(r.authorId);
      return {
        _id: r._id,
        title: r.title,
        body: r.body,
        status: r.status,
        createdAt: r.createdAt,
        authorId: r.authorId,
        authorName: u?.displayName ?? u?.name ?? "Unknown pilot",
      };
    });
  },
});

export const judgeEntry = mutation({
  args: {
    id: v.id("contestSubmissions"),
    outcome: v.union(v.literal("winner"), v.literal("finalist"), v.literal("none")),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [...CONTEST_JURY_CAPS]);
    const entry = await ctx.db.get(args.id);
    if (!entry) throw new Error("Entry not found.");
    const contest = await ctx.db.get(entry.contestId);
    if (!contest) throw new Error("Contest not found.");

    const nextStatus =
      args.outcome === "none" ? "submitted" : (args.outcome as string);
    await ctx.db.patch(args.id, { status: nextStatus, updatedAt: Date.now() });

    // Winner reward — paid exactly once per entry (guarded by awardedAt).
    if (
      args.outcome === "winner" &&
      !entry.awardedAt &&
      (contest.rewardXp || contest.rewardCredits)
    ) {
      const author = await ctx.db.get(entry.authorId);
      if (author) {
        const xp = contest.rewardXp ?? 0;
        const credits = contest.rewardCredits ?? 0;
        await ctx.db.patch(entry.authorId, { xp: (author.xp ?? 0) + xp });
        if (credits > 0) {
          await grantCredits(ctx, entry.authorId, credits, "contest_winner");
        }
        if (xp > 0) {
          await ctx.db.insert("auditLog", {
            actorId: entry.authorId,
            action: "xp.grant",
            target: `contestEntry:${entry._id}`,
            meta: JSON.stringify({ source: "contest_winner", amount: xp }),
            createdAt: Date.now(),
          });
        }
        await ctx.db.insert("activityFeed", {
          actorId: entry.authorId,
          verb: "won_contest",
          targetType: "contest",
          targetId: contest._id,
          url: `/contests/${contest.slug}`,
          summary: `Won “${contest.title}” with “${entry.title}”`,
          createdAt: Date.now(),
        });
        await ctx.db.insert("notifications", {
          userId: entry.authorId,
          kind: "contest_winner",
          title: `You won “${contest.title}”`,
          body: `“${entry.title}” placed among the winners — ${xp ? `${xp} XP` : ""}${
            xp && credits ? " and " : ""
          }${credits ? `${credits} Star Credits` : ""} awarded.`,
          url: `/contests/${contest.slug}`,
          createdAt: Date.now(),
        });
      }
      await ctx.db.patch(args.id, { awardedAt: Date.now() });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `contest.judge_${args.outcome}`,
      target: `contestSubmission:${entry._id}`,
      meta: JSON.stringify({ contestId: entry.contestId }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeContest = mutation({
  args: { id: v.id("contests") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [...CONTEST_JURY_CAPS]);
    const contest = await ctx.db.get(args.id);
    if (!contest) throw new Error("Contest not found.");
    const entries = await ctx.db
      .query("contestSubmissions")
      .withIndex("by_contest", (q) => q.eq("contestId", args.id))
      .collect();
    await Promise.all(entries.map((e) => ctx.db.delete(e._id)));
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "contest.delete",
      target: `contest:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
