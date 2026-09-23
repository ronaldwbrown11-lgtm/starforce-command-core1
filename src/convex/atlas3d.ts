import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// 3D Star Atlas backend. All spatial data lives in the atlas* tables —
// nothing is hard-coded in the scene. The frontend loads one snapshot and
// renders; every edit goes through these mutations so the map is dynamic.
// =========================================================================

const ATLAS_CAPS = ["operator", "senior_operator", "lore_archivist"];

const vec = v.object({ x: v.number(), y: v.number(), z: v.number() });

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------
// Snapshot — one call loads the whole atlas (used by the /map 3D view).
// ---------------------------------------------------------------------

export const loadAtlasSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const [quadrants, sectors, systems, gates, lanes] = await Promise.all([
      ctx.db.query("atlasQuadrants").collect(),
      ctx.db.query("atlasSectors").collect(),
      ctx.db.query("atlasSystems").collect(),
      ctx.db.query("atlasGates").collect(),
      ctx.db.query("atlasLanes").collect(),
    ]);
    return {
      quadrants: quadrants.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      sectors,
      systems,
      gates,
      lanes,
    };
  },
});

export const listSubmissions = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    const user = await ctx.db.get(me);
    const isOperator =
      !!user && (user.role === "admin" || ATLAS_CAPS.includes(String(user.opRole ?? "")));
    // Operators see every submission; members see their own.
    if (isOperator) {
      const rows = args.status
        ? await ctx.db
            .query("atlasSubmissions")
            .withIndex("by_status", (q) => q.eq("status", args.status!))
            .collect()
        : await ctx.db.query("atlasSubmissions").collect();
      return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
    }
    const mine = await ctx.db
      .query("atlasSubmissions")
      .withIndex("by_author", (q) => q.eq("authorId", me))
      .collect();
    return mine
      .filter((r) => (args.status ? r.status === args.status : true))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 100);
  },
});

// ---------------------------------------------------------------------
// Member submissions (mission / contest / freehand)
// ---------------------------------------------------------------------

export const submitNewSystem = mutation({
  args: {
    name: v.string(),
    sectorKey: v.string(),
    x: v.number(),
    y: v.number(),
    z: v.number(),
    faction: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    source: v.union(v.literal("mission"), v.literal("contest"), v.literal("freehand")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in to chart a new system.");

    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("System name is required.");
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y) || !Number.isFinite(args.z)) {
      throw new Error("Coordinates must be finite numbers.");
    }

    const key = slugify(name);
    const existingSystem = await ctx.db
      .query("atlasSystems")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existingSystem) throw new Error(`A system named \"${name}\" is already charted.`);

    // Duplicate-guard: same member may not flood the queue with the same name.
    const mine = await ctx.db
      .query("atlasSubmissions")
      .withIndex("by_author", (q) => q.eq("authorId", me))
      .collect();
    if (mine.some((m) => m.status === "proposed" && JSON.parse(m.payload).name === name)) {
      throw new Error(`You already have a proposal for \"${name}\" awaiting review.`);
    }

    const now = Date.now();
    await ctx.db.insert("atlasSubmissions", {
      authorId: me,
      source: args.source,
      status: "proposed",
      payload: JSON.stringify({
        name,
        sectorKey: args.sectorKey,
        x: args.x,
        y: args.y,
        z: args.z,
        faction: args.faction?.trim() || undefined,
        tags: (args.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
        notes: args.notes?.trim().slice(0, 1000) || undefined,
      }),
      createdAt: now,
    });
    return { ok: true };
  },
});

