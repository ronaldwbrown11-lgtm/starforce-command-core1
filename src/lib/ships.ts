// =============================================================================
// Ultra Force ship assignment — canonical catalog.
//
// Ship assignment is cosmetic + identity only: it never changes gameplay
// mechanics. It drives the onboarding wizard, the profile ship card, the
// ship flair, ship-class missions, the ship dashboard, and the fleet
// registry grouping. Every class listed here must remain selectable.
// =============================================================================

export const SHIP_CATEGORIES = [
  "Fighters",
  "Destroyers",
  "Heavy Destroyers",
  "Cruisers",
  "Carriers",
  "Dreadnoughts",
  "Supercapital Ships",
  "Ghost Ships",
  "Support Ships",
  "Marine Transports",
  "Autonomous Drone Ships",
] as const;

export type ShipCategory = (typeof SHIP_CATEGORIES)[number];

export const SHIP_CLASSES_BY_CATEGORY: Record<ShipCategory, string[]> = {
  Fighters: [
    "Sagittarius",
    "Werewolf",
    "Mustang",
    "Orion",
    "Stellar Bat",
    "Matrix",
    "Sagittarius-II",
    "Werewolf-II",
    "Mustang-II",
  ],
  Destroyers: ["Ion Raptor", "Solar Cutter", "Ghostflare", "Vortex Hound", "CryoJackal"],
  "Heavy Destroyers": ["Graviton Breaker", "Darkstar Reaver", "Solar Pike", "Entropy Fang"],
  Cruisers: ["Ion Tempest", "Quantum Herald", "Solaris Spear", "GravSeraph"],
  Carriers: ["Nebula Citadel", "Astral Ark", "Pulse Cathedral", "Slipstream Haven"],
  Dreadnoughts: [
    "Eclipse Leviathan",
    "Starforge Colossus",
    "Chrono Dominion",
    "Void Imperator",
  ],
  "Supercapital Ships": [
    "Astral Citadel",
    "Nebula Cathedral",
    "Slipstream Sanctum",
    "Pulse Pantheon",
    "Starforge Basilica",
    "Entropy Spire",
    "CryoEclipse",
    "Thunder Colossus",
    "Solar Harbinger",
    "Aether Crucifix",
  ],
  "Ghost Ships": ["Whisper Shade", "Silent Echo", "Dark Signal", "Phantom Reach"],
  "Support Ships": ["Mercy Horizon", "Atlas Forge", "Titan Harbor", "Sanctuary Light", "Iron Citadel"],
  "Marine Transports": ["Zodiax"],
  "Autonomous Drone Ships": ["Machine Prophet", "Synthetic Dominion", "Hollow Signal"],
};

export const SHIP_CLASSES: string[] = Object.values(SHIP_CLASSES_BY_CATEGORY).flat();

export const SHIP_ROLES = [
  "Interceptor",
  "Recon",
  "Assault",
  "Siege",
  "Support",
  "Command",
  "Stealth",
  "Drone Control",
] as const;

export type ShipRole = (typeof SHIP_ROLES)[number];

// Group categories — aligned with the membership group system. Every group a
// pilot picks here is stored on the user and mirrored into the fleet registry.
export const SHIP_GROUP_SECTIONS = [
  {
    title: "Star Force Branch",
    groups: ["Star Force", "Marines", "G.I.A.", "Special Forces"],
  },
  {
    title: "Star Force Division",
    groups: [
      "Carrier Wing",
      "Destroyer Wing",
      "Frigate Screen",
      "Suppression Flotilla",
      "Ghost Ship Division",
      "Autonomous Drone Division",
      "Marine Divisions",
      "G.I.A. Divisions",
      "Special Forces Divisions",
    ],
  },
  {
    title: "Ultra Force Fleet Group",
    groups: [
      "5th Command Group",
      "Strike Task Force",
      "Siege Task Force",
      "Shadow Task Force",
      "Relief Task Force",
      "Deep Range Recon Group",
      "Autonomous Battle Group",
    ],
  },
  {
    title: "Species Specialization Group",
    groups: [
      "Velkarian",
      "Helioxian",
      "Kethari",
      "Auroran",
      "Chronari",
      "Gravethari",
      "Silthari",
      "Myr-Kael",
      "Veyrathi",
      "Auralith",
      "Umbraxi",
      "Nythori",
      "Orvaxian",
      "Vedan",
      "Aru'areth",
    ],
  },
] as const;

