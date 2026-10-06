import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// =========================================================================
// Operator Console Sector Map → native Star Atlas mirror.
//
// The console desk (sectorMap.ts) and the native 3D Star Atlas that powers
// /map were built separately and keep their canon in different tables.
// Operators still author everything on the console desk, so every console
// write is mirrored here into the tables the new app reads:
//
//   sectorMap sector   → quadrants (mirror parent) + sectors
//   sectorMap system   → starSystems
//   warpGates row      → galaxyLanes (a corridor is an edge, not a node)
//   mapBoundaries row  → a closed ring of galaxyLanes
//
// The console tables stay the source of truth. The mirror only ever owns
// native rows stamped with a `console:` sourceKey, so it can upsert and
// clean up without disturbing hand-authored atlas data. Because
// discoveries.claimSector validates against the native `sectors` table,
// mirrored sectors become claimable/chartable in the new app for free.
// =========================================================================

const MIRROR_QUADRANT_KEY = "console:quadrant";
const MIRROR_QUADRANT_NAME = "Charted Sectors";
const MIRROR_QUADRANT_COLOR = "#38bdf8";
const GATE_LANE_COLOR = "#22d3ee";
const BOUNDARY_LANE_COLOR = "#f472b6";

/** Console SVG viewBox centre (Sol sits near 500/420) mapping onto the
 *  native atlas origin, and viewBox units per galaxy unit. The native galaxy
 *  disk spans ~34 map units and stays on screen out to ~29 at the default
 *  galaxy framing, so the console chart is scaled down to sit inside it. */
const CONSOLE_CENTER_X = 500;
const CONSOLE_CENTER_Y = 420;
const CONSOLE_SCALE = 18;
/** Keeps every mirrored position inside the visible galaxy disk. */
const MAX_GALAXY_RADIUS = 28;

const MIRROR_PALETTE = [
  "#38bdf8",
  "#2dd4bf",
  "#facc15",
  "#a78bfa",
  "#f472b6",
  "#4ade80",
  "#fb923c",
  "#60a5fa",
];

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable per-row color so mirrored sectors/systems aren't a single flat hue. */
function colorFor(key: string): string {
  return MIRROR_PALETTE[hashKey(key) % MIRROR_PALETTE.length]!;
}

/** Console viewBox (x, y) → native galaxy-local position (Sol-relative). */
function toGalaxy(x: number, y: number): {
  posX: number;
  posY: number;
  posZ: number;
} {
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  let posX = (x - CONSOLE_CENTER_X) / CONSOLE_SCALE;
  let posZ = (y - CONSOLE_CENTER_Y) / CONSOLE_SCALE;
  const radius = Math.hypot(posX, posZ);
  if (radius > MAX_GALAXY_RADIUS) {
    const k = MAX_GALAXY_RADIUS / radius;
    posX *= k;
    posZ *= k;
  }
  return { posX: round(posX), posY: 0, posZ: round(posZ) };
}

export const mirrorSectorKey = (slug: string): string => `console:sector:${slug}`;
export const mirrorSystemKey = (slug: string): string => `console:system:${slug}`;
export const mirrorGateKey = (id: string): string => `console:gate:${id}`;
const boundaryPrefix = (id: string): string => `console:boundary:${id}`;
const boundarySegKey = (id: string, i: number): string =>
  `${boundaryPrefix(id)}:seg:${i}`;

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

