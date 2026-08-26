import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// ---- Public queries -------------------------------------------------------

/** List published blog posts, newest first. Optional category filter. */
export const listPublished = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    if (args.category) {
      const filtered = await ctx.db
        .query("blogPosts")
        .withIndex("by_category", (q) =>
          q.eq("category", args.category!),
        )
        .order("desc")
        .collect();
      return filtered
        .filter((p) => p.status === "published")
        .slice(0, limit);
    }
    return await ctx.db
      .query("blogPosts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(limit);
  },
});

/** Single published post by slug. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .collect();
    return posts.find((p) => p.status === "published") ?? null;
  },
});

/** Featured posts for homepage. */
export const featured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("blogPosts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();
    return all.filter((p) => p.featured).slice(0, args.limit ?? 3);
  },
});

// ---- Operator mutations ---------------------------------------------------

/** Create or update a blog post (operator only). */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("blogPosts")),
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    body: v.string(),
    coverUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.string(),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    const userDoc = userId ? await ctx.db.get(userId) : null;
    const base = {
      title: args.title.trim(),
      slug: args.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      excerpt: args.excerpt.trim(),
      body: args.body,
      coverUrl: args.coverUrl || undefined,
      category: args.category || undefined,
      tags: args.tags?.filter(Boolean),
      status: args.status,
      featured: args.featured ?? false,
      authorId: userId ?? undefined,
      authorName: userDoc?.name ?? userDoc?.displayName ?? "Operator",
      publishedAt: args.status === "published" ? now : undefined,
      updatedAt: now,
    };
    if (args.id) {
      await ctx.db.patch(args.id, base);
      return args.id;
    }
    return await ctx.db.insert("blogPosts", { ...base, createdAt: now } as any);
  },
});

/** Delete a blog post (operator only). */
export const remove = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    await ctx.db.delete(args.id);
  },
});

/** Increment view count. */
export const recordView = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    await ctx.db.patch(args.id, {
      viewCount: (doc.viewCount ?? 0) + 1,
    });
  },
});