export const ALL_SHIP_GROUPS: string[] = SHIP_GROUP_SECTIONS.flatMap((s) => s.groups);

// ---------------------------------------------------------------------------
// Per-class identity — accent color + silhouette kind. Accents live inside
// the Ultra Force color system (cyan / violet / magenta / gold / green /
// amber / teal / red / blue / slate).
// ---------------------------------------------------------------------------

export type SilhouetteKind =
  | "fighter"
  | "destroyer"
  | "heavyDestroyer"
  | "cruiser"
  | "carrier"
  | "dreadnought"
  | "supercapital"
  | "ghost"
  | "support"
  | "transport"
  | "drone";

export const CATEGORY_SILHOUETTE: Record<ShipCategory, SilhouetteKind> = {
  Fighters: "fighter",
  Destroyers: "destroyer",
  "Heavy Destroyers": "heavyDestroyer",
  Cruisers: "cruiser",
  Carriers: "carrier",
  Dreadnoughts: "dreadnought",
  "Supercapital Ships": "supercapital",
  "Ghost Ships": "ghost",
  "Support Ships": "support",
  "Marine Transports": "transport",
  "Autonomous Drone Ships": "drone",
};

const ACCENTS = {
  cyan: "#00e5ff",
  violet: "#a78bfa",
  magenta: "#f472b6",
  gold: "#e6a817",
  green: "#2dff88",
  amber: "#fbbf24",
  teal: "#2dd4bf",
  red: "#f87171",
  blue: "#60a5fa",
  slate: "#cbd5e1",
} as const;

export type ShipAccent = keyof typeof ACCENTS;

export const SHIP_CLASS_ACCENT: Record<string, ShipAccent> = {
  // Fighters
  Sagittarius: "cyan",
  Werewolf: "red",
  Mustang: "gold",
  Orion: "blue",
  "Stellar Bat": "slate",
  Matrix: "violet",
  "Sagittarius-II": "teal",
  "Werewolf-II": "amber",
  "Mustang-II": "cyan",
  // Destroyers
  "Ion Raptor": "violet",
  "Solar Cutter": "gold",
  Ghostflare: "magenta",
  "Vortex Hound": "red",
  CryoJackal: "teal",
  // Heavy Destroyers
  "Graviton Breaker": "amber",
  "Darkstar Reaver": "magenta",
  "Solar Pike": "gold",
  "Entropy Fang": "violet",
  // Cruisers
  "Ion Tempest": "cyan",
  "Quantum Herald": "blue",
  "Solaris Spear": "gold",
  GravSeraph: "teal",
  // Carriers
  "Nebula Citadel": "violet",
  "Astral Ark": "blue",
  "Pulse Cathedral": "magenta",
  "Slipstream Haven": "cyan",
  // Dreadnoughts
  "Eclipse Leviathan": "magenta",
  "Starforge Colossus": "amber",
  "Chrono Dominion": "teal",
  "Void Imperator": "violet",
  // Supercapital Ships
  "Astral Citadel": "cyan",
  "Nebula Cathedral": "blue",
  "Slipstream Sanctum": "teal",
  "Pulse Pantheon": "magenta",
  "Starforge Basilica": "gold",
  "Entropy Spire": "violet",
  CryoEclipse: "teal",
  "Thunder Colossus": "amber",
  "Solar Harbinger": "gold",
  "Aether Crucifix": "slate",
  // Ghost Ships
  "Whisper Shade": "slate",
  "Silent Echo": "violet",
  "Dark Signal": "magenta",
  "Phantom Reach": "teal",
  // Support Ships
  "Mercy Horizon": "green",
  "Atlas Forge": "gold",
  "Titan Harbor": "blue",
  "Sanctuary Light": "cyan",
  "Iron Citadel": "slate",
  // Marine Transports
  Zodiax: "red",
  // Autonomous Drone Ships
  "Machine Prophet": "green",
  "Synthetic Dominion": "violet",
  "Hollow Signal": "slate",
};