export const approveSubmission = mutation({
  args: { id: v.id("atlasSubmissions"), reviewNote: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Submission not found.");
    if (row.status !== "proposed") throw new Error("Submission already reviewed.");

    const p = JSON.parse(row.payload) as {
      name: string;
      sectorKey: string;
      x: number;
      y: number;
      z: number;
      faction?: string;
      tags?: string[];
      notes?: string;
    };
    const key = slugify(p.name);
    const clash = await ctx.db
      .query("atlasSystems")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (clash) throw new Error(`A system keyed \"${key}\" already exists.`);

    await ctx.db.insert("atlasSystems", {
      key,
      name: p.name,
      sectorKey: p.sectorKey,
      x: p.x,
      y: p.y,
      z: p.z,
      isRealStar: false,
      status: "canon",
      faction: p.faction,
      tags: p.tags,
      notes: p.notes,
    });
    await ctx.db.patch(args.id, {
      status: "approved",
      reviewedAt: Date.now(),
      reviewerId: me,
      reviewNote: args.reviewNote?.trim().slice(0, 500) || undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "atlas3d.approveSubmission",
      target: `atlasSystem:${key}`,
      meta: JSON.stringify({ name: p.name, sector: p.sectorKey }),
      createdAt: Date.now(),
    });
    return { ok: true, key };
  },
});

export const rejectSubmission = mutation({
  args: { id: v.id("atlasSubmissions"), reviewNote: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Submission not found.");
    if (row.status !== "proposed") throw new Error("Submission already reviewed.");
    await ctx.db.patch(args.id, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewerId: me,
      reviewNote: args.reviewNote?.trim().slice(0, 500) || undefined,
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------
// Quadrant CRUD (operator)
// ---------------------------------------------------------------------

const bounds = {
  minX: v.number(),
  maxX: v.number(),
  minY: v.number(),
  maxY: v.number(),
  minZ: v.number(),
  maxZ: v.number(),
};

export const upsertQuadrant = mutation({
  args: {
    key: v.optional(v.string()),
    name: v.string(),
    color: v.string(),
    ...bounds,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Quadrant name is required.");
    const color = /^#[0-9a-fA-F]{6}$/.test(args.color) ? args.color : "#3366ff";
    const count = await ctx.db.query("atlasQuadrants").collect();
    const existing = args.key
      ? await ctx.db.query("atlasQuadrants").withIndex("by_key", (q) => q.eq("key", args.key!)).first()
      : undefined;
    if (args.key && !existing) throw new Error("Quadrant not found.");
    const key = existing ? existing.key : args.key || slugify(name) || `quadrant-${count.length + 1}`;
    const dup = await ctx.db.query("atlasQuadrants").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (dup && dup.key !== existing?.key) throw new Error(`Quadrant key \"${key}\" is taken.`);
    const data = { ...args, key, name, color, order: existing?.order ?? count.length };
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("atlasQuadrants", data);
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: existing ? "atlas3d.quadrant.edit" : "atlas3d.quadrant.create",
      target: `atlasQuadrant:${key}`,
      createdAt: Date.now(),
    });
    return { ok: true, key };
  },
});

export const deleteQuadrant = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const q = await ctx.db.query("atlasQuadrants").withIndex("by_key", (x) => x.eq("key", args.key)).first();
    if (!q) throw new Error("Quadrant not found.");
    // Cascade: sectors inside, systems inside those sectors, gates anchored here.
    const sectors = await ctx.db
      .query("atlasSectors")
      .withIndex("by_quadrant", (x) => x.eq("quadrantKey", args.key))
      .collect();
    for (const s of sectors) {
      const systems = await ctx.db
        .query("atlasSystems")
        .withIndex("by_sector", (x) => x.eq("sectorKey", s.key))
        .collect();
      for (const sys of systems) await ctx.db.delete(sys._id);
      await ctx.db.delete(s._id);
    }
    const gates = await ctx.db.query("atlasGates").collect();
    for (const g of gates) {
      if (g.quadrantKey === args.key || (g.sectorKey && sectors.some((s) => s.key === g.sectorKey))) {
        await ctx.db.delete(g._id);
      }
    }
    await ctx.db.delete(q._id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "atlas3d.quadrant.delete",
      target: `atlasQuadrant:${args.key}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------
// Sector CRUD (operator)
// ---------------------------------------------------------------------

export const upsertSector = mutation({
  args: {
    key: v.optional(v.string()),
    name: v.string(),
    quadrantKey: v.string(),
    color: v.string(),
    status: v.union(v.literal("canon"), v.literal("proposed")),
    description: v.optional(v.string()),
    ...bounds,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("Sector name is required.");
    const parent = await ctx.db
      .query("atlasQuadrants")
      .withIndex("by_key", (q) => q.eq("key", args.quadrantKey))
      .first();
    if (!parent) throw new Error("Parent quadrant not found.");
    const color = /^#[0-9a-fA-F]{6}$/.test(args.color) ? args.color : "#4da6ff";
    const existing = args.key
      ? await ctx.db.query("atlasSectors").withIndex("by_key", (q) => q.eq("key", args.key!)).first()
      : undefined;
    if (args.key && !existing) throw new Error("Sector not found.");
    const key = existing ? existing.key : slugify(name);
    const dup = await ctx.db.query("atlasSectors").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (dup && dup.key !== existing?.key) throw new Error(`Sector key \"${key}\" is taken.`);
    const data = {
      key,
      name,
      quadrantKey: parent.key,
      color,
      status: args.status,
      description: args.description?.trim().slice(0, 500) || undefined,
      minX: args.minX,
      maxX: args.maxX,
      minY: args.minY,
      maxY: args.maxY,
      minZ: args.minZ,
      maxZ: args.maxZ,
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("atlasSectors", data);
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: existing ? "atlas3d.sector.edit" : "atlas3d.sector.create",
      target: `atlasSector:${key}`,
      createdAt: Date.now(),
    });
    return { ok: true, key };
  },
});

