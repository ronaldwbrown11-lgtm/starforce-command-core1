import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listGroups = query({
  args: {
    privacy: v.optional(v.string()),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const groups = await ctx.db.query("groups").collect();
    return groups.filter((g) => {
      if (args.privacy && g.privacy !== args.privacy) return false;
      if (args.category && g.category !== args.category) return false;
      if (args.search) {
        const s = args.search.toLowerCase();
        if (!g.name.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  },
});

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    privacy: v.union(v.literal("public"), v.literal("private"), v.literal("classified")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const name = args.name.trim();
    const description = args.description.trim();
    if (!name) throw new Error("Group name cannot be empty.");
    if (!description) throw new Error("Group description cannot be empty.");

    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 48) || "group";
    let slug = base;
    let attempt = 1;
    while (true) {
      const existing = await ctx.db
        .query("groups")
        .filter((q) => q.eq(q.field("slug"), slug))
        .first();
      if (!existing) break;
      slug = `${base}-${attempt++}`;
    }

    const id = await ctx.db.insert("groups", {
      name,
      slug,
      description,
      category: args.category || "ops",
      privacy: args.privacy,
      memberCount: 1,
      latestActivityAt: Date.now(),
      createdAt: Date.now(),
    });

    // Founder automatically joins as owner.
    await ctx.db.insert("groupMembers", {
      groupId: id,
      userId,
      joinedAt: Date.now(),
      role: "owner",
    });

    return id;
  },
});

export const groupBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const userId = await getAuthUserId(ctx);
    const group = await ctx.db
      .query("groups")
      .filter((q) => q.eq(q.field("slug"), slug))
      .first();
    if (!group) return null;

    const members = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .order("asc")
      .take(200);

    const users = await Promise.all(members.map((m) => ctx.db.get(m.userId)));
    const memberList = members
      .map((m, i) => ({ member: m, user: users[i] ?? null }))
      .filter((x) => x.user !== null)
      .map((x) => ({
        userId: x.member.userId,
        joinedAt: x.member.joinedAt,
        role: x.member.role ?? "member",
        displayName: x.user!.displayName || x.user!.name || "Unknown pilot",
        rank: x.user!.rank ?? null,
        avatarUrl: x.user!.avatarUrl ?? null,
      }));

    const myMembership = userId
      ? memberList.find((m) => m.userId === userId) ?? null
      : null;

    return {
      group,
      members: memberList,
      isMember: myMembership !== null,
      myRole: myMembership?.role ?? null,
      meId: userId ?? null,
    };
  },
});

export const groupActivity = query({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    return await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(limit ?? 10);
  },
});

export const joinGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (existing) return existing._id;
    const id = await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId,
      joinedAt: Date.now(),
      role: "member",
    });
    const g = await ctx.db.get(args.groupId);
    if (g) {
      await ctx.db.patch(args.groupId, {
        memberCount: (g.memberCount ?? 0) + 1,
        latestActivityAt: Date.now(),
      });
    }
    return id;
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      const g = await ctx.db.get(args.groupId);
      if (g) {
        await ctx.db.patch(args.groupId, {
          memberCount: Math.max(0, (g.memberCount ?? 0) - 1),
        });
      }
      return true;
    }
    return false;
  },
});

export const createThread = mutation({
  args: {
    forumId: v.string(),
    title: v.string(),
    content: v.string(),
    // Optional quick-reaction poll attached to the thread (#39).
    poll: v.optional(
      v.object({
        question: v.string(),
        options: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const title = args.title.trim();
    const content = args.content.trim();
    if (!title) throw new Error("Thread title cannot be empty.");
    if (!content) throw new Error("Thread message cannot be empty.");

    // Validate the poll shape before creating the thread.
    let pollSpec: { question: string; options: string[] } | null = null;
    if (args.poll) {
      const question = args.poll.question.trim();
      const options = args.poll.options
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      if (!question) throw new Error("Poll question cannot be empty.");
      if (question.length > 200) {
        throw new Error("Poll question must be 200 characters or fewer.");
      }
      if (options.length < 2 || options.length > 6) {
        throw new Error("Polls need between 2 and 6 options.");
      }
      for (const o of options) {
        if (o.length > 80) {
          throw new Error("Poll options must be 80 characters or fewer.");
        }
      }
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
        throw new Error("Poll options must be unique.");
      }
      pollSpec = { question, options };
    }

    // Derive a URL-safe slug from the title, then ensure uniqueness.
    const base =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 48) || "thread";
    let slug = base;
    let attempt = 1;
    while (true) {
      const existing = await ctx.db
        .query("forumThreads")
        .filter((q) => q.eq(q.field("slug"), slug))
        .first();
      if (!existing) break;
      slug = `${base}-${attempt++}`;
    }

    const id = await ctx.db.insert("forumThreads", {
      title,
      slug,
      forumId: args.forumId,
      authorId: userId,
      content,
      replyCount: 0,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
    });

    if (pollSpec) {
      await ctx.db.insert("forumPolls", {
        threadId: id,
        createdBy: userId,
        question: pollSpec.question,
        options: pollSpec.options,
        createdAt: Date.now(),
      });
    }
    return id;
  },
});

export const threadBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const thread = await ctx.db
      .query("forumThreads")
      .filter((q) => q.eq(q.field("slug"), slug))
      .first();
    if (!thread) return null;

    const replies = await ctx.db
      .query("forumReplies")
      .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
      .order("asc")
      .take(200);

    const authorIds = [thread.authorId, ...replies.map((r) => r.authorId)];
    const users = await Promise.all(authorIds.map((id) => ctx.db.get(id)));
    const userById = new Map(
      users.filter(Boolean).map((u) => [u!._id, u]),
    );

    return {
      thread,
      author: userById.get(thread.authorId) ?? null,
      replies: replies.map((r) => ({
        ...r,
        author: userById.get(r.authorId) ?? null,
      })),
    };
  },
});

