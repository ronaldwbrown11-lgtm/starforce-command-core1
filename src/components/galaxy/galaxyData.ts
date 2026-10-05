import * as THREE from "three";
import { REAL_STARS } from "./realStars";

export function starRadius(star: StarData) {
  if (star.capital) return 0.0015; // capitals stand out from the catalog
  return star.isReal ? 0.00035 : Math.max(0.006, Math.min(0.08, star.size * 0.012));
}
export function seededNoise(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 1137.0) * 43758.5453;
  return value - Math.floor(value);
}

export type StarCategory =
  | "hero"
  | "villain"
  | "neutral"
  | "ancient"
  | "guardian"
  | "mystery"
  | "none";

export const STAR_CATEGORIES: Record<
  StarCategory,
  { label: string; color: string; glowColor: string; icon: string }
> = {
  hero: {
    label: "Hero",
    color: "#3b82f6",
    glowColor: "rgba(59,130,246,0.3)",
    icon: "S",
  },
  villain: {
    label: "Villain",
    color: "#ef4444",
    glowColor: "rgba(239,68,68,0.3)",
    icon: "V",
  },
  neutral: {
    label: "Neutral",
    color: "#8b5cf6",
    glowColor: "rgba(139,92,246,0.3)",
    icon: "N",
  },
  ancient: {
    label: "Ancient",
    color: "#f59e0b",
    glowColor: "rgba(245,158,11,0.3)",
    icon: "A",
  },
  guardian: {
    label: "Guardian",
    color: "#10b981",
    glowColor: "rgba(16,185,129,0.3)",
    icon: "G",
  },
  mystery: {
    label: "Mystery",
    color: "#ec4899",
    glowColor: "rgba(236,72,153,0.3)",
    icon: "M",
  },
  none: {
    label: "Uncategorized",
    color: "#6b7280",
    glowColor: "rgba(107,114,128,0.15)",
    icon: "✦",
  },
};

export const CATEGORY_LIST: StarCategory[] = [
  "hero",
  "villain",
  "neutral",
  "ancient",
  "guardian",
  "mystery",
];

// ---------------------------------------------------------------------------
// Real Milky Way data
// ---------------------------------------------------------------------------

/** Position of the Sun (Sol / Earth) in the galaxy model.
 *  Real: ~26,000 ly from center in the Orion Spur, between Sagittarius
 *  and Perseus arms, slightly above the galactic plane. */
export const EARTH_POSITION: [number, number, number] = [11.8, 0.04, -5.2];

/** Named spiral arms with their angular offset relative to arm 0. */
export const ARM_NAMES: { name: string; index: number; color: string }[] = [
  { name: "Sagittarius Arm", index: 0, color: "#6fa8dc" },
  { name: "Perseus Arm", index: 1, color: "#93c47d" },
  { name: "Scutum-Centaurus", index: 2, color: "#f9cb9c" },
  { name: "Norma Arm", index: 3, color: "#d5a6bd" },
];

// ---------------------------------------------------------------------------
// Star types & data
// ---------------------------------------------------------------------------

export interface StarData {
  id: string;
  position: [number, number, number];
  color: string;
  size: number;
  name: string;
  defaultName: string;
  temperature: number; // Kelvin
  magnitude: number; // Apparent brightness
  category?: StarCategory;
  armIndex?: number; // which spiral arm, -1 for bulge/halo
  isReal?: boolean;
  isCustom?: boolean;
  distancePc?: number;
  source?: string;
  /** Capital world — rendered prominently with a marker ring. */
  capital?: boolean;
  /** Lore designation, e.g. "Capital of the Orion Triangle". */
  designation?: string;
}

const STAR_NAMES = [
  "Aldebaran", "Rigel", "Betelgeuse", "Sirius", "Vega",
  "Polaris", "Antares", "Altair", "Arcturus", "Capella",
  "Deneb", "Procyon", "Achernar", "Bellatrix", "Canopus",
  "Castor", "Pollux", "Regulus", "Spica", "Fomalhaut",
  "Kochab", "Pherkad", "Mira", "Algol", "Rasalhague",
  "Elnath", "Alnilam", "Alnitak", "Mintaka", "Saiph",
  "Merak", "Dubhe", "Alkaid", "Alioth", "Megrez",
  "Thuban", "Etamin", "Rastaban", "Eltanin", "Grumium",
  "Zubenelgenubi", "Zubeneschamali", "Unukalhai", "Kornephoros",
  "Marfik", "Tascheter", "Atlas", "Pleione", "Asterope",
  "Taygeta", "Maia", "Calaeno", "Electra", "Merope",
  "Alcyone", "Schedar", "Caph", "Ruchbah", "Segin",
  "Navi", "Rastaban", "Almach", "Mirach", "Alpheratz",
  "Markab", "Scheat", "Matar", "Baham", "Sadalpheretz",
  "Sadalmelik", "Sadalsuud", "Skat", "Ancha", "Pi Aquarii",
  "Kaus Australis", "Kaus Media", "Kaus Borealis", "Nash",
  "Alnasl", "Rukbat", "Arkab", "Albaldah", "Nodus II",
  "Dabih", "Oculus", "Algedi", "Dorsum", "Castula",
  "Nashira", "Deneb Algedi", "Bos", "Sham", "Alkalurops",
  "Keid", "Kursi", "Zaurak", "Rana", "Cursa",
  "Arneb", "Nihal", "Mirzam", "Murzim", "Wesen",
  "Adhara", "Wezen", "Aludra", "Furud", "Turais",
  "Markeb", "Alsephina", "Suhail", "Lambda Velorum",
  "Kappa Velorum", "Mu Velorum", "Phi Velorum",
  "Aspidiske", "Avior", "Briam", "Miaplacidus",
  "Carina", "Vela", "Puppis", "Pyxis", "Naos",
  "Azmidi", "Tureis", "Regor", "Muhlifain",
  "Nao", "Tseen Ke", "Soi", "Seat",
];