async function ensureMirrorQuadrant(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Id<"quadrants">> {
  const quadrants = await ctx.db.query("quadrants").collect();
  const existing = quadrants.find((q) => q.sourceKey === MIRROR_QUADRANT_KEY);
  if (existing) return existing._id;
  return ctx.db.insert("quadrants", {
    userId,
    name: MIRROR_QUADRANT_NAME,
    description:
      "Sectors charted from the Operator Console Sector Map desk, mirrored into the Star Atlas automatically.",
    color: MIRROR_QUADRANT_COLOR,
    order: quadrants.length,
    sourceKey: MIRROR_QUADRANT_KEY,
  });
}

async function findSectorByKey(
  ctx: MutationCtx,
  key: string,
): Promise<Doc<"sectors"> | null> {
  const rows = await ctx.db.query("sectors").collect();
  return rows.find((s) => s.sourceKey === key) ?? null;
}

async function findSystemByKey(
  ctx: MutationCtx,
  key: string,
): Promise<Doc<"starSystems"> | null> {
  const rows = await ctx.db.query("starSystems").collect();
  return rows.find((s) => s.sourceKey === key) ?? null;
}

async function findLaneByKey(
  ctx: MutationCtx,
  key: string,
): Promise<Doc<"galaxyLanes"> | null> {
  const rows = await ctx.db.query("galaxyLanes").collect();
  return rows.find((l) => l.sourceKey === key) ?? null;
}

async function deleteLanesTouching(
  ctx: MutationCtx,
  ids: Set<string>,
): Promise<void> {
  if (ids.size === 0) return;
  const lanes = await ctx.db.query("galaxyLanes").collect();
  for (const lane of lanes) {
    if (ids.has(lane.fromId) || ids.has(lane.toId)) {
      await ctx.db.delete(lane._id);
    }
  }
}

// ---------------------------------------------------------------------------
// Sector / system mirrors
// ---------------------------------------------------------------------------

export type ConsoleSectorRow = {
  name: string;
  slug: string;
  description?: string;
  x: number;
  y: number;
};

export async function mirrorSector(
  ctx: MutationCtx,
  userId: Id<"users">,
  row: ConsoleSectorRow,
): Promise<Id<"sectors">> {
  const key = mirrorSectorKey(row.slug);
  const pos = toGalaxy(row.x, row.y);
  const existing = await findSectorByKey(ctx, key);
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: row.name,
      description: row.description,
      ...pos,
    });
    return existing._id;
  }
  const quadrantId = await ensureMirrorQuadrant(ctx, userId);
  const siblings = await ctx.db
    .query("sectors")
    .filter((q) => q.eq(q.field("quadrantId"), quadrantId))
    .collect();
  return ctx.db.insert("sectors", {
    userId,
    quadrantId,
    name: row.name,
    description: row.description,
    color: colorFor(key),
    order: siblings.length,
    sourceKey: key,
    ...pos,
  });
}

export type ConsoleSystemRow = {
  name: string;
  slug: string;
  description?: string;
  x: number;
  y: number;
  distLy?: number;
  /** Owning console sector slug. */
  sectorSlug: string;
};

export async function mirrorSystem(
  ctx: MutationCtx,
  userId: Id<"users">,
  row: ConsoleSystemRow,
): Promise<Id<"starSystems"> | null> {
  // The sector must be mirrored first; if it isn't, skip (never throw — the
  // console write must always succeed).
  const parent = await findSectorByKey(ctx, mirrorSectorKey(row.sectorSlug));
  if (!parent) return null;
  const key = mirrorSystemKey(row.slug);
  const pos = toGalaxy(row.x, row.y);
  const description =
    row.distLy != null && !row.description?.trim()
      ? `Catalog star, ${row.distLy.toFixed(2)} ly from Sol.`
      : row.description;
  const existing = await findSystemByKey(ctx, key);
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: row.name,
      description,
      sectorId: parent._id,
      ...pos,
    });
    return existing._id;
  }
  const siblings = await ctx.db
    .query("starSystems")
    .filter((q) => q.eq(q.field("sectorId"), parent._id))
    .collect();
  return ctx.db.insert("starSystems", {
    userId,
    sectorId: parent._id,
    name: row.name,
    description,
    color: colorFor(key),
    order: siblings.length,
    sourceKey: key,
    ...pos,
  });
}

