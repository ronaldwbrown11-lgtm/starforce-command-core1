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

type SeedStarSpec = { key: string; name: string; distLy: number; l: number; b: number };

// ---------------------------------------------------------------------------
// Galaxy-true coordinates. The canonical frame is centered on the galactic
// core: the disk plane spans x/z ±50,000 (1 unit = 1 light-year) and y is
// height above/below the plane. Sol sits ~26,000 ly out on the Orion Spur —
// between the Sagittarius and Perseus arms, ~52% of the way to the rim —
// NOT at the core. Every seeded anchor is placed from its real catalog
// distance and galactic direction relative to Sol:
//
//   l = galactic longitude (0° → toward the core, 90° → direction of spin)
//   b = galactic latitude (+ = above the disk plane)
//
// Near stars (≤15 ly) cluster tightly around Sol — at galaxy zoom they read
// as the Sol marker on the arm; drilling in spreads them via the level frame.
// ---------------------------------------------------------------------------

export const SOL_POSITION = { x: 26000, y: 60, z: 2500 };

function galacticToAtlas(star: { distLy: number; l: number; b: number }) {
  const l = (star.l * Math.PI) / 180;
  const b = (star.b * Math.PI) / 180;
  return {
    x: SOL_POSITION.x - star.distLy * Math.cos(b) * Math.cos(l),
    y: SOL_POSITION.y + star.distLy * Math.sin(b),
    z: SOL_POSITION.z + star.distLy * Math.cos(b) * Math.sin(l),
  };
}

/** Real catalog anchors at true distances/bearings from Sol (spec + famous stars). */
export const SEED_REAL_STARS: SeedStarSpec[] = [
  { key: "sol", name: "Sol", distLy: 0, l: 0, b: 0 },
  { key: "proxima", name: "Proxima Centauri", distLy: 4.246, l: 314, b: -0.7 },
  { key: "alpha-centauri", name: "Alpha Centauri", distLy: 4.365, l: 314, b: -0.7 },
  { key: "sirius", name: "Sirius", distLy: 8.6, l: 227.2, b: -8.9 },
  { key: "tau-ceti", name: "Tau Ceti", distLy: 11.9, l: 173.1, b: -73.4 },
  { key: "deneb", name: "Deneb", distLy: 2616, l: 84, b: 1.7 },
  { key: "vega", name: "Vega", distLy: 25, l: 67.1, b: 19.3 },
  { key: "betelgeuse", name: "Betelgeuse", distLy: 548, l: 199.8, b: -8.9 },
  { key: "rigel", name: "Rigel", distLy: 863, l: 220.3, b: -9.2 },
  { key: "aldebaran", name: "Aldebaran", distLy: 65.3, l: 174, b: -20.1 },
  { key: "antares", name: "Antares", distLy: 554, l: 351.5, b: 15 },
  { key: "spica", name: "Spica", distLy: 250, l: 316.1, b: 50.8 },
  { key: "polaris", name: "Polaris", distLy: 433, l: 122.9, b: 26.4 },
  { key: "arcturus", name: "Arcturus", distLy: 36.7, l: 15.1, b: 69 },
  { key: "canopus", name: "Canopus", distLy: 310, l: 261, b: -5.5 },
  { key: "achernar", name: "Achernar", distLy: 139, l: 290.4, b: -76.4 },
  { key: "fomalhaut", name: "Fomalhaut", distLy: 25.1, l: 21.2, b: -64 },
  { key: "regulus", name: "Regulus", distLy: 79.3, l: 226, b: 46 },
  { key: "castor", name: "Castor", distLy: 51, l: 190.9, b: 23.6 },
  { key: "pollux", name: "Pollux", distLy: 33.8, l: 205.1, b: 23.3 },
  { key: "altair", name: "Altair", distLy: 16.7, l: 47.7, b: -9.8 },
  { key: "bellatrix", name: "Bellatrix", distLy: 250, l: 205, b: -15.7 },
  { key: "alnitak", name: "Alnitak", distLy: 1260, l: 206.4, b: -17.4 },
  { key: "alnilam", name: "Alnilam", distLy: 2000, l: 206.3, b: -16.5 },
  { key: "saiph", name: "Saiph", distLy: 650, l: 220.7, b: -10.5 },
  { key: "mira", name: "Mira", distLy: 300, l: 118, b: -54 },
  { key: "aldebaran-sector-anchor", name: "Hyades Anchor", distLy: 153, l: 181, b: -22 },
  { key: "wolf-359", name: "Wolf 359", distLy: 7.86, l: 228.4, b: 66.2 },
  { key: "barnards-star", name: "Barnard's Star", distLy: 5.96, l: 162.2, b: 14.7 },
  { key: "trappist-1", name: "TRAPPIST-1", distLy: 40.7, l: 76, b: -33 },
  { key: "kepler-452", name: "Kepler-452", distLy: 1800, l: 76, b: 6 },
  { key: "proxima-b-anchor", name: "Ross 128", distLy: 11, l: 310, b: 60 },
  // Alliance capital in the lore — real G1V catalog star, ~46 ly from Sol.
  { key: "47-ursae-majoris", name: "47 Ursae Majoris", distLy: 45.9, l: 130, b: 46 },
  { key: "epsilon-eridani", name: "Epsilon Eridani", distLy: 10.475, l: 195.9, b: -48 },
];

