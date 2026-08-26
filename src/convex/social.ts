import { query, mutation, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Activity feed, comments, reactions, notifications
// =========================================================================

export const activityFeed = query({
  args: { limit: v.optional(v.number()), page: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(20, Math.max(1, args.limit ?? 10));
    const page = Math.max(1, args.page ?? 1);
    const all = await ctx.db
      .query("activityFeed")
      .withIndex("by_created")
      .order("desc")
      .take(limit * page);
    const items = all.slice((page - 1) * limit, page * limit);
    return items;
  },
});

export const addComment = mutation({
  args: {
    postId: v.string(),
    parentType: v.string(),
    content: v.string(),
    parentCommentId: v.optional(v.id("comments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    if (!args.content.trim()) throw new Error("Empty comments are not allowed.");
    const id = await ctx.db.insert("comments", {
      postId: args.postId,
      parentType: args.parentType,
      authorId: userId,
      content: args.content.trim(),
      parentCommentId: args.parentCommentId,
      status: "published",
      createdAt: Date.now(),
    });
    await ctx.db.insert("activityFeed", {
      actorId: userId,
      verb: "commented",
      targetType: args.parentType,
      targetId: args.postId,
      createdAt: Date.now(),
    });

    // Notify the owner of what was commented on (or the parent comment's
    // author when this is a reply), unless the actor is commenting on their
    // own content.
    if (args.parentCommentId) {
      const parent = await ctx.db.get(args.parentCommentId);
      if (parent && parent.authorId !== userId) {
        await ctx.db.insert("notifications", {
          userId: parent.authorId,
          kind: "comment_reply",
          title: "New reply to your comment",
          body: args.content.trim().slice(0, 140),
          url: `/stories/${args.postId}`,
          createdAt: Date.now(),
        });
      }
    } else {
      const ownerId = await resolveParentAuthorId(
        ctx,
        args.parentType,
        args.postId,
      );
      if (ownerId && ownerId !== userId) {
        await ctx.db.insert("notifications", {
          userId: ownerId,
          kind: "comment",
          title: `New comment on your ${labelForParentType(args.parentType)}`,
          body: args.content.trim().slice(0, 140),
          url: `/stories/${args.postId}`,
          createdAt: Date.now(),
        });
      }
    }
    return id;
  },
});

// Resolve the author of a commentable item by parent type. Returns null
// when the id doesn't resolve or the type is unknown — notification is best-effort.
async function resolveParentAuthorId(
  ctx: QueryCtx,
  parentType: string,
  postId: string,
): Promise<Id<"users"> | null> {
  try {
    if (parentType === "story") {
      const s = await ctx.db.get(postId as Id<"stories">);
      return (s?.authorId as Id<"users">) ?? null;
    }
    if (parentType === "lore") {
      const entry = await ctx.db.get(postId as Id<"loreEntries">);
      if (entry?.authorId) return entry.authorId as Id<"users">;
      const item = await ctx.db.get(postId as Id<"loreLibrary">);
      return (item?.authorId as Id<"users">) ?? null;
    }
    // Transmissions are operator-curated (no authorId), so no owner to notify.
    if (parentType === "activity") {
      const a = await ctx.db.get(postId as Id<"activityFeed">);
      return (a?.actorId as Id<"users">) ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function labelForParentType(parentType: string): string {
  switch (parentType) {
    case "story":
      return "story";
    case "lore":
      return "lore entry";
    case "transmission":
      return "transmission";
    case "activity":
      return "report";
    default:
      return "post";
  }
}

export const listComments = query({
  args: {
    postId: v.string(),
    parentType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("comments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("desc")
      .take(args.limit ?? 50);
    return all.filter(
      (c) => c.status === "published" && (!args.parentType || c.parentType === args.parentType),
    );
  },
});

export const toggleReaction = mutation({
  args: {
    targetId: v.string(),
    targetType: v.string(),
    kind: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_user_target", (q) =>
        q.eq("userId", userId).eq("targetId", args.targetId),
      )
      .filter((q) => q.eq(q.field("kind"), args.kind))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { active: false };
    }
    await ctx.db.insert("reactions", {
      targetId: args.targetId,
      targetType: args.targetType,
      userId,
      kind: args.kind,
      createdAt: Date.now(),
    });
    return { active: true };
  },
});

export const storyReactions = query({
  args: { storyId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const all = await ctx.db
      .query("reactions")
      .withIndex("by_target", (q) => q.eq("targetId", args.storyId))
      .collect();
    const counts: Record<string, number> = {};
    const mine: Record<string, boolean> = {};
    for (const r of all) {
      counts[r.kind] = (counts[r.kind] ?? 0) + 1;
      if (userId && r.userId === userId) mine[r.kind] = true;
    }
    return { counts, mine, total: all.length };
  },
});

export const listNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const markNotificationRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { readAt: Date.now() });
  },
});

// =========================================================================
// Member directory, online status, XP, fleets, achievements, spotlight
// =========================================================================

export const onlineCount = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const all = await ctx.db.query("users").collect();
    return {
      count: all.filter((u) => (u.lastSeen ?? 0) > cutoff).length,
    };
  },
});

