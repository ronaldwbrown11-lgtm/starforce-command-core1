import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";

// ---- Public queries -------------------------------------------------------

/** List all published FAQ items, grouped by category, ordered. */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("faqItems")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    return items.sort((a, b) => {
      const catCmp = (a.category ?? "").localeCompare(b.category ?? "");
      if (catCmp !== 0) return catCmp;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  },
});

// ---- Operator mutations ---------------------------------------------------

/** Create or update a FAQ item (operator only). */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("faqItems")),
    question: v.string(),
    answer: v.string(),
    category: v.string(),
    order: v.optional(v.number()),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    const now = Date.now();
    const data = {
      question: args.question.trim(),
      answer: args.answer.trim(),
      category: args.category,
      order: args.order ?? 0,
      status: args.status,
      updatedAt: now,
    };
    if (args.id) {
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return await ctx.db.insert("faqItems", { ...data, createdAt: now } as any);
  },
});

/** Delete a FAQ item (operator only). */
export const remove = mutation({
  args: { id: v.id("faqItems") },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    await ctx.db.delete(args.id);
  },
});

/** Bulk reorder FAQ items within a category. */
export const reorder = mutation({
  args: {
    ids: v.array(v.id("faqItems")),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    for (let i = 0; i < args.ids.length; i++) {
      await ctx.db.patch(args.ids[i], { order: i, updatedAt: Date.now() });
    }
  },
});