export const deleteSector = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const s = await ctx.db.query("atlasSectors").withIndex("by_key", (x) => x.eq("key", args.key)).first();
    if (!s) throw new Error("Sector not found.");
    const systems = await ctx.db
      .query("atlasSystems")
      .withIndex("by_sector", (x) => x.eq("sectorKey", args.key))
      .collect();
    for (const sys of systems) await ctx.db.delete(sys._id);
    const gates = await ctx.db.query("atlasGates").collect();
    for (const g of gates) {
      if (g.sectorKey === args.key) await ctx.db.delete(g._id);
    }
    const lanes = await ctx.db.query("atlasLanes").collect();
    const gone = new Set(systems.map((y) => y.key));
    for (const l of lanes) {
      if (gone.has(l.fromKey) || gone.has(l.toKey)) await ctx.db.delete(l._id);
    }
    await ctx.db.delete(s._id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "atlas3d.sector.delete",
      target: `atlasSector:${args.key}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------
// System CRUD (operator)
// ---------------------------------------------------------------------

export const upsertSystem = mutation({
  args: {
    key: v.optional(v.string()),
    name: v.string(),
    sectorKey: v.string(), // "" = galaxy-level real-star anchor
    x: v.number(),
    y: v.number(),
    z: v.number(),
    isRealStar: v.optional(v.boolean()),
    status: v.union(v.literal("canon"), v.literal("proposed")),
    faction: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const name = args.name.trim().slice(0, 80);
    if (!name) throw new Error("System name is required.");
    if (!Number.isFinite(args.x) || !Number.isFinite(args.y) || !Number.isFinite(args.z)) {
      throw new Error("Coordinates must be finite numbers.");
    }
    if (args.sectorKey) {
      const parent = await ctx.db
        .query("atlasSectors")
        .withIndex("by_key", (q) => q.eq("key", args.sectorKey))
        .first();
      if (!parent) throw new Error("Parent sector not found.");
    }
    const existing = args.key
      ? await ctx.db.query("atlasSystems").withIndex("by_key", (q) => q.eq("key", args.key!)).first()
      : undefined;
    if (args.key && !existing) throw new Error("System not found.");
    const key = existing ? existing.key : slugify(name);
    const dup = await ctx.db.query("atlasSystems").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (dup && dup.key !== existing?.key) throw new Error(`System key \"${key}\" is taken.`);
    const data = {
      key,
      name,
      sectorKey: args.sectorKey,
      x: args.x,
      y: args.y,
      z: args.z,
      isRealStar: args.isRealStar ?? false,
      status: args.status,
      faction: args.faction?.trim() || undefined,
      tags: (args.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 8),
      notes: args.notes?.trim().slice(0, 1000) || undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("atlasSystems", data);
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: existing ? "atlas3d.system.edit" : "atlas3d.system.create",
      target: `atlasSystem:${key}`,
      meta: JSON.stringify({ name, sector: args.sectorKey || "galaxy" }),
      createdAt: Date.now(),
    });
    return { ok: true, key };
  },
});

