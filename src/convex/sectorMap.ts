import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Sector Map — the SVG galaxy map on the Lore page. Each row is a named
// sector with an (x, y) position inside the SVG viewBox, plus an optional
// lore count used for node sizing. Managed from the Operator Console
// ("Sector Map" desk); the public widget only ever reads these rows.
//
// Warp gates are operator-curated Starnet corridors between two canon
// sectors. They are stored data (not derived from sector positions), so
// the Bridge decides exactly which routes exist and can label them to
// match lore (e.g. "Vega Run"). Deleting a sector cascades: its gates
// are removed with it so the public map never shows a dangling lane.
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
    // Galaxy-region radius (viewBox units). undefined keeps the existing
    // value on edit; new sectors default on the widget side.
    r: v.optional(v.number()),
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
        ...(args.r != null ? { r: Math.max(20, Math.round(args.r)) } : {}),
      });
      id = args.id;
    } else {
      const slug = slugify(args.slug?.trim() || name);
      if (!slug) throw new Error("Sector slug cannot be empty.");
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
        ...(args.r != null ? { r: Math.max(20, Math.round(args.r)) } : {}),
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
    // Cascade: remove every gate touching this sector so no lane dangles,
    // and every boundary that uses this sector as a vertex.
    const gates = await ctx.db.query("warpGates").collect();
    for (const g of gates) {
      if (g.fromSlug === existing.slug || g.toSlug === existing.slug) {
        await ctx.db.delete(g._id);
      }
    }
    const boundaries = await ctx.db.query("mapBoundaries").collect();
    for (const b of boundaries) {
      if (b.sectorSlugs.includes(existing.slug)) {
        await ctx.db.delete(b._id);
      }
    }
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

// =========================================================================
// Warp gate CRUD
// =========================================================================

export const listGatesForOperator = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, SECTOR_CAPS);
    return await ctx.db.query("warpGates").withIndex("by_fromSlug").collect();
  },
});

export const upsertGate = mutation({
  args: {
    id: v.optional(v.id("warpGates")),
    label: v.string(),
    fromSlug: v.string(),
    toSlug: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const label = args.label.trim().slice(0, 80);
    if (!label) throw new Error("Gate label is required.");
    if (args.fromSlug === args.toSlug) {
      throw new Error("A gate cannot link a sector to itself.");
    }
    const note = (args.note ?? "").trim().slice(0, 280) || undefined;

    // Both ends must be real canon sectors.
    const from = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", args.fromSlug))
      .first();
    const to = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", args.toSlug))
      .first();
    if (!from || !to) throw new Error("Both ends of a gate must be existing sectors.");

    // Pairs are stored normalized (lesser slug first) so the same corridor
    // can't be registered twice in both directions.
    const [lo, hi] = [args.fromSlug, args.toSlug].sort();
    const normalized = `${lo}->${hi}`;
    const allGates = await ctx.db.query("warpGates").collect();
    for (const g of allGates) {
      const key = [g.fromSlug, g.toSlug].sort().join("->");
      if (key === normalized && g._id !== args.id) {
        throw new Error(`A gate linking these sectors already exists ("${g.label}").`);
      }
    }

    const now = Date.now();
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Gate not found.");
      await ctx.db.patch(args.id, { label, fromSlug: lo, toSlug: hi, note });
      id = args.id;
    } else {
      id = await ctx.db.insert("warpGates", {
        label,
        fromSlug: lo,
        toSlug: hi,
        note,
        createdAt: now,
      });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "warpGate.edit" : "warpGate.create",
      target: `gate:${id}`,
      meta: JSON.stringify({ label, route: normalized }),
      createdAt: now,
    });
    return { ok: true, id };
  },
});

// =========================================================================
// Named map boundaries — ordered polygon through canon sector slugs (e.g.
// the Orion Triangle). Deleting a sector cascades: any boundary whose vertex
// list contains it is removed with it.
// =========================================================================

export const listBoundariesForOperator = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, SECTOR_CAPS);
    return await ctx.db.query("mapBoundaries").collect();
  },
});

export const upsertBoundary = mutation({
  args: {
    id: v.optional(v.id("mapBoundaries")),
    name: v.string(),
    sectorSlugs: v.array(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Boundary name is required.");
    const slugs = [...new Set(args.sectorSlugs.map((s) => s.trim()).filter(Boolean))];
    if (slugs.length < 3) throw new Error("A boundary needs at least 3 sector systems.");
    if (slugs.length > 16) throw new Error("A boundary can span at most 16 systems.");
    // Every vertex must be a real sector.
    for (const slug of slugs) {
      const s = await ctx.db
        .query("sectorMap")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!s) throw new Error(`Unknown sector "${slug}" in the boundary.`);
    }
    const note = (args.note ?? "").trim().slice(0, 280) || undefined;
    const now = Date.now();
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Boundary not found.");
      await ctx.db.patch(args.id, { name, sectorSlugs: slugs, note });
      id = args.id;
    } else {
      id = await ctx.db.insert("mapBoundaries", { name, sectorSlugs: slugs, note, createdAt: now });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "mapBoundary.edit" : "mapBoundary.create",
      target: `boundary:${id}`,
      meta: JSON.stringify({ name, vertices: slugs.length }),
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const deleteBoundary = mutation({
  args: { id: v.id("mapBoundaries") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Boundary not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "mapBoundary.delete",
      target: `boundary:${args.id}`,
      meta: JSON.stringify({ name: existing.name }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteGate = mutation({
  args: { id: v.id("warpGates") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Gate not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "warpGate.delete",
      target: `gate:${args.id}`,
      meta: JSON.stringify({
        label: existing.label,
        route: `${existing.fromSlug}->${existing.toSlug}`,
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// =========================================================================
// Canon star systems inside sectors (sectorMap rows with kind="system",
// linked to their sector via sectorSlug). Operators add these directly —
// no Bridge review — and they render in the sector's local chart.
// =========================================================================

export const addSystem = mutation({
  args: {
    name: v.string(),
    x: v.number(),
    y: v.number(),
    sectorSlug: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const name = args.name.trim().slice(0, 60);
    if (!name) throw new Error("System name is required.");
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
      throw new Error("X and Y coordinates must be finite numbers.");
    }
    const parent = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", args.sectorSlug))
      .first();
    if (!parent) throw new Error("Parent sector not found.");

    const slug = slugify(name);
    if (!slug) throw new Error("System slug cannot be empty.");
    const existing = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new Error(`A sector or system named "${name}" already exists.`);

    const now = Date.now();
    const id = await ctx.db.insert("sectorMap", {
      name,
      slug,
      description: (args.description ?? "").trim().slice(0, 280) || undefined,
      x: args.x,
      y: args.y,
      kind: "system",
      sectorSlug: parent.slug,
    });

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "sectorMap.addSystem",
      target: `system:${id}`,
      meta: JSON.stringify({ name, sector: parent.slug, x: args.x, y: args.y }),
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const deleteSystem = mutation({
  args: { id: v.id("sectorMap") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("System not found.");
    if (existing.kind !== "system") {
      throw new Error("That row is a sector, not a system — use deleteSector.");
    }
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "sectorMap.deleteSystem",
      target: `system:${args.id}`,
      meta: JSON.stringify({ name: existing.name, sector: existing.sectorSlug }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
