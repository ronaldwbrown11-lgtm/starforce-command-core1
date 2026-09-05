import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";
import {
  SEED_FACTIONS,
  isValidFactionCategory,
  slugifyFactionName,
  type FactionCategoryKey,
} from "../lib/factions";

// ---- Public queries -------------------------------------------------------

/**
 * List all factions for the registry. If the DB has no factions yet, the
 * canon seed catalog is returned in-memory so the registry is never empty.
 * `stored` tells callers whether the data is persisted (false = seed fallback).
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("factions").collect();
    if (docs.length === 0) {
      return {
        stored: false,
        items: SEED_FACTIONS.map((f) => ({
          _id: undefined as undefined,
          ...f,
          active: true,
          createdAt: 0,
          updatedAt: 0,
        })),
      };
    }
    const items = docs
      .filter((d) => d.active)
      .sort((a, b) => {
        const catCmp = (a.category ?? "").localeCompare(b.category ?? "");
        if (catCmp !== 0) return catCmp;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    return { stored: true, items };
  },
});

// ---- Operator mutations ---------------------------------------------------

/** Create or update a faction (operator only). */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("factions")),
    name: v.string(),
    category: v.string(),
    description: v.string(),
    accent: v.string(),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const name = args.name.trim();
    const description = args.description.trim();
    if (!name) throw new Error("Faction name is required.");
    if (!description) throw new Error("Faction description is required.");
    if (!isValidFactionCategory(args.category)) {
      throw new Error("Invalid faction category.");
    }
    if (!args.accent || !/^#[0-9a-fA-F]{6}$/.test(args.accent.trim())) {
      throw new Error("Accent must be a hex color like #00E5FF.");
    }
    const now = Date.now();
    const slug = slugifyFactionName(name);
    const data = {
      name,
      slug,
      category: args.category,
      description,
      accent: args.accent.trim(),
      icon: args.icon?.trim() || undefined,
      order: args.order ?? 0,
      active: args.active ?? true,
      updatedAt: now,
    };
    let id: string;
    if (args.id) {
      await ctx.db.patch(args.id, data);
      id = args.id;
    } else {
      id = await ctx.db.insert("factions", { ...data, createdAt: now });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "faction.update" : "faction.create",
      target: `faction:${id}`,
      meta: JSON.stringify({ name, slug, category: args.category }),
      createdAt: now,
    });
    return id;
  },
});

/** Delete a faction (operator only). */
export const remove = mutation({
  args: { id: v.id("factions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Faction not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "faction.delete",
      target: `faction:${args.id}`,
      meta: JSON.stringify({ name: existing.name, slug: existing.slug }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Toggle a faction's visibility (operator only). */
export const setActive = mutation({
  args: { id: v.id("factions"), active: v.boolean() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.active ? "faction.activate" : "faction.deactivate",
      target: `faction:${args.id}`,
      meta: JSON.stringify({ active: args.active }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Restore any missing canon factions (operator only). Idempotent by slug —
 * existing factions are never overwritten, only missing ones are inserted.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const existing = await ctx.db.query("factions").collect();
    const slugs = new Set(existing.map((d) => d.slug));
    const now = Date.now();
    let inserted = 0;
    for (const f of SEED_FACTIONS) {
      if (slugs.has(f.slug)) continue;
      await ctx.db.insert("factions", {
        name: f.name,
        slug: f.slug,
        category: f.category,
        description: f.description,
        accent: f.accent,
        icon: f.icon,
        order: f.order,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      slugs.add(f.slug);
      inserted++;
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "faction.seed",
      target: `factions:${SEED_FACTIONS.length}`,
      meta: JSON.stringify({ inserted }),
      createdAt: now,
    });
    return { inserted, total: SEED_FACTIONS.length };
  },
});

export type FactionCategoryKeyPublic = FactionCategoryKey;