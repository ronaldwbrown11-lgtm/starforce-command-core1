// ---------------------------------------------------------------------------
// Galactic atlas geometry: quadrants are angular wedges of the galactic disk,
// sectors subdivide a quadrant's wedge, and star systems are placed
// deterministically inside their sector. Everything derives from the ordered
// lists returned by Convex, so the map stays stable across reloads.
// ---------------------------------------------------------------------------

export type Vec3 = [number, number, number];

export interface MapQuadrant {
  id: string;
  name: string;
  description: string;
  color: string;
  order: number;
}

export interface MapSector {
  id: string;
  quadrantId: string;
  name: string;
  description: string;
  color: string;
  order: number;
  /** Explicit map position (e.g. created by clicking the map). */
  pos?: Vec3;
}

export interface MapStarSystem {
  id: string;
  sectorId: string;
  name: string;
  description: string;
  color: string;
  order: number;
  /** Explicit map position (e.g. Sagittarius A* Throne at [0, 0, 0]). */
  pos?: Vec3;
  /** Lore-list star this system was seeded from, when there is one. */
  starId?: string;
}

/** The galaxy-local placement of a map entity, derived from its position in
 *  the hierarchy (never stored — deterministic across sessions). */
export interface PlacedQuadrant extends MapQuadrant {
  wedge: Wedge;
  center: Vec3;
}

export interface PlacedSector extends MapSector {
  wedge: Wedge;
  center: Vec3;
  /** Radial band child systems scatter within. */
  inner: number;
  outer: number;
}

export interface PlacedStarSystem extends MapStarSystem {
  position: Vec3;
}

export interface Wedge {
  start: number; // radians, inclusive
  end: number; // radians, exclusive
}

/** Angular range quadrants start at (Sol sits near -24°, so quadrant 1
 *  covers the Sol neighborhood with a comfortable margin). */
const WEDGE_START_OFFSET = -Math.PI / 4;

/** Levels a warp gate node can live at: a galaxy-level quadrant hub (exactly
 *  one per quadrant — four on the default atlas) or unlimited gates at the
 *  quadrant / sector / system levels. */
export type WarpGateLevel = "galaxy" | "quadrant" | "sector" | "system";

/** A user-created warp gate node on the galactic map. */
export interface WarpGateNode {
  id: string;
  name: string;
  description: string;
  color: string;
  level: WarpGateLevel;
  quadrantId?: string;
  sectorId?: string;
  systemId?: string;
  position: Vec3;
}
// Radial extent of the atlas bands: from the galactic center (Sgr A* sits at
// r = 0) out past every population of the galaxy — the spiral disk reaches
// r = 28.5 (+ ~3.8 scatter ≈ 32.3) and the sparse halo's planar projection
// reaches r = 33 — so quadrant/sector boundaries tile the entire galaxy:
// no hole at the core, no uncovered rim.
const INNER_RADIUS = 0;
const OUTER_RADIUS = 34;
// Hash-scattered points (systems, sector reference stars) stay inside the
// distance where a star remains on screen at the default galaxy framing
// (camera 46 out, fov 50, any azimuth): r < 46·sin(halfHFov) ≈ 29.4. Wedge
// boundaries still run to OUTER_RADIUS, so the atlas covers the entire
// galaxy while every scattered star keeps its label visible. Bands placed
// explicitly on the map (inner > 0) keep their own extent.
const SCATTER_MAX_RADIUS = 29;
const SECTOR_MID_RADIUS = 14;

export function quadrantWedge(index: number, total: number): Wedge {
  const n = Math.max(1, total);
  const span = (Math.PI * 2) / n;
  const start = WEDGE_START_OFFSET + index * span;
  return { start, end: start + span };
}

export function sectorWedge(
  quadrant: Wedge,
  index: number,
  total: number,
): Wedge {
  const n = Math.max(1, total);
  const span = (quadrant.end - quadrant.start) / n;
  const start = quadrant.start + index * span;
  return { start, end: start + span };
}

export function wedgeCenter(wedge: Wedge, radius = SECTOR_MID_RADIUS): Vec3 {
  const angle = (wedge.start + wedge.end) / 2;
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}

/** Closed outline of a wedge (inner arc → outer arc → back), for drawing. */
export function wedgeOutline(
  wedge: Wedge,
  segments = 24,
  inner = INNER_RADIUS,
  outer = OUTER_RADIUS,
): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = wedge.start + ((wedge.end - wedge.start) * i) / segments;
    points.push([Math.cos(a) * inner, 0, Math.sin(a) * inner]);
  }
  for (let i = segments; i >= 0; i--) {
    const a = wedge.start + ((wedge.end - wedge.start) * i) / segments;
    points.push([Math.cos(a) * outer, 0, Math.sin(a) * outer]);
  }
  points.push([...points[0]]); // close the second radial boundary
  return points;
}

