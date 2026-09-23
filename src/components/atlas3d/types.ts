// =========================================================================
// 3D Star Atlas — shared types + coordinate helpers.
//
// Canonical space: Milky Way disk radius 50000, z thickness [-2000, 2000].
// Scene space: canonical (x, y, z) maps to three.js (x, y, z)/50000 with the
// disk lying in the x/z plane — canonical y is depth, canonical z is height.
// =========================================================================

export type Vec3 = { x: number; y: number; z: number };

export type AtlasQuadrant = {
  key: string;
  name: string;
  color: string;
  order?: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type AtlasSector = {
  key: string;
  name: string;
  quadrantKey: string;
  color: string;
  status?: string;
  description?: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type AtlasSystem = {
  key: string;
  name: string;
  sectorKey: string;
  x: number;
  y: number;
  z: number;
  isRealStar?: boolean;
  status?: string;
  faction?: string;
  tags?: string[];
  notes?: string;
};

export type AtlasGate = {
  key: string;
  label?: string;
  level: string;
  quadrantKey?: string;
  sectorKey?: string;
  systemKey?: string;
  x: number;
  y: number;
  z: number;
  status?: string;
};

export type AtlasLane = {
  key: string;
  fromKey: string;
  toKey: string;
  type: string;
  risk: string;
  factionControl?: string;
};

export type AtlasSnapshot = {
  quadrants: AtlasQuadrant[];
  sectors: AtlasSector[];
  systems: AtlasSystem[];
  gates: AtlasGate[];
  lanes: AtlasLane[];
};

export type AtlasLevel = "galaxy" | "quadrant" | "sector" | "system";

export const GALAXY_RADIUS = 50000;

/** Canonical → scene coordinates (disk in the x/z plane, y up). */
export function toScene(p: Vec3): [number, number, number] {
  return [p.x / GALAXY_RADIUS, p.z / GALAXY_RADIUS, p.y / GALAXY_RADIUS];
}

export function boundsCenter(b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): Vec3 {
  return {
    x: (b.minX + b.maxX) / 2,
    y: (b.minY + b.maxY) / 2,
    z: (b.minZ + b.maxZ) / 2,
  };
}

/** Largest planar span of a canonical bounds box. */
export function boundsSpan(b: { minX: number; maxX: number; minY: number; maxY: number }): number {
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

export function pointInBounds(p: Vec3, b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && p.z >= b.minZ && p.z <= b.maxZ;
}

// =========================================================================
// Per-level content framing. THE core fix for "47 Ursae Majoris renders as
// a cluster of circles": each level below galaxy computes a LOCAL frame from
// the content it actually shows, so drilling in spreads the children across
// the screen instead of leaving them as a microscopic clump inside huge
// parent bounds. Every level-level view is just "a nicely filled unit area",
// and the camera rig only needs (center, scale, distance).
// =========================================================================

export type AtlasFrame = {
  /** Scene-space point the level is framed around. */
  center: [number, number, number];
  /** Scene-space zoom factor applied to content at this level (1 = galaxy). */
  scale: number;
  /** Suggested camera distance for this level. */
  distance: number;
};

/** Round a zoom factor up to a power of two — keeps levels comparable. */
function snapScale(s: number): number {
  return Math.pow(2, Math.max(0, Math.ceil(Math.log2(Math.max(1, s)))));
}

/** Content bbox in canonical units, with a fallback hint when <2 items. */
function contentSpread(
  items: AtlasSystem[],
  b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  fallbackFraction: number,
): { center: Vec3; planarSpan: number } {
  if (items.length < 2) {
    return { center: boundsCenter(b), planarSpan: Math.max(boundsSpan(b), 100) * fallbackFraction };
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const s of items) {
    minX = Math.min(minX, s.x);
    maxX = Math.max(maxX, s.x);
    minY = Math.min(minY, s.y);
    maxY = Math.max(maxY, s.y);
    minZ = Math.min(minZ, s.z);
    maxZ = Math.max(maxZ, s.z);
  }
  const sx = maxX - minX;
  const sy = maxY - minY;
  const sz = maxZ - minZ;
  const planar = Math.max(sx, sy, sz) || Math.max(boundsSpan(b), 100) * fallbackFraction;
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    planarSpan: planar,
  };
}

/** Quadrant level: frame the quadrant's real content (stars inside bounds). */
export function computeQuadrantFrame(quadrant: AtlasQuadrant, systems: AtlasSystem[]): AtlasFrame {
  const inside = systems.filter((s) => pointInBounds(s, quadrant));
  const { center, planarSpan } = contentSpread(inside, quadrant, 0.2);
  // Cap the zoom by the quadrant's own size so an empty quadrant still
  // renders as a roomy volume rather than an unbounded blow-up.
  const maxScale = snapScale(1.8 / Math.max(boundsSpan(quadrant), 100));
  const scale = snapScale(Math.min(maxScale, 1.6 / (planarSpan / GALAXY_RADIUS)));
  return {
    center: toScene(center),
    scale,
    distance: 1.15 / Math.pow(2, Math.log2(scale) / 2) + 0.85,
  };
}

/** Sector level: frame the sector's systems + real stars in/near bounds. */
export function computeSectorFrame(sector: AtlasSector, systems: AtlasSystem[]): AtlasFrame {
  const inside = systems.filter((s) => s.sectorKey === sector.key || pointInBounds(s, sector));
  const { center, planarSpan } = contentSpread(inside, sector, 0.15);
  const maxScale = snapScale(2.6 / Math.max(boundsSpan(sector), 1));
  const scale = snapScale(Math.min(maxScale, 1.6 / (planarSpan / GALAXY_RADIUS)));
  return {
    center: toScene(center),
    scale,
    distance: 1.15 / Math.pow(2, Math.log2(scale) / 2) + 0.85,
  };
}

/** System level: blow the focused system up to a comfortable local view. */
export function computeSystemFrame(system: AtlasSystem): AtlasFrame {
  return { center: toScene(system), scale: 768, distance: 0.42 };
}

/** Palette per the atlas style guide. */
export const ATLAS_COLORS = {
  disk: "#0a0a1a",
  star: "#00ccff",
  canon: "#ffffff",
  proposed: "#999999",
  gate: "#ff00ff",
  lane: "#00ff99",
  hud: "rgba(10,10,20,0.8)",
  editor: "rgba(20,20,40,0.9)",
} as const;

export const LANE_COLORS: Record<string, string> = {
  warp: "#00ff99",
  jump: "#00ccff",
  trade: "#ffcc00",
  hazard: "#ff4444",
};

export function laneColor(lane: AtlasLane): string {
  return LANE_COLORS[lane.type] ?? ATLAS_COLORS.lane;
}