const STAR_COLORS = [
  "#8B9CFF", // Blue-white (O-type)
  "#A8B8FF", // Blue (B-type)
  "#F8F7FF", // White (A-type)
  "#FFE8B0", // Yellow-white (F-type)
  "#FFD700", // Yellow (G-type)
  "#FFA500", // Orange (K-type)
  "#FF6347", // Red (M-type)
];

export function generateStarColor(temperature: number): string {
  if (temperature > 30000) return STAR_COLORS[0];
  if (temperature > 10000) return STAR_COLORS[1];
  if (temperature > 7500) return STAR_COLORS[2];
  if (temperature > 6000) return STAR_COLORS[3];
  if (temperature > 5200) return STAR_COLORS[4];
  if (temperature > 3700) return STAR_COLORS[5];
  return STAR_COLORS[6];
}

/** Well-known real star names beyond the bright-star pool, used to name the
 *  per-sector reference stars (duplicates are filtered at use time). */
const EXTRA_STAR_NAMES = [
  "Hamal", "Sheratan", "Menkar", "Diphda", "Ankaa",
  "Izar", "Seginus", "Nekkar", "Muphrid", "Rasalgethi",
  "Sabik", "Nunki", "Ascella", "Albireo", "Alphard",
  "Denebola", "Algieba", "Adhafera", "Zavijava", "Porrima",
  "Vindemiatrix", "Algorab", "Kraz", "Alchiba", "Zaniah",
  "Yildun", "Errai", "Alderamin", "Altais", "Dschubba",
  "Acrab", "Wasat", "Mebsuta", "Tejat", "Menkalinan",
  "Ruchba", "Peacock", "Sadr", "Aljanah", "Aldhafera",
  "Alrescha", "Kitalpha", "Algenubi", "Maasym",
];

/** Real star names available for seeding: the bright-star pool plus extras,
 *  minus names already taken (catalog stars, saved lore, earlier picks). */