export const deleteSystem = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const s = await ctx.db.query("atlasSystems").withIndex("by_key", (x) => x.eq("key", args.key)).first();
    if (!s) throw new Error("System not found.");
    const lanes = await ctx.db.query("atlasLanes").collect();
    for (const l of lanes) {
      if (l.fromKey === args.key || l.toKey === args.key) await ctx.db.delete(l._id);
    }
    const gates = await ctx.db.query("atlasGates").collect();
    for (const g of gates) {
      if (g.systemKey === args.key) await ctx.db.delete(g._id);
    }
    await ctx.db.delete(s._id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "atlas3d.system.delete",
      target: `atlasSystem:${args.key}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const moveSystem = mutation({
  args: { key: v.string(), pos: vec },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const s = await ctx.db.query("atlasSystems").withIndex("by_key", (x) => x.eq("key", args.key)).first();
    if (!s) throw new Error("System not found.");
    await ctx.db.patch(s._id, { x: args.pos.x, y: args.pos.y, z: args.pos.z });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------
// Warp-gate CRUD (operator)
// ---------------------------------------------------------------------

export const upsertGate = mutation({
  args: {
    key: v.optional(v.string()),
    label: v.optional(v.string()),
    level: v.union(v.literal("galaxy"), v.literal("quadrant"), v.literal("sector"), v.literal("system")),
    quadrantKey: v.optional(v.string()),
    sectorKey: v.optional(v.string()),
    systemKey: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    z: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    const existing = args.key
      ? await ctx.db.query("atlasGates").withIndex("by_key", (q) => q.eq("key", args.key!)).first()
      : undefined;
    if (args.key && !existing) throw new Error("Gate not found.");
    const key = existing ? existing.key : slugify(args.label ?? "") || `gate-${Date.now()}`;
    const data = {
      key,
      label: args.label?.trim().slice(0, 80) || undefined,
      level: args.level,
      quadrantKey: args.quadrantKey,
      sectorKey: args.sectorKey,
      systemKey: args.systemKey,
      x: args.x,
      y: args.y,
      z: args.z,
      status: args.status ?? "active",
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("atlasGates", data);
    }
    return { ok: true, key };
  },
});

export const deleteGate = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_CAPS);
    const g = await ctx.db.query("atlasGates").withIndex("by_key", (x) => x.eq("key", args.key)).first();
    if (!g) throw new Error("Gate not found.");
    await ctx.db.delete(g._id);
    return { ok: true };
  },
});

// ---------------------------------------------------------------------
// Transit-lane CRUD (operator)
// ---------------------------------------------------------------------

export const upsertLane = mutation({
  args: {
    key: v.optional(v.string()),
    fromKey: v.string(),
    toKey: v.string(),
    type: v.union(v.literal("warp"), v.literal("jump"), v.literal("trade"), v.literal("hazard")),
    risk: v.union(v.literal("Low"), v.literal("Medium"), v.literal("High"), v.literal("Forbidden")),
    factionControl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_CAPS);
    if (args.fromKey === args.toKey) throw new Error("A lane cannot link a system to itself.");
    const from = await ctx.db.query("atlasSystems").withIndex("by_key", (q) => q.eq("key", args.fromKey)).first();
    const to = await ctx.db.query("atlasSystems").withIndex("by_key", (q) => q.eq("key", args.toKey)).first();
    if (!from || !to) throw new Error("Both lane endpoints must be charted systems.");
    const existing = args.key
      ? await ctx.db.query("atlasLanes").withIndex("by_key", (q) => q.eq("key", args.key!)).first()
      : undefined;
    if (args.key && !existing) throw new Error("Lane not found.");
    const key = existing ? existing.key : `lane-${slugify(`${args.fromKey}-${args.toKey}`)}`;
    const dup = await ctx.db.query("atlasLanes").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (dup && dup.key !== existing?.key) throw new Error(`Lane key \"${key}\" is taken.`);
    const data = {
      key,
      fromKey: args.fromKey,
      toKey: args.toKey,
      type: args.type,
      risk: args.risk,
      factionControl: args.factionControl?.trim() || undefined,
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("atlasLanes", data);
    }
    return { ok: true, key };
  },
});

