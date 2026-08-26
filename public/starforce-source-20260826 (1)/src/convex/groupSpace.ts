import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// =========================================================================
// Group collaborator workspace — chat, posts/announcements, member roles,
// missions & events. Every read/write below requires group membership.
// =========================================================================

type GroupMemberDoc = Doc<"groupMembers">;
type GroupMemberRole = "owner" | "moderator" | "member";

function roleOf(m: GroupMemberDoc | null | undefined): GroupMemberRole {
  return m?.role ?? "member";
}

function canModerate(role: GroupMemberRole) {
  return role === "owner" || role === "moderator";
}

/** Resolve the caller's membership row for a group, or throw. */
async function requireMembership(ctx: QueryCtx | MutationCtx, groupId: Id<"groups">) {
  const me = await getAuthUserId(ctx);
  if (!me) throw new Error("Sign in required.");
  const member = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .filter((q) => q.eq(q.field("userId"), me))
    .first();
  if (!member) throw new Error("Join the group to access its workspace.");
  return { me, member };
}

async function authorMap(
  ctx: QueryCtx,
  ids: Array<Id<"users">>,
): Promise<Record<string, { displayName: string; avatarUrl?: string | null }>> {
  const unique = Array.from(new Set(ids));
  const out: Record<string, { displayName: string; avatarUrl?: string | null }> =
    {};
  await Promise.all(
    unique.map(async (id) => {
      const u = await ctx.db.get(id);
      if (u) {
        out[id] = {
          displayName: u.displayName || u.name || "Unknown pilot",
          avatarUrl: u.avatarUrl ?? null,
        };
      }
    }),
  );
  return out;
}

// ---- Real-time chat ----

export const listGroupMessages = query({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    await requireMembership(ctx, groupId);
    const recent = await ctx.db
      .query("groupMessages")
      .withIndex("by_group_created", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(limit ?? 100);
    const messages = [...recent].reverse();
    const authors = await authorMap(
      ctx,
      messages.map((m) => m.authorId),
    );
    return messages.map((m) => ({
      ...m,
      author: authors[m.authorId] ?? null,
    }));
  },
});

