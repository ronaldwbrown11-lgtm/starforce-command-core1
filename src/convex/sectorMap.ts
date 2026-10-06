import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";
import { internalMutation } from "./_generated/server";
import { LOCAL_GROUP } from "./atlasSeed";
import {
  mirrorBoundary,
  mirrorGate,
  mirrorSector,
  mirrorSystem,
  unmirrorBoundary,
  unmirrorGate,
  unmirrorSector,
  unmirrorSystem,
} from "./sectorMapMirror";

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
    const rows = await ctx.db.query("sectorMap").collect();
    // Canon systems (kind="system") are charted inside their sector's local
    // view, not from this console list — hide them here so they can never be
    // edited (or repositioned/deleted) as if they were sectors.
    return rows.filter((r) => r.kind !== "system");
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
    let sectorSlug: string;
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
      sectorSlug = existing.slug;
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
      sectorSlug = slug;
    }

    // Mirror into the native Star Atlas so the new /map app shows this
    // sector (and it becomes claimable/chartable there).
    await mirrorSector(ctx, me, {
      name,
      slug: sectorSlug,
      description,
      x: args.x,
      y: args.y,
    });

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
        // The whole boundary is gone, so drop its entire mirrored ring —
        // otherwise the segments between the surviving vertices linger as a
        // ghost partial polygon on the native atlas.
        await unmirrorBoundary(ctx, b._id);
      }
    }
    await ctx.db.delete(args.id);
    await unmirrorSector(ctx, existing.slug);
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

    // Mirror the corridor into the native atlas as a warp lane.
    await mirrorGate(ctx, me, { id, label, fromSlug: lo, toSlug: hi });

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
    // Mirror the boundary as a closed ring of native lanes.
    await mirrorBoundary(ctx, me, { id, name, sectorSlugs: slugs });

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
    await unmirrorBoundary(ctx, args.id);
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
    await unmirrorGate(ctx, args.id);
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