export const deleteLane = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_CAPS);
    const l = await ctx.db.query("atlasLanes").withIndex("by_key", (x) => x.eq("key", args.key)).first();
    if (!l) throw new Error("Lane not found.");
    await ctx.db.delete(l._id);
    return { ok: true };
  },
});

// ---------------------------------------------------------------------
// Seed — idempotent; inserts the spec's canon layout on first use.
// ---------------------------------------------------------------------

type SeedStarSpec = { key: string; name: string; x: number; y: number; z: number };

/** Real catalog anchors spread across the whole galaxy (spec + famous stars). */
export const SEED_REAL_STARS: SeedStarSpec[] = [
  { key: "sol", name: "Sol", x: 0, y: 0, z: 0 },
  { key: "proxima", name: "Proxima Centauri", x: 12, y: -3, z: 5 },
  { key: "alpha-centauri", name: "Alpha Centauri", x: 13, y: -2, z: 4 },
  { key: "sirius", name: "Sirius", x: -22, y: 8, z: -3 },
  { key: "tau-ceti", name: "Tau Ceti", x: 5, y: -15, z: 2 },
  { key: "deneb", name: "Deneb", x: 18000, y: 4000, z: 1200 },
  { key: "vega", name: "Vega", x: 7500, y: 1200, z: 300 },
  { key: "betelgeuse", name: "Betelgeuse", x: -9000, y: 6000, z: 800 },
  { key: "rigel", name: "Rigel", x: -9500, y: 5800, z: 700 },
  { key: "aldebaran", name: "Aldebaran", x: 6500, y: -2200, z: 180 },
  { key: "antares", name: "Antares", x: -5500, y: -4800, z: -300 },
  { key: "spica", name: "Spica", x: 8200, y: -3200, z: -150 },
  { key: "polaris", name: "Polaris", x: 4300, y: 9700, z: 400 },
  { key: "arcturus", name: "Arcturus", x: 3700, y: -5300, z: -50 },
  { key: "canopus", name: "Canopus", x: 3100, y: -10200, z: -90 },
  { key: "achernar", name: "Achernar", x: -1400, y: -12200, z: 100 },
  { key: "fomalhaut", name: "Fomalhaut", x: 7400, y: -8800, z: -60 },
  { key: "regulus", name: "Regulus", x: 7900, y: 1900, z: 120 },
  { key: "castor", name: "Castor", x: 4900, y: 2900, z: 210 },
  { key: "pollux", name: "Pollux", x: 4100, y: 3400, z: 190 },
  { key: "altair", name: "Altair", x: 5000, y: 1600, z: -140 },
  { key: "bellatrix", name: "Bellatrix", x: -8400, y: 5200, z: 700 },
  { key: "alnitak", name: "Alnitak", x: -9200, y: -5600, z: 750 },
  { key: "alnilam", name: "Alnilam", x: -9400, y: -5900, z: 720 },
  { key: "saiph", name: "Saiph", x: -9700, y: -6100, z: 680 },
  { key: "mira", name: "Mira", x: 9500, y: 4200, z: -180 },
  { key: "aldebaran-sector-anchor", name: "Hyades Anchor", x: 6700, y: -2400, z: 150 },
  { key: "wolf-359", name: "Wolf 359", x: 7, y: 6, z: -4 },
  { key: "barnards-star", name: "Barnard's Star", x: -6, y: 8, z: 3 },
  { key: "trappist-1", name: "TRAPPIST-1", x: 11, y: 10, z: -6 },
  { key: "kepler-452", name: "Kepler-452", x: 16000, y: -4200, z: 500 },
  { key: "proxima-b-anchor", name: "Ross 128", x: 10, y: 9, z: -2 },
  // Alliance capital in the lore — real G1V catalog star, ~46 ly from Sol.
  { key: "47-ursae-majoris", name: "47 Ursae Majoris", x: 4500, y: 6200, z: 300 },
  { key: "epsilon-eridani", name: "Epsilon Eridani", x: 3000, y: -1200, z: -100 },
];