export async function unmirrorSector(
  ctx: MutationCtx,
  slug: string,
): Promise<void> {
  const sector = await findSectorByKey(ctx, mirrorSectorKey(slug));
  if (!sector) return;
  const systems = await ctx.db
    .query("starSystems")
    .filter((q) => q.eq(q.field("sectorId"), sector._id))
    .collect();
  await deleteLanesTouching(
    ctx,
    new Set<string>([sector._id, ...systems.map((s) => s._id)]),
  );
  for (const system of systems) await ctx.db.delete(system._id);
  await ctx.db.delete(sector._id);
}

export async function unmirrorSystem(
  ctx: MutationCtx,
  slug: string,
): Promise<void> {
  const system = await findSystemByKey(ctx, mirrorSystemKey(slug));
  if (!system) return;
  await deleteLanesTouching(ctx, new Set<string>([system._id]));
  await ctx.db.delete(system._id);
}

// ---------------------------------------------------------------------------
// Warp gate → lane mirror
// ---------------------------------------------------------------------------

export type ConsoleGateRow = {
  id: string;
  label: string;
  fromSlug: string;
  toSlug: string;
};

export async function mirrorGate(
  ctx: MutationCtx,
  userId: Id<"users">,
  gate: ConsoleGateRow,
): Promise<Id<"galaxyLanes"> | null> {
  const key = mirrorGateKey(gate.id);
  const existing = await findLaneByKey(ctx, key);
  const from = await findSectorByKey(ctx, mirrorSectorKey(gate.fromSlug));
  const to = await findSectorByKey(ctx, mirrorSectorKey(gate.toSlug));
  if (!from || !to) {
    // A missing endpoint can't render; drop any stale lane for this gate.
    if (existing) await ctx.db.delete(existing._id);
    return null;
  }
  const fromId = from._id;
  const toId = to._id;
  if (existing) {
    await ctx.db.patch(existing._id, { name: gate.label, fromId, toId });
    return existing._id;
  }
  return ctx.db.insert("galaxyLanes", {
    userId,
    name: gate.label,
    color: GATE_LANE_COLOR,
    fromId,
    toId,
    sourceKey: key,
  });
}

export async function unmirrorGate(ctx: MutationCtx, id: string): Promise<void> {
  const lane = await findLaneByKey(ctx, mirrorGateKey(id));
  if (lane) await ctx.db.delete(lane._id);
}

// ---------------------------------------------------------------------------
// Boundary → closed ring of lanes
// ---------------------------------------------------------------------------

async function deleteBoundaryLanes(ctx: MutationCtx, id: string): Promise<void> {
  const prefix = `${boundaryPrefix(id)}:`;
  const lanes = await ctx.db.query("galaxyLanes").collect();
  for (const lane of lanes) {
    if (lane.sourceKey?.startsWith(prefix)) await ctx.db.delete(lane._id);
  }
}

export type ConsoleBoundaryRow = {
  id: string;
  name: string;
  sectorSlugs: string[];
};

/** Rebuilds a boundary as a closed ring of lanes through its vertices.
 *  Skips (and clears) the ring when any vertex isn't mirrored, so a partial
 *  polygon never renders. */
export async function mirrorBoundary(
  ctx: MutationCtx,
  userId: Id<"users">,
  boundary: ConsoleBoundaryRow,
): Promise<number> {
  await deleteBoundaryLanes(ctx, boundary.id);
  const vertices: Id<"sectors">[] = [];
  for (const slug of boundary.sectorSlugs) {
    const sector = await findSectorByKey(ctx, mirrorSectorKey(slug));
    if (!sector) return 0;
    vertices.push(sector._id);
  }
  if (vertices.length < 3) return 0;
  for (let i = 0; i < vertices.length; i++) {
    await ctx.db.insert("galaxyLanes", {
      userId,
      name: boundary.name,
      color: BOUNDARY_LANE_COLOR,
      fromId: vertices[i]!,
      toId: vertices[(i + 1) % vertices.length]!,
      customColor: true,
      sourceKey: boundarySegKey(boundary.id, i),
    });
  }
  return vertices.length;
}

export async function unmirrorBoundary(
  ctx: MutationCtx,
  id: string,
): Promise<void> {
  await deleteBoundaryLanes(ctx, id);
}