export const SHIP_ACCENT_HEX: Record<ShipAccent, string> = ACCENTS;

export function getShipCategory(className: string | null | undefined): ShipCategory | null {
  if (!className) return null;
  for (const cat of SHIP_CATEGORIES) {
    if (SHIP_CLASSES_BY_CATEGORY[cat].includes(className)) return cat;
  }
  return null;
}

export function getShipAccent(className: string | null | undefined): ShipAccent {
  if (className && SHIP_CLASS_ACCENT[className]) return SHIP_CLASS_ACCENT[className];
  return "cyan";
}

// ---------------------------------------------------------------------------
// Ship-class missions — deterministic, generated from per-category templates.
// Difficulty / rewards / flair / tags are part of each mission so the Mission
// Intelligence module can render them without a database round-trip.
// ---------------------------------------------------------------------------

export interface ShipMission {
  id: string;
  title: string;
  difficulty: "Recruit" | "Standard" | "Elite" | "Flagship";
  xp: number;
  credits: number;
  flair: string;
  tags: string[];
}

const MISSION_TEMPLATES: Record<ShipCategory, Omit<ShipMission, "id" | "title">[]> = {
  Fighters: [
    { difficulty: "Recruit", xp: 8, credits: 2, flair: "Intercept", tags: ["patrol", "intercept"] },
    { difficulty: "Standard", xp: 14, credits: 4, flair: "Dogfight", tags: ["combat", "escort"] },
    { difficulty: "Elite", xp: 24, credits: 8, flair: "Ace", tags: ["ace", "strike"] },
    { difficulty: "Standard", xp: 12, credits: 3, flair: "Recon", tags: ["recon", "scout"] },
  ],
  Destroyers: [
    { difficulty: "Recruit", xp: 10, credits: 3, flair: "Patrol", tags: ["patrol", "screening"] },
    { difficulty: "Standard", xp: 16, credits: 5, flair: "Linebreaker", tags: ["assault", "fleet"] },
    { difficulty: "Elite", xp: 26, credits: 9, flair: "Broadside", tags: ["siege", "bombardment"] },
    { difficulty: "Standard", xp: 14, credits: 4, flair: "Escort", tags: ["escort", "convoy"] },
  ],
  "Heavy Destroyers": [
    { difficulty: "Recruit", xp: 12, credits: 4, flair: "Vanguard", tags: ["vanguard", "assault"] },
    { difficulty: "Standard", xp: 18, credits: 6, flair: "Siegebreaker", tags: ["siege", "bombardment"] },
    { difficulty: "Elite", xp: 28, credits: 10, flair: "Reaver", tags: ["assault", "flagship"] },
    { difficulty: "Standard", xp: 15, credits: 5, flair: "Flotilla", tags: ["fleet", "escort"] },
  ],
  Cruisers: [
    { difficulty: "Recruit", xp: 12, credits: 4, flair: "Diplomacy", tags: ["patrol", "diplomatic"] },
    { difficulty: "Standard", xp: 18, credits: 6, flair: "Spearhead", tags: ["assault", "command"] },
    { difficulty: "Elite", xp: 30, credits: 11, flair: "Tempest", tags: ["siege", "flagship"] },
    { difficulty: "Standard", xp: 16, credits: 5, flair: "Herald", tags: ["recon", "survey"] },
  ],
  Carriers: [
    { difficulty: "Recruit", xp: 14, credits: 5, flair: "Deck Ops", tags: ["support", "deployment"] },
    { difficulty: "Standard", xp: 22, credits: 8, flair: "Strike Wing", tags: ["assault", "deployment"] },
    { difficulty: "Elite", xp: 34, credits: 13, flair: "Citadel", tags: ["command", "flagship"] },
    { difficulty: "Standard", xp: 18, credits: 6, flair: "Resupply", tags: ["support", "logistics"] },
  ],
  Dreadnoughts: [
    { difficulty: "Recruit", xp: 16, credits: 6, flair: "Deterrence", tags: ["patrol", "deterrence"] },
    { difficulty: "Standard", xp: 26, credits: 10, flair: "Orbital Strike", tags: ["siege", "bombardment"] },
    { difficulty: "Elite", xp: 40, credits: 16, flair: "Colossus", tags: ["flagship", "command"] },
    { difficulty: "Flagship", xp: 60, credits: 25, flair: "Dominion", tags: ["flagship", "siege", "command"] },
  ],
  "Supercapital Ships": [
    { difficulty: "Recruit", xp: 20, credits: 8, flair: "Parade", tags: ["ceremony", "fleet"] },
    { difficulty: "Standard", xp: 30, credits: 12, flair: "Pantheon", tags: ["command", "fleet"] },
    { difficulty: "Elite", xp: 45, credits: 18, flair: "Basilica", tags: ["flagship", "siege"] },
    { difficulty: "Flagship", xp: 75, credits: 30, flair: "Sanctum", tags: ["flagship", "command"] },
  ],
  "Ghost Ships": [
    { difficulty: "Recruit", xp: 12, credits: 4, flair: "Shadow Run", tags: ["stealth", "recon"] },
    { difficulty: "Standard", xp: 20, credits: 7, flair: "Silent Echo", tags: ["stealth", "assault"] },
    { difficulty: "Elite", xp: 32, credits: 12, flair: "Phantom", tags: ["stealth", "flagship"] },
    { difficulty: "Standard", xp: 16, credits: 5, flair: "Dark Signal", tags: ["stealth", "signal"] },
  ],
  "Support Ships": [
    { difficulty: "Recruit", xp: 10, credits: 4, flair: "Medevac", tags: ["support", "rescue"] },
    { difficulty: "Standard", xp: 16, credits: 6, flair: "Forge Run", tags: ["support", "logistics"] },
    { difficulty: "Elite", xp: 26, credits: 10, flair: "Sanctuary", tags: ["support", "flagship"] },
    { difficulty: "Standard", xp: 14, credits: 5, flair: "Harbor", tags: ["support", "refit"] },
  ],
  "Marine Transports": [
    { difficulty: "Recruit", xp: 10, credits: 3, flair: "Boarding", tags: ["assault", "boarding"] },
    { difficulty: "Standard", xp: 18, credits: 6, flair: "Assault Drop", tags: ["assault", "deployment"] },
    { difficulty: "Elite", xp: 28, credits: 10, flair: "Zodiax", tags: ["assault", "flagship"] },
    { difficulty: "Standard", xp: 14, credits: 4, flair: "Extraction", tags: ["rescue", "deployment"] },
  ],
  "Autonomous Drone Ships": [
    { difficulty: "Recruit", xp: 10, credits: 3, flair: "Swarm Ops", tags: ["drone", "patrol"] },
    { difficulty: "Standard", xp: 18, credits: 6, flair: "Hive Mind", tags: ["drone", "assault"] },
    { difficulty: "Elite", xp: 30, credits: 11, flair: "Machine Prophet", tags: ["drone", "flagship"] },
    { difficulty: "Standard", xp: 15, credits: 5, flair: "Relay", tags: ["drone", "recon"] },
  ],
};

export function getShipMissionsForClass(
  className: string | null | undefined,
): ShipMission[] {
  const category = getShipCategory(className);
  if (!category) return [];
  const templates = MISSION_TEMPLATES[category];
  return templates.map((t, i) => ({
    ...t,
    id: `ship:${className}:${i}`,
    title: `${className} ${t.flair}`,
  }));
}

export function shipMissionTitle(missionId: string): string {
  // ship:<ClassName>:<n>
  const parts = missionId.split(":");
  if (parts.length !== 3 || parts[0] !== "ship") return missionId;
  const className = parts[1];
  const idx = Number(parts[2]);
  const mission = getShipMissionsForClass(className)[idx];
  return mission ? mission.title : missionId;
}