export const myGroupMemberships = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const listForumThreads = query({
  args: { forumId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("forumThreads")
      .order("desc")
      .take(args.limit ?? 20);
    return args.forumId
      ? all.filter((t) => t.forumId === args.forumId)
      : all;
  },
});

export const trendingForumThreads = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("forumThreads")
      .withIndex("by_last_activity")
      .order("desc")
      .take(limit ?? 6);
  },
});

export const listReplies = query({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("forumReplies")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(100);
  },
});

export const addReply = mutation({
  args: { threadId: v.id("forumThreads"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    if (!args.content.trim()) throw new Error("Reply cannot be empty.");
    const id = await ctx.db.insert("forumReplies", {
      threadId: args.threadId,
      authorId: userId,
      content: args.content.trim(),
      createdAt: Date.now(),
    });
    const t = await ctx.db.get(args.threadId);
    if (t) {
      await ctx.db.patch(args.threadId, {
        replyCount: (t.replyCount ?? 0) + 1,
        lastActivityAt: Date.now(),
      });
      // Notify the thread author when someone else replies.
      if (t.authorId !== userId) {
        await ctx.db.insert("notifications", {
          userId: t.authorId,
          kind: "forum_reply",
          title: "New reply to your thread",
          body: args.content.trim().slice(0, 140),
          url: `/forums?thread=${t.slug}`,
          createdAt: Date.now(),
        });
      }
    }
    return id;
  },
});

// ---- Quick-reaction polls (#39) ------------------------------------------

export const pollByThread = query({
  args: { threadId: v.id("forumThreads") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    const poll = await ctx.db
      .query("forumPolls")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .first();
    if (!poll) return null;

    const votes = await ctx.db
      .query("forumPollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", poll._id))
      .collect();
    const counts = poll.options.map(() => 0);
    let myVoteIndex: number | null = null;
    for (const vote of votes) {
      counts[vote.optionIndex] = (counts[vote.optionIndex] ?? 0) + 1;
      if (me && vote.userId === me) myVoteIndex = vote.optionIndex;
    }
    const author = await ctx.db.get(poll.createdBy);
    return {
      _id: poll._id,
      question: poll.question,
      options: poll.options,
      counts,
      total: votes.length,
      myVoteIndex,
      isAuthor: me === poll.createdBy,
      createdAt: poll.createdAt,
      authorName: author?.displayName ?? author?.name ?? "Unknown pilot",
    };
  },
});

export const voteOnPoll = mutation({
  args: { pollId: v.id("forumPolls"), optionIndex: v.number() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const poll = await ctx.db.get(args.pollId);
    if (!poll) throw new Error("Poll not found.");
    if (!Number.isInteger(args.optionIndex) || args.optionIndex < 0) {
      throw new Error("Invalid option.");
    }
    if (args.optionIndex >= poll.options.length) {
      throw new Error("Invalid option.");
    }

    const existing = await ctx.db
      .query("forumPollVotes")
      .withIndex("by_poll_user", (q) =>
        q.eq("pollId", args.pollId).eq("userId", me),
      )
      .first();
    if (existing) {
      return { ok: true, voted: false, alreadyVoted: true };
    }

    await ctx.db.insert("forumPollVotes", {
      pollId: args.pollId,
      userId: me,
      optionIndex: args.optionIndex,
      createdAt: Date.now(),
    });

    // Every vote pays the thread author +2 XP so polls feed the leaderboard
    // (self-votes excluded).
    if (poll.createdBy !== me) {
      const author = await ctx.db.get(poll.createdBy);
      if (author) {
        await ctx.db.patch(poll.createdBy, { xp: (author.xp ?? 0) + 2 });
        await ctx.db.insert("auditLog", {
          actorId: me,
          action: "xp.grant",
          target: `user:${poll.createdBy}`,
          meta: JSON.stringify({ source: "poll_vote", amount: 2 }),
          createdAt: Date.now(),
        });
      }
    }

    const votes = await ctx.db
      .query("forumPollVotes")
      .withIndex("by_poll", (q) => q.eq("pollId", args.pollId))
      .collect();
    const counts = poll.options.map(() => 0);
    for (const vote of votes) counts[vote.optionIndex] += 1;
    return { ok: true, voted: true, alreadyVoted: false, counts, total: votes.length };
  },
});
