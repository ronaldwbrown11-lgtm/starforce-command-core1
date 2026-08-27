import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Public query — returns enabled links sorted by order. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("socialLinks")
      .collect()
      .then((rows) => rows.filter((r) => r.enabled).sort((a, b) => a.order - b.order));
  },
});

/** Operator: list all (including disabled). */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    const user = await ctx.db.get(me);
    if (!user || (user.role !== "admin" && !["operator", "senior_operator"].includes(String(user.opRole ?? "")))) return [];
    return await ctx.db
      .query("socialLinks")
      .collect()
      .then((rows) => rows.sort((a, b) => a.order - b.order));
  },
});

/** Operator: create a social link. */
export const create = mutation({
  args: {
    label: v.string(),
    url: v.string(),
    icon: v.string(),
    order: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user || (user.role !== "admin" && !["operator", "senior_operator"].includes(String(user.opRole ?? "")))) {
      throw new Error("Forbidden.");
    }
    return await ctx.db.insert("socialLinks", args);
  },
});

/** Operator: update a social link. */
export const update = mutation({
  args: {
    id: v.id("socialLinks"),
    label: v.optional(v.string()),
    url: v.optional(v.string()),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user || (user.role !== "admin" && !["operator", "senior_operator"].includes(String(user.opRole ?? "")))) {
      throw new Error("Forbidden.");
    }
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
  },
});

/** Operator: delete a social link. */
export const remove = mutation({
  args: { id: v.id("socialLinks") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user || (user.role !== "admin" && !["operator", "senior_operator"].includes(String(user.opRole ?? "")))) {
      throw new Error("Forbidden.");
    }
    await ctx.db.delete(args.id);
  },
});