export const rankProgress = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    const target = args.userId ?? me;
    if (!target) return null;
    const u = await ctx.db.get(target);
    if (!u) return null;
    const xp = u.xp ?? 0;
    // Renamed rank ladder so the "Cadet" rank no longer collides with
    // the Cadet membership tier.
    const thresholds: Array<[string, number]> = [
      ["Recruit", 0],
      ["Aspirant", 500],
      ["Pilot", 1500],
      ["Commander", 4000],
      ["Captain", 9000],
      ["Admiral", 20000],
    ];
    let nextRank: string | null = null;
    let nextThreshold: number | null = null;
    for (const [rank, threshold] of thresholds) {
      if (xp < threshold) {
        nextRank = rank;
        nextThreshold = threshold;
        break;
      }
    }
    let percent = 0;
    if (nextThreshold != null) {
      const prev = thresholds
        .filter(([, t]) => t <= xp)
        .map(([, t]) => t)
        .pop() ?? 0;
      const range = Math.max(1, nextThreshold - prev);
      percent = Math.min(100, Math.max(0, Math.round(((xp - prev) / range) * 100)));
    }
    return {
      xp,
      rank: u.rank ?? "Recruit",
      nextRank,
      nextThreshold,
      percent,
      tier: u.tier ?? "free",
    };
  },
});

export const memberSpotlight = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    const candidates = all.filter((u) => !u.isAnonymous && u.displayName);
    if (!candidates.length) return null;
    // Deterministic-ish: pick highest XP from top half.
    return candidates
      .slice()
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))[0];
  },
});

export const fleetStatus = query({
  args: {},
  handler: async () => {
    // Lightweight status snapshot for the public widget.
    return {
      overall: "operational",
      updatedAt: Date.now(),
      subsystems: [
        { key: "core", label: "Core systems", status: "ok", note: "All routes responsive." },
        { key: "rest", label: "REST API", status: "ok", note: "ultraforce/v1 online." },
        { key: "cache", label: "Cache layer", status: "ok", note: "Object cache active." },
        { key: "cron", label: "Scheduled tasks", status: "ok", note: "No missed events." },
      ],
    };
  },
});

export const listMembers = query({
  args: {
    search: v.optional(v.string()),
    tier: v.optional(v.string()),
    onlineOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const all = await ctx.db.query("users").collect();
    // Any non-anonymous member belongs on the roster, even before they've
    // picked a display name — fall back to the email handle so brand-new
    // sign-ins (email-only) show up instead of vanishing from the page.
    let list = all.filter((u) => !u.isAnonymous);
    if (args.search) {
      const q = args.search.toLowerCase();
      list = list.filter((u) => {
        const handle = u.displayName ?? (u.email ? u.email.split("@")[0] : "");
        return (
          handle.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          (u.fleet ?? "").toLowerCase().includes(q)
        );
      });
    }
    if (args.tier) list = list.filter((u) => u.tier === args.tier);
    if (args.onlineOnly) list = list.filter((u) => (u.lastSeen ?? 0) > cutoff);
    return list.slice(0, args.limit ?? 60);
  },
});

export const userProfile = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