// Operator: move a sector (and every canon system inside it, so the local
// chart's arrangement stays intact) to a new galaxy position. Used by
// drag-to-reposition on the atlas.
export const moveSector = mutation({
  args: { id: v.id("sectorMap"), x: v.number(), y: v.number() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
      throw new Error("Coordinates must be finite numbers.");
    }
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Sector not found.");
    if (existing.kind === "system") {
      throw new Error("That row is a system, not a sector — systems move with their sector.");
    }
    const dx = args.x - existing.x;
    const dy = args.y - existing.y;
    await ctx.db.patch(args.id, { x: args.x, y: args.y });
    const children = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug")
      .collect();
    for (const c of children) {
      if (c.kind === "system" && c.sectorSlug === existing.slug) {
        await ctx.db.patch(c._id, { x: c.x + dx, y: c.y + dy });
      }
    }
    // Keep the native mirror's positions in step with the moved sector.
    await mirrorSector(ctx, me, {
      name: existing.name,
      slug: existing.slug,
      description: existing.description,
      x: args.x,
      y: args.y,
    });
    for (const c of children) {
      if (c.kind === "system" && c.sectorSlug === existing.slug) {
        await mirrorSystem(ctx, me, {
          name: c.name,
          slug: c.slug,
          description: c.description,
          x: c.x + dx,
          y: c.y + dy,
          distLy: c.distLy,
          sectorSlug: existing.slug,
        });
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "sectorMap.move",
      target: `sector:${args.id}`,
      meta: JSON.stringify({ name: existing.name, x: args.x, y: args.y }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const addSystem = mutation({
  args: {
    name: v.string(),
    x: v.number(),
    y: v.number(),
    sectorSlug: v.string(),
    description: v.optional(v.string()),
    // Real-catalog star: light-years from Sol, shown in its label.
    distLy: v.optional(v.number()),
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
    const description = (args.description ?? "").trim().slice(0, 280) || undefined;
    const distLy = args.distLy != null ? Math.max(0, args.distLy) : undefined;
    const id = await ctx.db.insert("sectorMap", {
      name,
      slug,
      description,
      x: args.x,
      y: args.y,
      kind: "system",
      sectorSlug: parent.slug,
      // Real-star seeding: optional catalog star, rendered as its own system
      // node with the catalog distance in its tooltip.
      distLy,
    });

    // Mirror the system into the native atlas so it charts in the new app.
    await mirrorSystem(ctx, me, {
      name,
      slug,
      description,
      x: args.x,
      y: args.y,
      distLy,
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

/**
 * Internal, idempotent Sol-sector seeding — the real local group. Runs once
 * at first use so Sol's chart always carries the actual stellar neighbourhood
 * (Sol, Centauri, Sirius, Tau Ceti, 47 Ursae Majoris, …) without any manual
 * operator step. Safe to call repeatedly; skips names that already exist.
 */
export const ensureSolSeed = internalMutation({
  args: {},
  handler: async (ctx) => {
    let sector = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", "sol-sector"))
      .unique();
    if (!sector) {
      await ctx.db.insert("sectorMap", {
        name: "Sol Sector",
        slug: "sol-sector",
        x: 500,
        y: 420,
        r: 96,
        description:
          "Birth sector of humanity and cradle of Star Force — the real stellar neighbourhood within 50 light-years of Earth.",
      });
      sector = await ctx.db
        .query("sectorMap")
        .withIndex("by_slug", (q) => q.eq("slug", "sol-sector"))
        .unique();
    }
    if (!sector) return { seeded: 0 };
    const existing = await ctx.db
      .query("sectorMap")
      .withIndex("by_sector", (q) => q.eq("sectorSlug", sector!.slug))
      .collect();
    const taken = new Set(existing.map((e) => e.name));
    let added = 0;
    for (const star of LOCAL_GROUP) {
      if (taken.has(star.name)) continue;
      await ctx.db.insert("sectorMap", {
        name: star.name.slice(0, 60),
        slug: `sol-sector:${slugifyName(star.name)}`.slice(0, 80),
        x: sector.x + star.x,
        y: sector.y + star.y,
        kind: "system",
        sectorSlug: sector.slug,
        description: `Catalog star, ${star.distLy.toFixed(2)} ly from Sol.`,
        distLy: star.distLy,
      });
      added++;
    }
    return { seeded: added };
  },
});

function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

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
    await unmirrorSystem(ctx, existing.slug);
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

/**
 * Reconcile the whole console desk into the native Star Atlas. Idempotent:
 * every console sector / system / gate / boundary is mirrored (upserted by
 * its `console:` sourceKey), so running it repeatedly never duplicates. Used
 * to publish rows authored before the write-through mirror existed, and to
 * push real-catalog star seeds (which write sectorMap rows directly).
 */
export const syncAllToAtlas = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, SECTOR_CAPS);
    const rows = await ctx.db.query("sectorMap").collect();
    const sectors = rows.filter((r) => r.kind !== "system");
    const systems = rows.filter((r) => r.kind === "system" && r.sectorSlug);
    const gates = await ctx.db.query("warpGates").collect();
    const boundaries = await ctx.db.query("mapBoundaries").collect();

    let sectorCount = 0;
    for (const row of sectors) {
      await mirrorSector(ctx, me, {
        name: row.name,
        slug: row.slug,
        description: row.description,
        x: row.x,
        y: row.y,
      });
      sectorCount++;
    }
    let systemCount = 0;
    for (const row of systems) {
      const id = await mirrorSystem(ctx, me, {
        name: row.name,
        slug: row.slug,
        description: row.description,
        x: row.x,
        y: row.y,
        distLy: row.distLy,
        sectorSlug: row.sectorSlug!,
      });
      if (id) systemCount++;
    }
    let laneCount = 0;
    for (const gate of gates) {
      const id = await mirrorGate(ctx, me, {
        id: gate._id,
        label: gate.label,
        fromSlug: gate.fromSlug,
        toSlug: gate.toSlug,
      });
      if (id) laneCount++;
    }
    for (const boundary of boundaries) {
      laneCount += await mirrorBoundary(ctx, me, {
        id: boundary._id,
        name: boundary.name,
        sectorSlugs: boundary.sectorSlugs,
      });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "sectorMap.syncAtlas",
      target: "atlas:mirror",
      meta: JSON.stringify({
        sectors: sectorCount,
        systems: systemCount,
        lanes: laneCount,
      }),
      createdAt: Date.now(),
    });
    return {
      ok: true,
      sectors: sectorCount,
      systems: systemCount,
      lanes: laneCount,
    };
  },
});