const QUADRANT_SEED = [
  {
    key: "Quadrant-Alpha",
    name: "Quadrant Alpha",
    color: "#3366ff",
    minX: -50000,
    maxX: 0,
    minY: -50000,
    maxY: 0,
    minZ: -2000,
    maxZ: 2000,
  },
  {
    key: "Quadrant-Beta",
    name: "Quadrant Beta",
    color: "#33cc33",
    minX: 0,
    maxX: 50000,
    minY: -50000,
    maxY: 0,
    minZ: -2000,
    maxZ: 2000,
  },
  {
    key: "Quadrant-Gamma",
    name: "Quadrant Gamma",
    color: "#ff9933",
    minX: -50000,
    maxX: 0,
    minY: 0,
    maxY: 50000,
    minZ: -2000,
    maxZ: 2000,
  },
  {
    key: "Quadrant-Delta",
    name: "Quadrant Delta",
    color: "#cc33ff",
    minX: 0,
    maxX: 50000,
    minY: 0,
    maxY: 50000,
    minZ: -2000,
    maxZ: 2000,
  },
];

const SECTOR_SEED = [
  {
    key: "Terran-Reach",
    name: "Terran Reach",
    quadrantKey: "Quadrant-Alpha",
    color: "#4da6ff",
    status: "canon",
    description: "Cradle of Star Force — the human heart of the Orion Triangle.",
    minX: -500,
    maxX: 500,
    minY: -500,
    maxY: 500,
    minZ: -200,
    maxZ: 200,
  },
  {
    key: "Outer-Belt",
    name: "Outer Belt",
    quadrantKey: "Quadrant-Alpha",
    color: "#ffcc00",
    status: "canon",
    description: "Resource frontier past the Terran corridor — mining claims and rogue signals.",
    minX: 2000,
    maxX: 6000,
    minY: -3000,
    maxY: 3000,
    minZ: -500,
    maxZ: 500,
  },
  {
    key: "Void-Reaches",
    name: "Void Reaches",
    quadrantKey: "Quadrant-Beta",
    color: "#ff6666",
    status: "proposed",
    description: "Unsurveyed dark between the arms. Proposed sector, pending the Bridge.",
    minX: -15000,
    maxX: -8000,
    minY: 5000,
    maxY: 12000,
    minZ: -1000,
    maxZ: 1000,
  },
];

const SYSTEM_SEED = [
  {
    key: "sirius-gate",
    name: "Sirius Gate",
    sectorKey: "Terran-Reach",
    x: -20,
    y: 7,
    z: -3,
    isRealStar: false,
    status: "canon",
    faction: "Star Force",
    tags: ["jump-hub", "strategic"],
  },
  {
    key: "sol-home", // system-level canon chart inside Terran Reach (distinct from the galaxy anchor)
    name: "Sol",
    sectorKey: "Terran-Reach",
    x: 0,
    y: 0,
    z: 0,
    isRealStar: true,
    status: "canon",
    faction: "Star Force",
    tags: ["homeworld"],
  },
  {
    key: "proxima-outpost",
    name: "Proxima Outpost",
    sectorKey: "Terran-Reach",
    x: 12,
    y: -3,
    z: 5,
    isRealStar: false,
    status: "canon",
    faction: "Star Force",
    tags: ["frontier"],
  },
  {
    key: "tau-ceti-colony",
    name: "Tau Ceti Colony",
    sectorKey: "Terran-Reach",
    x: 5,
    y: -15,
    z: 2,
    isRealStar: false,
    status: "proposed",
    faction: "Starforge Union",
    tags: ["colony"],
  },
  {
    key: "kepler-mining",
    name: "Kepler Mining Claim",
    sectorKey: "Outer-Belt",
    x: 4000,
    y: -1200,
    z: 100,
    isRealStar: false,
    status: "canon",
    faction: "G.I.A.",
    tags: ["mining", "contested"],
  },
  {
    key: "void-listener",
    name: "Void Listening Post",
    sectorKey: "Void-Reaches",
    x: -11000,
    y: 8000,
    z: 200,
    isRealStar: false,
    status: "proposed",
    faction: "G.I.A.",
    tags: ["signal", "classified"],
  },
];

