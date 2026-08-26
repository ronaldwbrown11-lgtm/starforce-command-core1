import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Direct messages
// Topology: messageThreads (1 row per chat) + threadMembers (junction with
// lastReadAt) + messages (append-only). Looking up "thread between me and X"
// is a join via by_thread_user index — no full-table scans.
// =========================================================================

async function findThreadBetween(
  ctx: MutationCtx,
  me: Id<"users">,
  other: Id<"users">,
) {
  const memberships = await ctx.db
    .query("threadMembers")
    .withIndex("by_user", (q) => q.eq("userId", me))
    .collect();
  for (const m of memberships) {
    const otherMember = await ctx.db
      .query("threadMembers")
      .withIndex("by_thread_user", (q) =>
        q.eq("threadId", m.threadId).eq("userId", other),
      )
      .first();
    if (otherMember) return m.threadId as string;
  }
  return null;
}

export const listMyThreads = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    const memberships = await ctx.db
      .query("threadMembers")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
    const out = await Promise.all(
      memberships.map(async (m) => {
        const thread = await ctx.db.get(m.threadId);
        if (!thread) return null;
        const allMembers = await ctx.db
          .query("threadMembers")
          .withIndex("by_thread_user", (q) =>
            q.eq("threadId", thread._id),
          )
          .collect();
        const otherMember = allMembers.find((mm) => mm.userId !== me);
        if (!otherMember) return null;
        const otherUser = await ctx.db.get(otherMember.userId);
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .order("desc")
          .first();
        const unread =
          !m.lastReadAt ||
          (lastMessage ? lastMessage.createdAt > m.lastReadAt : false);
        return {
          threadId: thread._id,
          otherUser: otherUser
            ? {
                _id: otherUser._id,
                displayName: otherUser.displayName,
                rank: otherUser.rank,
                tier: otherUser.tier,
                fleet: otherUser.fleet,
                avatarUrl: otherUser.avatarUrl,
              }
            : null,
          updatedAt: thread.updatedAt,
          lastReadAt: m.lastReadAt ?? null,
          unread,
          lastMessage: lastMessage
            ? {
                _id: lastMessage._id,
                body: lastMessage.body,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
              }
            : null,
        };
      }),
    );
    return out
      .filter(
        (x): x is NonNullable<typeof x> => x !== null && x.otherUser !== null,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const messagesInThread = query({
  args: {
    threadId: v.id("messageThreads"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    const member = await ctx.db
      .query("threadMembers")
      .withIndex("by_thread_user", (q) =>
        q.eq("threadId", args.threadId).eq("userId", me),
      )
      .first();
    if (!member) return [];
    const limit = Math.min(100, Math.max(1, args.limit ?? 50));
    // Returned newest-first so the chat can reverse for display.
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(limit);
  },
});

export const sendMessage = mutation({
  args: {
    body: v.string(),
    recipientId: v.optional(v.id("users")),
    threadId: v.optional(v.id("messageThreads")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const text = args.body.trim();
    if (!text) throw new Error("Empty messages are not allowed.");
    if (text.length > 4000) throw new Error("Message too long.");
    let threadId: Id<"messageThreads"> | null = args.threadId ?? null;
    if (!threadId) {
      if (!args.recipientId) throw new Error("recipientId or threadId required.");
      if (args.recipientId === me) throw new Error("Cannot message yourself.");
      const existing = await findThreadBetween(ctx, me, args.recipientId);
      if (existing) {
        threadId = existing as Id<"messageThreads">;
      } else {
        const newThread = await ctx.db.insert("messageThreads", {
          updatedAt: Date.now(),
        });
        threadId = newThread;
        await ctx.db.insert("threadMembers", { threadId, userId: me });
        await ctx.db.insert("threadMembers", {
          threadId,
          userId: args.recipientId,
        });
      }
    } else {
      // Confirm caller is a participant.
      const member = await ctx.db
        .query("threadMembers")
        .withIndex("by_thread_user", (q) =>
          q.eq("threadId", threadId!).eq("userId", me),
        )
        .first();
      if (!member) throw new Error("Not a participant in this thread.");
    }
    await ctx.db.insert("messages", {
      threadId: threadId!,
      senderId: me,
      body: text,
      createdAt: Date.now(),
    });
    await ctx.db.patch(threadId!, { updatedAt: Date.now() });
    // Notify the other participant of the thread about the new message.
    const members = await ctx.db
      .query("threadMembers")
      .withIndex("by_thread_user", (q) => q.eq("threadId", threadId!))
      .collect();
    const other = members.find((m) => m.userId !== me);
    if (other) {
      await ctx.db.insert("notifications", {
        userId: other.userId,
        kind: "direct_message",
        title: "New direct message",
        body: text.slice(0, 140),
        url: "/messages",
        createdAt: Date.now(),
      });
    }
    return { threadId };
  },
});

export const markThreadRead = mutation({
  args: { threadId: v.id("messageThreads") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return;
    const m = await ctx.db
      .query("threadMembers")
      .withIndex("by_thread_user", (q) =>
        q.eq("threadId", args.threadId).eq("userId", me),
      )
      .first();
    if (!m) return;
    await ctx.db.patch(m._id, { lastReadAt: Date.now() });
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return 0;
    const memberships = await ctx.db
      .query("threadMembers")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
    let n = 0;
    for (const m of memberships) {
      const last = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", m.threadId))
        .order("desc")
        .first();
      if (last && (!m.lastReadAt || last.createdAt > m.lastReadAt)) n += 1;
    }
    return n;
  },
});