// The four quadrants tile the DISK (x/z plane) into four pie pieces — x and
// z each split at 0 — with y as the thin disk-thickness slab (±2,000 ly).
// Splitting on y instead would slice the disk vertically like card decks.
const QUADRANT_SEED = [
  {
    key: "Quadrant-Alpha",
    name: "Quadrant Alpha",
    color: "#3366ff",
    minX: -50000,
    maxX: 0,
    minY: -2000,
    maxY: 2000,
    minZ: -50000,
    maxZ: 0,
  },
  {
    key: "Quadrant-Beta",
    name: "Quadrant Beta",
    color: "#33cc33",
    minX: 0,
    maxX: 50000,
    minY: -2000,
    maxY: 2000,
    minZ: -50000,
    maxZ: 0,
  },
  {
    key: "Quadrant-Gamma",
    name: "Quadrant Gamma",
    color: "#ff9933",
    minX: -50000,
    maxX: 0,
    minY: -2000,
    maxY: 2000,
    minZ: 0,
    maxZ: 50000,
  },
  {
    key: "Quadrant-Delta",
    name: "Quadrant Delta",
    color: "#cc33ff",
    minX: 0,
    maxX: 50000,
    minY: -2000,
    maxY: 2000,
    minZ: 0,
    maxZ: 50000,
  },
];

// Canon sectors re-anchored around the galaxy-true Sol position (26,000 ly
// out on the Orion Spur, inside Quadrant Delta). Terran Reach is a ~1,200 ly
// box centered on Sol; Outer Belt sits 1–5 kly further out along the spur;
// Void Reaches is the unsurveyed dark core-ward inside Quadrant Beta.
const SECTOR_SEED = [
  {
    key: "Terran-Reach",
    name: "Terran Reach",
    quadrantKey: "Quadrant-Delta",
    color: "#4da6ff",
    status: "canon",
    description: "Cradle of Star Force — the human heart of the Orion Triangle.",
    minX: 25400,
    maxX: 26600,
    minY: -500,
    maxY: 500,
    minZ: 1900,
    maxZ: 3100,
  },
  {
    key: "Outer-Belt",
    name: "Outer Belt",
    quadrantKey: "Quadrant-Delta",
    color: "#ffcc00",
    status: "canon",
    description: "Resource frontier past the Terran corridor — mining claims and rogue signals.",
    minX: 26600,
    maxX: 30600,
    minY: -800,
    maxY: 800,
    minZ: 1800,
    maxZ: 4400,
  },
  {
    key: "Void-Reaches",
    name: "Void Reaches",
    quadrantKey: "Quadrant-Beta",
    color: "#ff6666",
    status: "proposed",
    description: "Unsurveyed dark between the arms. Proposed sector, pending the Bridge.",
    minX: 6000,
    maxX: 14000,
    minY: -1500,
    maxY: 1500,
    minZ: -12000,
    maxZ: -4000,
  },
];

