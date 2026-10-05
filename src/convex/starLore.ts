import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOperatorCapability } from "./admin";

// Operator capabilities allowed to edit the shared canon Star Atlas
// (transferred from the Ultra Force project; writes are operator-gated,
// reads are public — see galaxyMap.ts).
const ATLAS_OPERATOR_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Shared canon atlas — every visitor sees the transferred star lore.
    const lore = await ctx.db.query("starLore").collect();

    return lore.map((l) => ({
      ...l,
      position: [l.posX, l.posY, l.posZ] as [number, number, number],
    }));
  },
});

export const setStarName = mutation({
  args: {
    starId: v.string(),
    name: v.string(),
    defaultName: v.string(),
    posX: v.number(),
    posY: v.number(),
    posZ: v.number(),
    color: v.string(),
    size: v.number(),
    temperature: v.number(),
    magnitude: v.number(),
    loreNotes: v.optional(v.string()),
    isCustom: v.optional(v.boolean()),
    category: v.optional(
      v.union(
        v.literal("hero"),
        v.literal("villain"),
        v.literal("neutral"),
        v.literal("ancient"),
        v.literal("guardian"),
        v.literal("mystery"),
        v.literal("none"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );

    if (!args.name.trim() || args.name.length > 120) throw new Error("Star name must be 1–120 characters");
    if (![args.posX, args.posY, args.posZ, args.size, args.temperature].every(Number.isFinite)) throw new Error("Star values must be finite");
    if (Math.max(Math.abs(args.posX), Math.abs(args.posY), Math.abs(args.posZ)) > 100) throw new Error("Coordinates must be within ±100 map units");
    if (!/^#[0-9a-f]{6}$/i.test(args.color)) throw new Error("Use a six-digit hex color");
    if (args.size < 0.1 || args.size > 5 || args.temperature < 1000 || args.temperature > 50000) throw new Error("Invalid size or temperature");

    // Check if this star already has lore
    const existing = await ctx.db
      .query("starLore")
      .filter((q) => q.eq(q.field("starId"), args.starId))
      .first();

    if (existing) {
      // Update the name & category
      await ctx.db.patch(existing._id, {
        ...args,
        name: args.name.trim(),
        isCustom: existing.isCustom ?? args.isCustom,
      });
    } else {
      // Create new entry
      await ctx.db.insert("starLore", {
        userId,
        ...args,
        name: args.name.trim(),
      });
    }
  },
});

export const updateLoreNotes = mutation({
  args: {
    starId: v.string(),
    loreNotes: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_OPERATOR_CAPS);

    const existing = await ctx.db
      .query("starLore")
      .filter((q) => q.eq(q.field("starId"), args.starId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { loreNotes: args.loreNotes });
    }
  },
});

export const resetStarName = mutation({
  args: {
    starId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_OPERATOR_CAPS);

    const existing = await ctx.db
      .query("starLore")
      .filter((q) => q.eq(q.field("starId"), args.starId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// ---------------------------------------------------------------------------
// Sector reference stars — one-time seeding of the labeled reference points
// every atlas sector needs for lore-star creation and galaxy-wide warp gates.
// Tombstoned like the other seeds: later deletions stay deleted, and existing
// lore docs are never overwritten.
// ---------------------------------------------------------------------------

export const seedSectorStars = mutation({
  args: {
    stars: v.array(
      v.object({
        starId: v.string(),
        name: v.string(),
        color: v.string(),
        size: v.number(),
        temperature: v.number(),
        magnitude: v.number(),
        posX: v.number(),
        posY: v.number(),
        posZ: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const user = await ctx.db.get(userId);
    if (user?.sectorStarsSeeded) return;

    for (const star of args.stars) {
      if (!star.name.trim() || star.name.length > 120)
        throw new Error("Star name must be 1–120 characters");
      if (![star.posX, star.posY, star.posZ, star.size, star.temperature].every(Number.isFinite))
        throw new Error("Star values must be finite");
      if (Math.max(Math.abs(star.posX), Math.abs(star.posY), Math.abs(star.posZ)) > 100)
        throw new Error("Coordinates must be within ±100 map units");
      if (!/^#[0-9a-f]{6}$/i.test(star.color)) throw new Error("Use a six-digit hex color");
      if (star.size < 0.1 || star.size > 5 || star.temperature < 1000 || star.temperature > 50000)
        throw new Error("Invalid size or temperature");

      const existing = await ctx.db
        .query("starLore")
        .filter((q) => q.eq(q.field("starId"), star.starId))
        .first();
      if (existing) continue; // never overwrite existing lore
      await ctx.db.insert("starLore", {
        userId,
        starId: star.starId,
        name: star.name.trim(),
        defaultName: star.name.trim(),
        posX: star.posX,
        posY: star.posY,
        posZ: star.posZ,
        color: star.color,
        size: star.size,
        temperature: star.temperature,
        magnitude: star.magnitude,
        isCustom: true,
      });
    }

    await ctx.db.patch(userId, { sectorStarsSeeded: true });
  },
});
