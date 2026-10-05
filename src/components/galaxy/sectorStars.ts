import {
  generateStarColor,
  referenceStarNames,
  seededNoise,
} from "./galaxyData";
import { systemPosition, type PlacedSector } from "./mapGeometry";

// ---------------------------------------------------------------------------
// Sector reference stars — a dozen labeled reference points per atlas sector,
// scattered deterministically through the sector's wedge and radial band.
// They give every sector relative positions for lore-star creation and become
// galaxy-wide warp-gate endpoints once seeded into the star lore list.
// ---------------------------------------------------------------------------

export interface SectorStarSeed {
  starId: string;
  name: string;
  color: string;
  size: number;
  temperature: number;
  magnitude: number;
  posX: number;
  posY: number;
  posZ: number;
}

/** Stars per sector (the requested "dozen"). */
export const STARS_PER_SECTOR = 12;

/** Id prefix of every seeded sector reference star. */
export const SECTOR_STAR_PREFIX = "refstar-";

/** True for seeded per-sector reference stars (they get label priority —
 *  they are the relative-position points every sector needs). */
export function isSectorStar(id: string): boolean {
  return id.startsWith(SECTOR_STAR_PREFIX);
}

/** Minimum planar spacing between reference stars of the same sector, so a
 *  dozen points read as a dozen distinct relative positions instead of a
 *  near-coincident pair. */
const MIN_SECTOR_STAR_SEPARATION = 1.5;

/**
 * Build the reference-star seed payload for every given sector.
 * Positions come from the map's own deterministic scatter (same wedge/band
 * math the star systems use), so stars spread throughout each sector and
 * stay put across sessions; candidates closer than MIN_SECTOR_STAR_SEPARATION
 * to an earlier star are re-hashed deterministically. Names are real star
 * names not already taken.
 */
export function buildSectorStars(
  sectors: PlacedSector[],
  takenNames: Set<string>,
  perSector = STARS_PER_SECTOR,
): SectorStarSeed[] {
  const pool = referenceStarNames(takenNames);
  const out: SectorStarSeed[] = [];
  let n = 0;
  sectors.forEach((sector, sectorIndex) => {
    const placedInSector: [number, number, number][] = [];
    for (let i = 0; i < perSector; i++) {
      const starId = `${SECTOR_STAR_PREFIX}${sector.id}-${i}`;
      // Stable noise per star drives its physical appearance.
      const seed = sectorIndex * perSector + i;
      const temperature = Math.round(3000 + seededNoise(seed, 11) * 27000);
      const magnitude = Math.round((1 + seededNoise(seed, 12) * 5) * 10) / 10;
      const size = Math.round((0.7 + seededNoise(seed, 13) * 0.9) * 100) / 100;
      const base = pool[n];
      // Fall back to numbered names if the pool runs dry (extra sectors).
      const name = base ?? `${pool[n % pool.length]} ${Math.floor(n / pool.length) + 1}`;
      n++;
      // Re-scatter deterministically if this candidate lands on an earlier
      // star of the same sector (the hash can produce near-coincidences).
      let pos = systemPosition(sector.wedge, starId, sector.inner, sector.outer);
      for (let attempt = 1; attempt <= 24; attempt++) {
        const clash = placedInSector.some(
          ([x, , z]) =>
            Math.hypot(x - pos[0], z - pos[2]) < MIN_SECTOR_STAR_SEPARATION,
        );
        if (!clash) break;
        pos = systemPosition(
          sector.wedge,
          `${starId}~${attempt}`,
          sector.inner,
          sector.outer,
        );
      }
      placedInSector.push(pos);
      const [posX, posY, posZ] = pos;
      out.push({
        starId,
        name,
        color: generateStarColor(temperature),
        size,
        temperature,
        magnitude,
        posX: Math.round(posX * 1e4) / 1e4,
        posY: Math.round(posY * 1e4) / 1e4,
        posZ: Math.round(posZ * 1e4) / 1e4,
      });
    }
  });
  return out;
}