// Canon chart systems placed at their real counterparts' galaxy-true
// positions (see galacticToAtlas): Sirius ~8.6 ly from Sol at l 227°, Tau
// Ceti ~11.9 ly at l 173°, etc. Keys are stable — lanes reference them.
const SYSTEM_SEED = [
  {
    key: "sirius-gate",
    name: "Sirius Gate",
    sectorKey: "Terran-Reach",
    x: 26006,
    y: 59,
    z: 2494,
    isRealStar: false,
    status: "canon",
    faction: "Star Force",
    tags: ["jump-hub", "strategic"],
  },
  {
    key: "sol-home", // system-level canon chart inside Terran Reach (distinct from the galaxy anchor)
    name: "Sol",
    sectorKey: "Terran-Reach",
    x: 26000,
    y: 60,
    z: 2500,
    isRealStar: true,
    status: "canon",
    faction: "Star Force",
    tags: ["homeworld"],
  },
  {
    key: "proxima-outpost",
    name: "Proxima Outpost",
    sectorKey: "Terran-Reach",
    x: 25997,
    y: 55,
    z: 2497,
    isRealStar: false,
    status: "canon",
    faction: "Star Force",
    tags: ["frontier"],
  },
  {
    key: "tau-ceti-colony",
    name: "Tau Ceti Colony",
    sectorKey: "Terran-Reach",
    x: 26003,
    y: 49,
    z: 2500,
    isRealStar: false,
    status: "proposed",
    faction: "Starforge Union",
    tags: ["colony"],
  },
  {
    key: "kepler-mining",
    name: "Kepler Mining Claim",
    sectorKey: "Outer-Belt",
    x: 28400,
    y: 120,
    z: 3050,
    isRealStar: false,
    status: "canon",
    faction: "G.I.A.",
    tags: ["mining", "contested"],
  },
  {
    key: "void-listener",
    name: "Void Listening Post",
    sectorKey: "Void-Reaches",
    x: 10000,
    y: 200,
    z: -8000,
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
    x: 26006,
    y: 59,
    z: 2494,
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
    x: 26020,
    y: 93,
    z: 2524,
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
    let repaired = 0;

    // Quadrants — insert missing rows; repair stale bounds (the original
    // seed split the disk on y, slicing it vertically instead of into four
    // pie pieces across the x/z plane).
    const existingQuads = await ctx.db.query("atlasQuadrants").collect();
    const quadByKey = new Map(existingQuads.map((q) => [q.key, q]));
    for (const [i, q] of QUADRANT_SEED.entries()) {
      const existing = quadByKey.get(q.key);
      if (!existing) {
        await ctx.db.insert("atlasQuadrants", { ...q, order: i });
        added++;
        continue;
      }
      if (
        existing.minX !== q.minX ||
        existing.maxX !== q.maxX ||
        existing.minY !== q.minY ||
        existing.maxY !== q.maxY ||
        existing.minZ !== q.minZ ||
        existing.maxZ !== q.maxZ
      ) {
        await ctx.db.patch(existing._id, {
          minX: q.minX,
          maxX: q.maxX,
          minY: q.minY,
          maxY: q.maxY,
          minZ: q.minZ,
          maxZ: q.maxZ,
        });
        repaired++;
      }
    }

    // Sectors — insert missing; re-anchor drifted rows (Terran Reach and
    // Outer Belt moved from the core out to Sol on the Orion Spur).
    const existingSectors = await ctx.db.query("atlasSectors").collect();
    const sectorByKey = new Map(existingSectors.map((s) => [s.key, s]));
    for (const s of SECTOR_SEED) {
      const existing = sectorByKey.get(s.key);
      if (!existing) {
        await ctx.db.insert("atlasSectors", s);
        added++;
        continue;
      }
      if (
        existing.quadrantKey !== s.quadrantKey ||
        existing.minX !== s.minX ||
        existing.maxX !== s.maxX ||
        existing.minY !== s.minY ||
        existing.maxY !== s.maxY ||
        existing.minZ !== s.minZ ||
        existing.maxZ !== s.maxZ
      ) {
        await ctx.db.patch(existing._id, {
          quadrantKey: s.quadrantKey,
          minX: s.minX,
          maxX: s.maxX,
          minY: s.minY,
          maxY: s.maxY,
          minZ: s.minZ,
          maxZ: s.maxZ,
        });
        repaired++;
      }
    }

    // Systems — real-star anchors + canon chart systems. Insert missing;
    // snap seeded rows that drifted (legacy rows all sat at the core).
    const existingSystems = await ctx.db.query("atlasSystems").collect();
    const systemByKey = new Map(existingSystems.map((s) => [s.key, s]));
    for (const star of SEED_REAL_STARS) {
      const pos = galacticToAtlas(star);
      const existing = systemByKey.get(star.key);
      if (!existing) {
        await ctx.db.insert("atlasSystems", {
          key: star.key,
          name: star.name,
          sectorKey: "", // galaxy-level anchor
          x: pos.x,
          y: pos.y,
          z: pos.z,
          isRealStar: true,
          status: "canon",
        });
        added++;
        continue;
      }
      if (
        existing.isRealStar &&
        (existing.x !== pos.x || existing.y !== pos.y || existing.z !== pos.z)
      ) {
        await ctx.db.patch(existing._id, pos);
        repaired++;
      }
    }
    for (const s of SYSTEM_SEED) {
      const existing = systemByKey.get(s.key);
      if (!existing) {
        await ctx.db.insert("atlasSystems", { ...s, tags: s.tags });
        added++;
        continue;
      }
      if (
        existing.sectorKey !== s.sectorKey ||
        existing.x !== s.x ||
        existing.y !== s.y ||
        existing.z !== s.z
      ) {
        await ctx.db.patch(existing._id, {
          sectorKey: s.sectorKey,
          x: s.x,
          y: s.y,
          z: s.z,
        });
        repaired++;
      }
    }

    // Lanes — endpoints must exist (already in the DB or seeded above).
    const seededSystems = new Set(systemByKey.keys());
    for (const s of SYSTEM_SEED) seededSystems.add(s.key);
    for (const star of SEED_REAL_STARS) seededSystems.add(star.key);
    const existingLanes = await ctx.db.query("atlasLanes").collect();
    const takenLanes = new Set(existingLanes.map((l) => l.key));
    for (const l of LANE_SEED) {
      if (takenLanes.has(l.key)) continue;
      if (!seededSystems.has(l.fromKey) || !seededSystems.has(l.toKey)) continue;
      await ctx.db.insert("atlasLanes", { ...l, factionControl: l.factionControl });
      added++;
    }

    // Gates — insert missing; re-anchor drifted seeded gates.
    const existingGates = await ctx.db.query("atlasGates").collect();
    const gateByKey = new Map(existingGates.map((g) => [g.key, g]));
    for (const g of GATE_SEED) {
      const existing = gateByKey.get(g.key);
      if (!existing) {
        await ctx.db.insert("atlasGates", g);
        added++;
        continue;
      }
      if (existing.x !== g.x || existing.y !== g.y || existing.z !== g.z) {
        await ctx.db.patch(existing._id, { x: g.x, y: g.y, z: g.z });
        repaired++;
      }
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "atlas3d.seed",
      target: "atlas",
      meta: JSON.stringify({ added, repaired }),
      createdAt: Date.now(),
    });
    return { ok: true, added, repaired };
  },
});

/** Does the stored atlas still carry the legacy core-pinned coordinates? */
export const canonAnchorStatus = query({
  args: {},
  handler: async (ctx) => {
    const sol = await ctx.db
      .query("atlasSystems")
      .withIndex("by_key", (q) => q.eq("key", "sol"))
      .first();
    if (!sol) return { seeded: false, stale: false };
    return {
      seeded: true,
      stale: sol.x !== SOL_POSITION.x || sol.z !== SOL_POSITION.z,
    };
  },
});