const GATE_SEED = [
  {
    key: "wg-sirius-1",
    label: "Sirius Gate Alpha",
    level: "sector",
    sectorKey: "Terran-Reach",
    x: -18,
    y: 7,
    z: -3,
    status: "active",
  },
  {
    key: "wg-galaxy-core",
    label: "Galactic Core Gate",
    level: "galaxy",
    x: 0,
    y: 0,
    z: 0,
    status: "active",
  },
  {
    key: "wg-uma-capital",
    label: "47 Uma Alliance Gate",
    level: "quadrant",
    quadrantKey: "Quadrant-Delta",
    x: 4500,
    y: 6200,
    z: 300,
    status: "active",
  },
];

const LANE_SEED = [
  {
    key: "lane-sol-uma",
    fromKey: "sol-home",
    toKey: "47-ursae-majoris",
    type: "warp",
    risk: "Low",
    factionControl: "Star Force",
  },
  {
    key: "lane-sirius-sol",
    fromKey: "sirius-gate",
    toKey: "sol-home",
    type: "warp",
    risk: "Low",
    factionControl: "Star Force",
  },
  {
    key: "lane-sol-proxima",
    fromKey: "sol-home",
    toKey: "proxima-outpost",
    type: "trade",
    risk: "Low",
    factionControl: "Star Force",
  },
  {
    key: "lane-proxima-tau",
    fromKey: "proxima-outpost",
    toKey: "tau-ceti-colony",
    type: "jump",
    risk: "Medium",
    factionControl: undefined as string | undefined,
  },
  {
    key: "lane-kepler-void",
    fromKey: "kepler-mining",
    toKey: "void-listener",
    type: "hazard",
    risk: "High",
    factionControl: "G.I.A.",
  },
];

export const seedAtlas = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, ATLAS_CAPS);
    let added = 0;

    // Quadrants — insert only if the whole atlas is empty (idempotent).
    const existingQuads = await ctx.db.query("atlasQuadrants").collect();
    if (existingQuads.length === 0) {
      for (const [i, q] of QUADRANT_SEED.entries()) {
        await ctx.db.insert("atlasQuadrants", { ...q, order: i });
        added++;
      }
    }

    const existingSectors = await ctx.db.query("atlasSectors").collect();
    const takenSectors = new Set(existingSectors.map((s) => s.key));
    for (const s of SECTOR_SEED) {
      if (takenSectors.has(s.key)) continue;
      await ctx.db.insert("atlasSectors", s);
      added++;
    }

    // Real-star galaxy anchors.
    const existingSystems = await ctx.db.query("atlasSystems").collect();
    const takenSystems = new Set(existingSystems.map((s) => s.key));
    for (const star of SEED_REAL_STARS) {
      if (takenSystems.has(star.key)) continue;
      await ctx.db.insert("atlasSystems", {
        key: star.key,
        name: star.name,
        sectorKey: "", // galaxy-level anchor
        x: star.x,
        y: star.y,
        z: star.z,
        isRealStar: true,
        status: "canon",
      });
      added++;
    }

    // Canon systems + lanes.
    const seededSystems = new Set(takenSystems);
    for (const s of SYSTEM_SEED) {
      if (seededSystems.has(s.key)) continue;
      await ctx.db.insert("atlasSystems", { ...s, tags: s.tags });
      seededSystems.add(s.key);
      added++;
    }
    const existingLanes = await ctx.db.query("atlasLanes").collect();
    const takenLanes = new Set(existingLanes.map((l) => l.key));
    for (const l of LANE_SEED) {
      if (takenLanes.has(l.key)) continue;
      // Endpoints must exist — either already in the DB or just seeded above
      // (a fresh install previously skipped every lane because the check ran
      // against only the pre-seed set).
      if (!seededSystems.has(l.fromKey) || !seededSystems.has(l.toKey)) continue;
      await ctx.db.insert("atlasLanes", { ...l, factionControl: l.factionControl });
      added++;
    }

    const existingGates = await ctx.db.query("atlasGates").collect();
    const takenGates = new Set(existingGates.map((g) => g.key));
    for (const g of GATE_SEED) {
      if (takenGates.has(g.key)) continue;
      await ctx.db.insert("atlasGates", g);
      added++;
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "atlas3d.seed",
      target: "atlas",
      meta: JSON.stringify({ added }),
      createdAt: Date.now(),
    });
    return { ok: true, added };
  },
});