export function referenceStarNames(taken: Set<string>): string[] {
  const seen = new Set(taken);
  const out: string[] = [];
  for (const name of [...STAR_NAMES, ...EXTRA_STAR_NAMES]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function generateTemperature(): number {
  const r = Math.random();
  if (r < 0.01) return 30000 + Math.random() * 20000;
  if (r < 0.06) return 10000 + Math.random() * 20000;
  if (r < 0.15) return 7500 + Math.random() * 2500;
  if (r < 0.30) return 6000 + Math.random() * 1500;
  if (r < 0.55) return 5200 + Math.random() * 800;
  if (r < 0.80) return 3700 + Math.random() * 1500;
  return 2400 + Math.random() * 1300;
}

function generateSpiralPosition(
  armIndex: number,
  totalArms: number,
  r: number,
  scatter: number,
): [number, number, number] {
  const armAngle = (armIndex / totalArms) * Math.PI * 2;
  // Logarithmic spiral: radius grows angle logarithmically
  const spiralAngle = Math.log(1 + r * 0.18) * 6 + armAngle;

  const s = scatter * (1 + r * 0.08);
  const x = r * Math.cos(spiralAngle) + (Math.random() - 0.5) * s;
  const z = r * Math.sin(spiralAngle) + (Math.random() - 0.5) * s;
  // Flatter disk: vertical scatter grows slowly with radius, capped
  const verticalScatter = Math.min(0.3 + r * 0.02, 1.2);
  const y = (Math.random() - 0.5) * verticalScatter;

  return [x, y, z];
}

export function generateGalaxyData(): {
  particles: Float32Array;
  particleColors: Float32Array;
  particleSizes: Float32Array;
  prominentStars: StarData[];
} {
  const totalParticles = 100000;
  const totalProminent = 100;

  const positions = new Float32Array(totalParticles * 3);
  const colors = new Float32Array(totalParticles * 3);
  const sizes = new Float32Array(totalParticles);

  const prominent: StarData[] = [];
  const namePool = [...STAR_NAMES];
  shuffleArray(namePool);

  const totalArms = 4;
  let prominentIndex = 0;

  // --- Generate galaxy particles ---
  for (let i = 0; i < totalParticles; i++) {
    // Composition distribution (more realistic)
    const isBulge = i < totalParticles * 0.15;     // 15% bulge
    const isDisk = !isBulge && i < totalParticles * 0.83; // 68% disk/arms

    let x: number, y: number, z: number;
    let temperature: number;
    let size: number;
    let brightness: number;
    let armIdx = -1;

    if (isBulge) {
      // Elliptical bulge — denser at center, oblate spheroid
      const r = Math.pow(Math.random(), 0.8) * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const flattening = 0.4; // oblate
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.cos(phi) * flattening;
      z = r * Math.sin(phi) * Math.sin(theta);
      temperature = 4000 + Math.random() * 7000;
      size = 0.15 + Math.random() * 0.5;
      brightness = 0.4 + Math.random() * 0.6;
    } else if (isDisk) {
      // Spiral arms with realistic distribution
      const r = 2.5 + Math.pow(Math.random(), 0.5) * 26;
      armIdx = Math.floor(Math.random() * totalArms);
      // Some inter-arm stars
      if (Math.random() < 0.15) {
        armIdx = Math.floor(Math.random() * totalArms * 2) - 1; // between arms
      }
      const scatter = 0.5 + r * 0.04;
      [x, y, z] = generateSpiralPosition(
        Math.max(0, armIdx),
        totalArms,
        r,
        scatter,
      );
      temperature = generateTemperature();
      size = 0.08 + Math.random() * 0.4;
      brightness = 0.25 + Math.random() * 0.55;
    } else {
      // Halo — sparse spherical distribution, tilted slightly
      const r = 8 + Math.pow(Math.random(), 0.3) * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.cos(phi) * 1.5;
      z = r * Math.sin(phi) * Math.sin(theta);
      temperature = 3500 + Math.random() * 5000;
      size = 0.08 + Math.random() * 0.3;
      brightness = 0.15 + Math.random() * 0.25;
    }

    const color = new THREE.Color(generateStarColor(temperature));

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    colors[i * 3] = color.r * brightness;
    colors[i * 3 + 1] = color.g * brightness;
    colors[i * 3 + 2] = color.b * brightness;

    sizes[i] = size;

    // --- Pick prominent stars at regular intervals ---
    if (prominentIndex < totalProminent && i % Math.floor(totalParticles / totalProminent) === 0) {
      const starName = namePool[prominentIndex % namePool.length];
      const magnifiedSize = 0.6 + Math.random() * 1.4;
      const mag = Math.random() * 5;

      prominent.push({
        id: `star-${prominentIndex}`,
        position: [x, y, z],
        color: generateStarColor(temperature),
        size: magnifiedSize,
        name: starName,
        defaultName: starName,
        temperature,
        magnitude: mag,
        armIndex: armIdx,
      });
      prominentIndex++;
    }
  }

  return {
    particles: positions,
    particleColors: colors,
    particleSizes: sizes,
    prominentStars: REAL_STARS,
  };
}

let cachedGalaxy: ReturnType<typeof generateGalaxyData> | null = null;

/** Shared galaxy star field — generated once so the renderer and the
 *  star-dot picker always see the exact same stars. */
export function getGalaxyData(): ReturnType<typeof generateGalaxyData> {
  if (!cachedGalaxy) cachedGalaxy = generateGalaxyData();
  return cachedGalaxy;
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// ---------------------------------------------------------------------------
// Dust lanes — dark patches between spiral arms
// ---------------------------------------------------------------------------
export function generateDustPositions(count: number): Float32Array {
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 3 + Math.pow(Math.random(), 0.5) * 24;
    const armIdx = Math.floor(Math.random() * 4);
    const offset = (Math.random() - 0.5) * 0.4; // between arms
    const armAngle = ((armIdx + offset) / 4) * Math.PI * 2;
    const spiralAngle = Math.log(1 + r * 0.18) * 6 + armAngle;
    const scatter = 0.3 + r * 0.04;
    data[i * 3] = r * Math.cos(spiralAngle) + (Math.random() - 0.5) * scatter;
    data[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
    data[i * 3 + 2] = r * Math.sin(spiralAngle) + (Math.random() - 0.5) * scatter;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Nebula / HII region positions (star-forming regions along arms)
// ---------------------------------------------------------------------------
export function generateNebulaPositions(count: number): Float32Array {
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 3 + Math.pow(Math.random(), 0.6) * 20;
    const armIdx = Math.floor(Math.random() * 4);
    const armAngle = (armIdx / 4) * Math.PI * 2;
    const spiralAngle = Math.log(1 + r * 0.18) * 6 + armAngle;
    data[i * 3] = r * Math.cos(spiralAngle) + (Math.random() - 0.5) * 2;
    data[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
    data[i * 3 + 2] = r * Math.sin(spiralAngle) + (Math.random() - 0.5) * 2;
  }
  return data;
}

export const GALAXY_ROTATION_SPEED = 0.05;
