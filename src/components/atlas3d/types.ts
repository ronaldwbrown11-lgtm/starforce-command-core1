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

/**
 * Canonical → scene coordinates.
 * Canonical y is HEIGHT (galactic disk thickness, seeded ±2000 ly) and maps
 * to three.js up (+Y). Canonical x/z are the galactic plane and map to
 * scene x/z. The disk therefore lies flat in the x/z plane, matching the
 * GalaxyBackdrop plate and the CameraRig orbit around +Y.
 */
export function toScene(p: Vec3): [number, number, number] {
  return [p.x / GALAXY_RADIUS, p.y / GALAXY_RADIUS, p.z / GALAXY_RADIUS];
}

export function boundsCenter(b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): Vec3 {
  return {
    x: (b.minX + b.maxX) / 2,
    y: (b.minY + b.maxY) / 2,
    z: (b.minZ + b.maxZ) / 2,
  };
}

/** Largest planar (in-disk) span of a canonical bounds box: x/z extents. */
export function boundsSpan(b: { minX: number; maxX: number; minZ: number; maxZ: number }): number {
  return Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
}

export function pointInBounds(p: Vec3, b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && p.z >= b.minZ && p.z <= b.maxZ;
}

// =========================================================================
// Per-level content framing. Each level below galaxy computes a LOCAL frame
// from the content it actually shows: the LevelGroup scales content up so it
// fills the view, and the camera stays at a FIXED distance — the group scale
// does the zooming. Screen-constant dot/label sizes divide by this scale.
// =========================================================================

export type AtlasFrame = {
  /** Scene-space point the level is framed around. */
  center: [number, number, number];
  /** Scene-space zoom factor applied to content at this level (1 = galaxy). */
  scale: number;
  /** Fixed camera distance (the same for every level). */
  distance: number;
};

/** Shared camera distance for every level — the frame scale does the zoom. */
export const FRAME_DISTANCE = 2.2;

const MAX_SCALE = 8192;

/** Scene-space box size for canonical bounds: (width x, height y, depth z). */
export function sceneSize(b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): [number, number, number] {
  return [
    (b.maxX - b.minX) / GALAXY_RADIUS,
    (b.maxY - b.minY) / GALAXY_RADIUS,
    (b.maxZ - b.minZ) / GALAXY_RADIUS,
  ];
}

/** Round a zoom factor to the nearest power of two (min 1). */
function snapScale(s: number): number {
  return Math.min(MAX_SCALE, Math.pow(2, Math.round(Math.log2(Math.max(1, s)))));
}

/** Content bbox in canonical units. Empty/point sets fall back to the bounds. */
function contentSpread(
  items: AtlasSystem[],
  b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
): { center: Vec3; planarSpan: number } {
  if (items.length < 2) {
    return { center: boundsCenter(b), planarSpan: Math.max(boundsSpan(b), 100) };
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
  const planar = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  return {
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
    planarSpan: planar || Math.max(boundsSpan(b), 100),
  };
}

/** Zoom that fills the view with content of the given canonical span. */
function zoomForSpan(span: number): number {
  return snapScale((1.6 * GALAXY_RADIUS) / Math.max(span, 0.5));
}

/** Quadrant level: frame the quadrant's real stars (fallback: its volume). */
export function computeQuadrantFrame(quadrant: AtlasQuadrant, systems: AtlasSystem[]): AtlasFrame {
  const inside = systems.filter((s) => pointInBounds(s, quadrant));
  const { center, planarSpan } = contentSpread(inside, quadrant);
  return {
    center: toScene(center),
    scale: zoomForSpan(planarSpan),
    distance: FRAME_DISTANCE,
  };
}

/** Sector level: frame the sector's systems + real stars in/near bounds. */
export function computeSectorFrame(sector: AtlasSector, systems: AtlasSystem[]): AtlasFrame {
  const inside = systems.filter((s) => s.sectorKey === sector.key || pointInBounds(s, sector));
  const { center, planarSpan } = contentSpread(inside, sector);
  return {
    center: toScene(center),
    scale: zoomForSpan(planarSpan),
    distance: FRAME_DISTANCE,
  };
}

/** System level: the focused system plus its sector-mates, zoomed deeper. */
export function computeSystemFrame(system: AtlasSystem, systems: AtlasSystem[]): AtlasFrame {
  const local = systems.filter((s) => s.sectorKey && s.sectorKey === system.sectorKey);
  const content = local.length >= 2 ? local : [system];
  const bbox = {
    minX: Math.min(...content.map((s) => s.x)),
    maxX: Math.max(...content.map((s) => s.x)),
    minY: Math.min(...content.map((s) => s.y)),
    maxY: Math.max(...content.map((s) => s.y)),
    minZ: Math.min(...content.map((s) => s.z)),
    maxZ: Math.max(...content.map((s) => s.z)),
  };
  const { center, planarSpan } = contentSpread(content, bbox);
  // One level deeper than the sector view of the same content.
  return {
    center: toScene(center),
    scale: snapScale(zoomForSpan(planarSpan) * 4),
    distance: FRAME_DISTANCE,
  };
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
