import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";
import { FAQ_SEED, FAQ_CATEGORY_KEYS } from "../lib/faqSeed";

// Category display order — matches the public page's tab order.
const CATEGORY_RANK: Record<string, number> = Object.fromEntries(
  FAQ_CATEGORY_KEYS.map((key, i) => [key, i]),
);

// ---- Public queries -------------------------------------------------------

/**
 * List all published FAQ items ordered by category (General → Account) and
 * per-category order. If the table has no published rows yet, the canonical
 * seed catalog is served read-only (ids prefixed "seed:") so the public FAQ
 * page is never empty. Both branches return the same flat shape; `_id` is a
 * string so the client can treat rows uniformly.
 */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db
      .query("faqItems")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    if (items.length > 0) {
      return items
        .sort((a, b) => {
          const catCmp =
            (CATEGORY_RANK[a.category ?? ""] ?? 99) -
            (CATEGORY_RANK[b.category ?? ""] ?? 99);
          if (catCmp !== 0) return catCmp;
          return (a.order ?? 0) - (b.order ?? 0);
        })
        .map((item) => ({
          _id: item._id as unknown as string,
          question: item.question,
          answer: item.answer,
          category: item.category,
          order: item.order ?? 0,
          status: item.status,
          seedOnly: false,
        }));
    }
    return FAQ_SEED.map((s, idx) => ({
      _id: `seed:${idx}`,
      question: s.question,
      answer: s.answer,
      category: s.category,
      order: idx,
      status: "published",
      seedOnly: true,
    }));
  },
});

/**
 * Insert every seed FAQ the table is missing (idempotent by category +
 * question text). Never overwrites existing rows, so operator edits and
 * custom items are always safe. Operator-gated and audit-logged.
 */
export const seedDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const now = Date.now();
    let added = 0;
    const perCat: Record<string, number> = {};
    for (const seed of FAQ_SEED) {
      const existing = await ctx.db
        .query("faqItems")
        .withIndex("by_category", (q) => q.eq("category", seed.category))
        .collect();
      const normalized = seed.question.trim().toLowerCase();
      if (existing.some((e) => e.question.trim().toLowerCase() === normalized)) {
        continue;
      }
      const order = perCat[seed.category] ?? existing.length;
      perCat[seed.category] = order + 1;
      await ctx.db.insert("faqItems", {
        question: seed.question,
        answer: seed.answer,
        category: seed.category,
        order,
        status: "published",
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "faq.seed",
      target: `faq:${added}-items`,
      meta: JSON.stringify({ added, catalog: FAQ_SEED.length }),
      createdAt: now,
    });
    return { added, catalog: FAQ_SEED.length };
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
