import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Captain's Log (#10 — Creator presence)
//
// The creator's daily behind-the-scenes updates. Entries are composed on
// the operator console and surfaced on the Community page so the universe
// feels guided and alive.
// =========================================================================

export const listCaptainLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("captainLogs")
      .withIndex("by_published")
      .order("desc")
      .take(args.limit ?? 10);
    return Promise.all(
      logs.map(async (l) => {
        const author = l.authorId ? await ctx.db.get(l.authorId) : null;
        return {
          _id: l._id,
          title: l.title,
          body: l.body,
          publishedAt: l.publishedAt,
          author: author
            ? {
                displayName:
                  author.displayName ??
                  author.email?.split("@")[0] ??
                  "Unnamed recruit",
                rank: author.rank ?? "Recruit",
              }
            : null,
        };
      }),
    );
  },
});

export const postCaptainLog = mutation({
  args: { title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title || !body) throw new Error("Title and entry are required.");
    if (title.length > 120) throw new Error("Title is limited to 120 characters.");
    if (body.length > 4000) throw new Error("Entries are limited to 4,000 characters.");
    const id = await ctx.db.insert("captainLogs", {
      title,
      body,
      authorId: me,
      publishedAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "captainslog.post",
      target: `captainLog:${id}`,
      meta: JSON.stringify({ title }),
      createdAt: Date.now(),
    });
    return id;
  },
});

export const deleteCaptainLog = mutation({
  args: { id: v.id("captainLogs") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "captainslog.delete",
      target: `captainLog:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
