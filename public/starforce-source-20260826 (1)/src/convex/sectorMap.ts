import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Sector Map — the SVG galaxy map on the Lore page. Each row is a named
// sector with an (x, y) position inside the SVG viewBox, plus an optional
// lore count used for node sizing. Managed from the Operator Console
// ("Sector Map" desk); the public widget only ever reads these rows.
// =========================================================================

const SECTOR_CAPS = ["operator", "senior_operator", "lore_archivist"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const listSectorsForOperator = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, SECTOR_CAPS);
    return await ctx.db.query("sectorMap").collect();
  },
});

export const upsertSector = mutation({
  args: {
    id: v.optional(v.id("sectorMap")),
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    loreCount: v.optional(v.number()),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const name = args.name.trim();
    if (!name) throw new Error("Sector name is required.");
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
      throw new Error("X and Y coordinates must be finite numbers.");
    }
    const description = (args.description ?? "").trim().slice(0, 280) || undefined;
    const loreCount =
      args.loreCount != null && Number.isFinite(args.loreCount)
        ? Math.max(0, Math.round(args.loreCount))
        : undefined;
    const now = Date.now();

    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Sector not found.");
      await ctx.db.patch(args.id, {
        name,
        description,
        loreCount,
        x: args.x,
        y: args.y,
      });
      id = args.id;
    } else {
      const slug = slugify(args.slug?.trim() || name);
      if (!slug) throw new Error("Sector slug cannot be empty.");
      // Keep slugs unique so /lore?sector= links resolve to a single sector.
      const existing = await ctx.db
        .query("sectorMap")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existing) throw new Error(`A sector with slug "${slug}" already exists.`);
      id = await ctx.db.insert("sectorMap", {
        name,
        slug,
        description,
        loreCount,
        x: args.x,
        y: args.y,
      });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "sectorMap.edit" : "sectorMap.create",
      target: `sector:${id}`,
      meta: JSON.stringify({ name, x: args.x, y: args.y }),
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const deleteSector = mutation({
  args: { id: v.id("sectorMap") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Sector not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "sectorMap.delete",
      target: `sector:${args.id}`,
      meta: JSON.stringify({ name: existing.name }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