/** Deterministic 32-bit hash → [0, 1). Used to scatter systems stably. */
function hash01(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Place a star system somewhere inside its sector wedge. Deterministic on
 *  id so the same system always lands in the same spot. */
export function systemPosition(
  wedge: Wedge,
  id: string,
  inner = INNER_RADIUS,
  outer = OUTER_RADIUS,
): Vec3 {
  const angleMix = 0.2 + hash01(id, 1) * 0.6; // stay off wedge edges
  const radiusMix = 0.25 + hash01(id, 2) * 0.65;
  const angle =
    wedge.start + (wedge.end - wedge.start) * angleMix;
  let radius = inner + (outer - inner) * radiusMix;
  if (inner === INNER_RADIUS) radius = Math.min(radius, SCATTER_MAX_RADIUS);
  const y = (hash01(id, 3) - 0.5) * 0.8;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

/** Sector wedge + radial band for a sector placed explicitly on the map:
 *  a chunk of the disk centered on the clicked spot. */
function explicitSectorGeometry(pos: Vec3): {
  wedge: Wedge;
  inner: number;
  outer: number;
} {
  const radius = Math.hypot(pos[0], pos[2]);
  const angle = Math.atan2(pos[2], pos[0]);
  return {
    wedge: { start: angle - 0.45, end: angle + 0.45 },
    inner: Math.max(0.5, radius - 6),
    outer: radius + 6,
  };
}

// ---------------------------------------------------------------------------
// Placing whole maps
// ---------------------------------------------------------------------------

export function placeQuadrants(quadrants: MapQuadrant[]): PlacedQuadrant[] {
  return quadrants.map((q, i) => {
    const wedge = quadrantWedge(i, quadrants.length);
    return { ...q, wedge, center: wedgeCenter(wedge) };
  });
}

export function placeSectors(
  sectors: MapSector[],
  quadrants: PlacedQuadrant[],
): PlacedSector[] {
  const result: PlacedSector[] = [];
  for (const quad of quadrants) {
    const own = sectors
      .filter((s) => s.quadrantId === quad.id)
      .sort((a, b) => a.order - b.order);
    own.forEach((s, i) => {
      if (s.pos) {
        const { wedge, inner, outer } = explicitSectorGeometry(s.pos);
        result.push({ ...s, wedge, center: s.pos, inner, outer });
      } else {
        const wedge = sectorWedge(quad.wedge, i, own.length);
        result.push({
          ...s,
          wedge,
          center: wedgeCenter(wedge),
          inner: INNER_RADIUS,
          outer: OUTER_RADIUS,
        });
      }
    });
  }
  return result;
}

export function placeSystems(
  systems: MapStarSystem[],
  sectors: PlacedSector[],
): PlacedStarSystem[] {
  const sectorById = new Map(sectors.map((s) => [s.id, s]));
  const out: PlacedStarSystem[] = [];
  for (const sys of systems) {
    const sector = sectorById.get(sys.sectorId);
    if (!sector) continue;
    out.push({
      ...sys,
      position:
        sys.pos ??
        systemPosition(sector.wedge, sys.id, sector.inner, sector.outer),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Warp gate lanes — user-created gates at any atlas level (or stars),
// color-coded by the level they connect.
// ---------------------------------------------------------------------------

export type LaneTier = "quadrant" | "sector" | "system";

/** Level-based warp lane colors: quadrant↔quadrant hubs, sector↔sector hubs,
 *  system↔system (and star) runs. */
export const LANE_TIER_COLORS: Record<LaneTier, string> = {
  quadrant: "#a78bfa",
  sector: "#22d3ee",
  system: "#fbbf24",
};

const TIER_RANK: Record<string, number> = {
  Quadrant: 0,
  Hub: 0, // galaxy-level gate hubs rank with their quadrants
  Sector: 1,
  System: 2,
  Star: 2,
  Gate: 2, // finer-level gate nodes are terminal anchors
};

/** A lane's tier is the finer of its two endpoint levels (stars count at the
 *  system tier). */
export function laneTier(fromKind: string, toKind: string): LaneTier {
  const rank = Math.max(TIER_RANK[fromKind] ?? 2, TIER_RANK[toKind] ?? 2);
  return rank === 0 ? "quadrant" : rank === 1 ? "sector" : "system";
}

/** Rendered lane color: the level color unless the user chose a custom one. */
export function laneColor(
  customColor: boolean | undefined,
  storedColor: string,
  fromKind: string,
  toKind: string,
): string {
  return customColor ? storedColor : LANE_TIER_COLORS[laneTier(fromKind, toKind)];
}

export interface WarpLane {
  id: string;
  from: Vec3;
  to: Vec3;
  color: string;
}

export function buildWarpLanes(
  sectors: PlacedSector[],
  systems: PlacedStarSystem[],
  color: string,
): WarpLane[] {
  const lanes: WarpLane[] = [];
  const bySector = new Map<string, PlacedStarSystem[]>();
  for (const sys of systems) {
    const list = bySector.get(sys.sectorId) ?? [];
    list.push(sys);
    bySector.set(sys.sectorId, list);
  }

  const hubPositions: Vec3[] = [];

  for (const sector of sectors) {
    const list = (bySector.get(sector.id) ?? []).sort(
      (a, b) => a.order - b.order,
    );
    if (list.length === 0) continue;
    hubPositions.push(list[0].position);
    for (let i = 1; i < list.length; i++) {
      lanes.push({
        id: `${list[i - 1].id}-${list[i].id}`,
        from: list[i - 1].position,
        to: list[i].position,
        color,
      });
    }
  }

  // Chain the sector hubs together and close the ring back to the first hub.
  // For exactly two sectors a closed ring would draw A→B twice, so the
  // closing segment is only added when there are 3+ hubs.
  for (let i = 0; i + 1 < hubPositions.length; i++) {
    lanes.push({
      id: `hub-${i}`,
      from: hubPositions[i],
      to: hubPositions[i + 1],
      color,
    });
  }
  if (hubPositions.length >= 3) {
    lanes.push({
      id: `hub-${hubPositions.length - 1}`,
      from: hubPositions[hubPositions.length - 1],
      to: hubPositions[0],
      color,
    });
  }

  return lanes;
}