// Everything a member has authored, grouped by content type, newest first.
// Powers the public dossier "Service Record" section.
export const userContributions = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    const [stories, lore, loreLibrary, reports, threads, comments, replies, memberships, activity] =
      await Promise.all([
        (await ctx.db.query("stories").collect()).filter(
          (s) => s.authorId === id,
        ),
        (await ctx.db.query("loreEntries").collect()).filter(
          (l) => l.authorId === id,
        ),
        (await ctx.db.query("loreLibrary").collect()).filter(
          (l) => l.authorId === id,
        ),
        (await ctx.db.query("fleetReports").collect()).filter(
          (r) => r.authorId === id,
        ),
        (await ctx.db.query("forumThreads").collect()).filter(
          (t) => t.authorId === id,
        ),
        (await ctx.db.query("comments").collect()).filter(
          (c) => c.authorId === id && c.status === "published",
        ),
        (await ctx.db.query("forumReplies").collect()).filter(
          (r) => r.authorId === id,
        ),
        ctx.db
          .query("groupMembers")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .collect(),
        (await ctx.db.query("activityFeed").collect()).filter(
          (a) => a.actorId === id,
        ),
      ]);
    const byDate = (a: { createdAt: number }, b: { createdAt: number }) =>
      b.createdAt - a.createdAt;
    const groups = await Promise.all(
      memberships.map((m) => ctx.db.get(m.groupId)),
    );
    return {
      stories: stories.sort(byDate).map((s) => ({
        _id: s._id,
        title: s.title,
        slug: s.slug,
        status: s.status,
        series: s.series ?? null,
        views: s.views ?? 0,
        publishedAt: s.publishedAt ?? null,
        updatedAt: s.updatedAt,
      })),
      lore: lore.sort(byDate).map((l) => ({
        _id: l._id,
        title: l.title,
        slug: l.slug,
        entryType: l.entryType ?? null,
        createdAt: l.createdAt,
      })),
      reports: reports.sort(byDate).map((r) => ({
        _id: r._id,
        title: r.title,
        createdAt: r.createdAt,
      })),
      threads: threads.sort(byDate).map((t) => ({
        _id: t._id,
        title: t.title,
        slug: t.slug,
        replyCount: t.replyCount ?? 0,
        createdAt: t.createdAt,
      })),
      loreItems: loreLibrary.sort(byDate).map((l) => ({
        _id: l._id,
        title: l.title,
        slug: l.slug,
        loreType: l.loreType ?? null,
        status: l.status ?? "submitted",
        createdAt: l.createdAt,
      })),
      comments: comments.sort(byDate).map((c) => ({
        _id: c._id,
        content: c.content,
        parentType: c.parentType,
        createdAt: c.createdAt,
      })),
      replies: replies.sort(byDate).map((r) => ({
        _id: r._id,
        content: r.content,
        createdAt: r.createdAt,
      })),
      memberships: memberships.map((m, i) => ({
        groupId: m.groupId,
        groupName: groups[i]?.name ?? "Unknown group",
        groupSlug: groups[i]?.slug ?? "",
        role: m.role ?? "member",
        joinedAt: m.joinedAt,
      })),
      activity: activity.sort(byDate).slice(0, 15).map((a) => ({
        _id: a._id,
        verb: a.verb,
        targetType: a.targetType,
        summary: a.summary ?? null,
        createdAt: a.createdAt,
      })),
    };
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return;
    await ctx.db.patch(me, { lastSeen: Date.now() });
  },
});

export const trackStoryProgress = mutation({
  args: { storyId: v.id("stories"), percent: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const pct = Math.max(0, Math.min(100, args.percent));
    const existing = await ctx.db
      .query("storyProgress")
      .withIndex("by_user_story", (q) =>
        q.eq("userId", userId).eq("storyId", args.storyId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        percent: Math.max(existing.percent, pct),
        updatedAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("storyProgress", {
      userId,
      storyId: args.storyId,
      percent: pct,
      updatedAt: Date.now(),
    });
  },
});

export const getStoryProgress = query({
  args: { storyId: v.id("stories") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("storyProgress")
      .withIndex("by_user_story", (q) =>
        q.eq("userId", userId).eq("storyId", args.storyId),
      )
      .first();
  },
});
