// =========================================================================
// Star Credits (#8 — Ultra Force virtual currency) — shared data module.
// Pure values only: imported by both the Convex backend (economy.ts) and
// the client (StarCreditsCard). No runtime imports, so it bundles safely
// on either side.
// =========================================================================

export const CREDIT_RATES = {
  storyPublished: 100,
  loreApproved: 25,
  discoveryApproved: 25,
  missionReport: 10,
  comment: 5,
} as const;

// Cosmetic Lab catalog — profile frame tints purchasable with Star Credits.
export const FRAME_CATALOG: Record<
  string,
  { label: string; description: string; cost: number; colors: [string, string, string] }
> = {
  cyan: {
    label: "Ion Frame",
    description: "Standard fleet trim, charged cyan.",
    cost: 250,
    colors: ["#00e5ff", "#2563eb", "#00e5ff"],
  },
  violet: {
    label: "Void Frame",
    description: "G.I.A. deep-space resonance trim.",
    cost: 350,
    colors: ["#8b5cf6", "#d946ef", "#8b5cf6"],
  },
  green: {
    label: "Terra Frame",
    description: "Starforge Union planetary trim.",
    cost: 400,
    colors: ["#2dff88", "#14b8a6", "#2dff88"],
  },
  gold: {
    label: "Admiral Frame",
    description: "Command-tier ceremonial trim.",
    cost: 500,
    colors: ["#e6a817", "#ffb300", "#e6a817"],
  },
};

export type FrameId = keyof typeof FRAME_CATALOG;

// =========================================================================
// Titles — earned-or-purchased name flairs rendered next to the display
// name on profiles and bylines. `mission` titles are operator-granted only
// (never purchasable); the rest are Cosmetic Lab stock.
// =========================================================================

export interface TitleSpec {
  label: string;
  description: string;
  /** Cost in Star Credits; null = operator-granted only (mission line). */
  cost: number | null;
  /** Tailwind-safe inline color for the badge text. */
  color: string;
}

export const TITLE_CATALOG: Record<string, TitleSpec> = {
  signal_warden: {
    label: "Signal Warden",
    description: "For those who listen where others hear static.",
    cost: 300,
    color: "#00e5ff",
  },
  void_cartographer: {
    label: "Void Cartographer",
    description: "Charts the uncharted, names the unnamed.",
    cost: 450,
    color: "#8b5cf6",
  },
  starforge_smith: {
    label: "Starforge Smith",
    description: "Builds what the fleet flies.",
    cost: 450,
    color: "#2dff88",
  },
  deep_canon: {
    label: "Keeper of the Deep Canon",
    description: "The archive answers to them.",
    cost: 900,
    color: "#e6a817",
  },
  // Mission line — never purchasable. Operators award via the console.
  fleet_honor: {
    label: "Fleet Honor",
    description: "Awarded by command for distinguished service.",
    cost: null,
    color: "#ff3df2",
  },
  signal_legend: {
    label: "Signal Legend",
    description: "Their transmissions are studied, not just read.",
    cost: null,
    color: "#ff3df2",
  },
};

export type TitleId = keyof typeof TITLE_CATALOG;

// =========================================================================
// Boosts — consumables. Buying extends an expiry timestamp; effects apply
// server-side at every XP/credit grant site so they can't be faked.
// =========================================================================

export interface BoostSpec {
  label: string;
  description: string;
  cost: number;
  /** Duration the boost stays active, in hours. */
  hours: number;
  color: string;
}

export const BOOST_CATALOG: Record<string, BoostSpec> = {
  xp_surge: {
    label: "XP Surge",
    description: "Double XP from every mission, quest, and signal for 24 hours.",
    cost: 500,
    hours: 24,
    color: "#00e5ff",
  },
  credit_surge: {
    label: "Credit Surge",
    description: "Double Star Credits from all earnings for 24 hours.",
    cost: 750,
    hours: 24,
    color: "#e6a817",
  },
};

export type BoostId = keyof typeof BOOST_CATALOG;

// =========================================================================
// Weekly rotation — the Cosmetic Lab shelf. Deterministic ISO-week pick so
// every member sees the same shelf all week without a cron or config table.
// Titles in the mission line (cost: null) and the base frame set always
// stay listed; rotation adds variety by surfacing a shifting spotlight pair.
// =========================================================================

export function isoWeekKey(now = Date.now()): string {
  const d = new Date(now);
  // Thursday-based ISO week: shift so week boundaries align, then floor.
  const dayMs = 86_400_000;
  const thursday = new Date(d.getTime() + ((4 - (d.getUTCDay() || 7)) % 7) * dayMs);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / (7 * dayMs)) + 1;
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Stable hash so the rotation is deterministic for the whole fleet. */
function weekHash(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * The rotation spotlight: one frame + one title featured this week.
 * Deterministic per ISO week — same result for every client, no server call.
 */
export function weeklySpotlight(now = Date.now()): {
  frame: FrameId;
  title: TitleId;
  weekKey: string;
} {
  const weekKey = isoWeekKey(now);
  const purchasableTitles = (Object.keys(TITLE_CATALOG) as TitleId[]).filter(
    (id) => TITLE_CATALOG[id].cost !== null,
  );
  const frameIds = Object.keys(FRAME_CATALOG) as FrameId[];
  return {
    weekKey,
    frame: frameIds[weekHash(weekKey, 1) % frameIds.length],
    title: purchasableTitles[weekHash(weekKey, 2) % purchasableTitles.length],
  };
}
