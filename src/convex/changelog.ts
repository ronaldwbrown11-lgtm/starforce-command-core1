import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Changelog (#27)
//
// Operator-posted release notes and platform updates shown as a public
// timeline at /changelog — keeps members informed about what ships and
// what's coming.
// =========================================================================

export const listChangelog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("changelogEntries")
      .withIndex("by_published")
      .order("desc")
      .take(args.limit ?? 30);
    return Promise.all(
      entries.map(async (e) => {
        const author = e.authorId ? await ctx.db.get(e.authorId) : null;
        return {
          _id: e._id,
          title: e.title,
          body: e.body,
          version: e.version ?? null,
          publishedAt: e.publishedAt,
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

export const postChangelog = mutation({
  args: { title: v.string(), body: v.string(), version: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title || !body) throw new Error("Title and notes are required.");
    if (title.length > 160) throw new Error("Title is limited to 160 characters.");
    if (body.length > 5000) throw new Error("Notes are limited to 5,000 characters.");
    const version = args.version?.trim() || undefined;
    if (version && version.length > 40) throw new Error("Version is limited to 40 characters.");
    const id = await ctx.db.insert("changelogEntries", {
      title,
      body,
      version,
      authorId: me,
      publishedAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "changelog.post",
      target: `changelog:${id}`,
      meta: JSON.stringify({ title, version: version ?? null }),
      createdAt: Date.now(),
    });
    return id;
  },
});

export const deleteChangelog = mutation({
  args: { id: v.id("changelogEntries") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "changelog.delete",
      target: `changelog:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