export const sendGroupMessage = mutation({
  args: { groupId: v.id("groups"), body: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireMembership(ctx, args.groupId);
    const body = args.body.trim();
    if (!body) throw new Error("Message cannot be empty.");
    if (body.length > 4000) throw new Error("Message is too long (max 4000).");
    const id = await ctx.db.insert("groupMessages", {
      groupId: args.groupId,
      authorId: me,
      body,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.groupId, { latestActivityAt: Date.now() });
    return id;
  },
});

export const deleteGroupMessage = mutation({
  args: { id: v.id("groupMessages") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Message not found.");
    await requireMembership(ctx, row.groupId);
    const member = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", row.groupId))
      .filter((q) => q.eq(q.field("userId"), me))
      .first();
    const mod = canModerate(roleOf(member));
    if (row.authorId !== me && !mod) {
      throw new Error("You can only delete your own messages.");
    }
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

// ---- Posts & announcements ----

export const listGroupPosts = query({
  args: { groupId: v.id("groups"), limit: v.optional(v.number()) },
  handler: async (ctx, { groupId, limit }) => {
    await requireMembership(ctx, groupId);
    const posts = await ctx.db
      .query("groupPosts")
      .withIndex("by_group_created", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(limit ?? 100);
    const authors = await authorMap(
      ctx,
      posts.map((p) => p.authorId),
    );
    return [...posts]
      .sort(
        (a, b) =>
          Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
          b.createdAt - a.createdAt,
      )
      .map((p) => ({ ...p, author: authors[p.authorId] ?? null }));
  },
});

export const createGroupPost = mutation({
  args: {
    groupId: v.id("groups"),
    title: v.string(),
    body: v.string(),
    kind: v.union(v.literal("post"), v.literal("announcement")),
  },
  handler: async (ctx, args) => {
    const { me, member } = await requireMembership(ctx, args.groupId);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Give the post a title.");
    if (!body) throw new Error("Post body cannot be empty.");
    if (args.kind === "announcement" && !canModerate(roleOf(member))) {
      throw new Error("Only owners and moderators can post announcements.");
    }
    const id = await ctx.db.insert("groupPosts", {
      groupId: args.groupId,
      authorId: me,
      title,
      body,
      kind: args.kind,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.groupId, { latestActivityAt: Date.now() });
    return id;
  },
});

export const pinGroupPost = mutation({
  args: { id: v.id("groupPosts"), pinned: v.boolean() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Post not found.");
    const { member } = await requireMembership(ctx, row.groupId);
    if (!canModerate(roleOf(member))) {
      throw new Error("Only owners and moderators can pin posts.");
    }
    await ctx.db.patch(args.id, { pinned: args.pinned });
    return { ok: true };
  },
});

export const deleteGroupPost = mutation({
  args: { id: v.id("groupPosts") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Post not found.");
    const { member } = await requireMembership(ctx, row.groupId);
    if (row.authorId !== me && !canModerate(roleOf(member))) {
      throw new Error("You can only delete your own posts.");
    }
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

// ---- Member roles & owner powers ----

export const setMemberRole = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("moderator"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const { me, member } = await requireMembership(ctx, args.groupId);
    if (roleOf(member) !== "owner") {
      throw new Error("Only the group owner can manage roles.");
    }
    if (args.userId === me) {
      throw new Error("You cannot change your own role.");
    }
    const target = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (!target) throw new Error("That member is not in this group.");
    if (roleOf(target) === "owner") {
      throw new Error("The owner's role cannot be changed.");
    }
    await ctx.db.patch(target._id, { role: args.role });
    return { ok: true };
  },
});

export const removeGroupMember = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const { me, member } = await requireMembership(ctx, args.groupId);
    if (args.userId === me) {
      throw new Error("Use \"Leave group\" to remove yourself.");
    }
    const target = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (!target) throw new Error("That member is not in this group.");
    const targetRole = roleOf(target);
    const myRole = roleOf(member);
    if (targetRole === "owner") {
      throw new Error("The owner cannot be removed.");
    }
    if (targetRole === "moderator" && myRole !== "owner") {
      throw new Error("Only the owner can remove moderators.");
    }
    if (myRole !== "owner" && myRole !== "moderator") {
      throw new Error("Only owners and moderators can remove members.");
    }
    await ctx.db.delete(target._id);
    const g = await ctx.db.get(args.groupId);
    if (g) {
      await ctx.db.patch(args.groupId, {
        memberCount: Math.max(0, (g.memberCount ?? 0) - 1),
      });
    }
    return { ok: true };
  },
});

export const transferOwnership = mutation({
  args: { groupId: v.id("groups"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const { me, member } = await requireMembership(ctx, args.groupId);
    if (roleOf(member) !== "owner") {
      throw new Error("Only the group owner can transfer ownership.");
    }
    if (args.userId === me) {
      throw new Error("You already own this group.");
    }
    const target = await ctx.db
      .query("groupMembers")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (!target) throw new Error("That member is not in this group.");
    await ctx.db.patch(target._id, { role: "owner" });
    await ctx.db.patch(member._id, { role: "member" });
    return { ok: true };
  },
});

// ---- Missions & events ----

export const listGroupEvents = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const { me } = await requireMembership(ctx, groupId);
    const events = await ctx.db
      .query("groupEvents")
      .withIndex("by_group_created", (q) => q.eq("groupId", groupId))
      .order("desc")
      .take(100);
    const creators = await authorMap(
      ctx,
      events.map((e) => e.createdBy),
    );
    const perEventSignups = await Promise.all(
      events.map(async (e) => {
        const rows = await ctx.db
          .query("groupEventSignups")
          .withIndex("by_event", (q) => q.eq("eventId", e._id))
          .collect();
        return { eventId: e._id, rows };
      }),
    );
    const signupsByEvent = new Map(
      perEventSignups.map((s) => [s.eventId, s.rows]),
    );
    return events.map((e) => ({
      ...e,
      createdByUser: creators[e.createdBy] ?? null,
      attendeeCount: signupsByEvent.get(e._id)?.length ?? 0,
      amSignedUp: (signupsByEvent.get(e._id) ?? []).some(
        (s) => s.userId === me,
      ),
    }));
  },
});

export const createGroupEvent = mutation({
  args: {
    groupId: v.id("groups"),
    title: v.string(),
    description: v.string(),
    kind: v.union(v.literal("mission"), v.literal("event")),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireMembership(ctx, args.groupId);
    const title = args.title.trim();
    const description = args.description.trim();
    if (!title) throw new Error("Give the mission/event a title.");
    if (!description) throw new Error("Add a short description.");
    const id = await ctx.db.insert("groupEvents", {
      groupId: args.groupId,
      createdBy: me,
      title,
      description,
      kind: args.kind,
      status: "open",
      scheduledAt: args.scheduledAt,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.groupId, { latestActivityAt: Date.now() });
    return id;
  },
});

export const setGroupEventStatus = mutation({
  args: {
    id: v.id("groupEvents"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Mission/event not found.");
    const { member } = await requireMembership(ctx, row.groupId);
    if (!canModerate(roleOf(member))) {
      throw new Error("Only owners and moderators can change status.");
    }
    await ctx.db.patch(args.id, { status: args.status });
    return { ok: true };
  },
});

export const deleteGroupEvent = mutation({
  args: { id: v.id("groupEvents") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Mission/event not found.");
    const { member } = await requireMembership(ctx, row.groupId);
    if (row.createdBy !== me && !canModerate(roleOf(member))) {
      throw new Error("Only the creator or a moderator can delete this.");
    }
    const signups = await ctx.db
      .query("groupEventSignups")
      .withIndex("by_event", (q) => q.eq("eventId", args.id))
      .collect();
    await Promise.all(signups.map((s) => ctx.db.delete(s._id)));
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});

export const toggleEventSignup = mutation({
  args: { id: v.id("groupEvents") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Mission/event not found.");
    await requireMembership(ctx, row.groupId);
    if (row.status === "completed" || row.status === "cancelled") {
      throw new Error("This mission/event is closed to signups.");
    }
    const existing = await ctx.db
      .query("groupEventSignups")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.id).eq("userId", me),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { ok: true, signedUp: false };
    }
    await ctx.db.insert("groupEventSignups", {
      eventId: args.id,
      userId: me,
      createdAt: Date.now(),
    });
    return { ok: true, signedUp: true };
  },
});
