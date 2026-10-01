// =========================================================================
// Capped Star Force Progression System — canonical rank ladder & XP rules
//
// Single source of truth for the rank tiers, XP earning rates, the Rear
// Admiral seat cap, and inactivity decay. Imported by BOTH the Convex
// backend (`src/convex/economy.ts`, `src/convex/progression.ts`) and the
// frontend (`/high-command` dashboard, `social:rankProgress`), so the two
// sides can never drift apart.
//
// Spec (Deliverable A / section 1):
//   Tier  7  Ensign              0 XP    — entry rank; promoted by 100%
//                                           onboarding checklist completion
//   Tier  8  Lieutenant       1,500 XP    — XP tracking begins here
//   Tier  9  Lieutenant Cmdr  4,000 XP    — +2,500 from Lieutenant
//   Tier 10  Commander        9,000 XP    — +5,000 from Lt. Cmdr
//   Tier 11  Captain (Fleet) 23,000 XP    — +14,000 from Commander; holds
//                                           excess >35,000 as Prestige XP
//   Tier 13  Rear Admiral    35,000 XP    — FLAG OFFICER, hard cap of 10
//                                           active seats (tier 12 unused)
// =========================================================================

export type RankKey =
  | "ensign"
  | "lieutenant"
  | "lieutenant_commander"
  | "commander"
  | "captain"
  | "rear_admiral";

export interface RankSpec {
  key: RankKey;
  /** Spec tier number (7–11, 13 — tier 12 is intentionally unused). */
  tier: number;
  label: string;
  /** Short badge abbreviation shown on the rank chip. */
  short: string;
  /** Minimum TOTAL XP required to hold this rank. */
  minXp: number;
  /** Whether this rank is a flag-officer seat subject to the hard cap. */
  flagOfficer: boolean;
  blurb: string;
}

export const RANK_LADDER: RankSpec[] = [
  {
    key: "ensign",
    tier: 7,
    label: "Ensign",
    short: "ENS",
    minXp: 0,
    flagOfficer: false,
    blurb: "Entry rank on registration — promoted to Lieutenant at 100% onboarding checklist completion.",
  },
  {
    key: "lieutenant",
    tier: 8,
    label: "Lieutenant",
    short: "LT",
    minXp: 1500,
    flagOfficer: false,
    blurb: "1,500 total XP — the baseline rank where numerical XP tracking begins.",
  },
  {
    key: "lieutenant_commander",
    tier: 9,
    label: "Lieutenant Commander",
    short: "LT CMDR",
    minXp: 4000,
    flagOfficer: false,
    blurb: "4,000 total XP (+2,500 from Lieutenant).",
  },
  {
    key: "commander",
    tier: 10,
    label: "Commander",
    short: "CMDR",
    minXp: 9000,
    flagOfficer: false,
    blurb: "9,000 total XP (+5,000 from Lieutenant Commander).",
  },
  {
    key: "captain",
    tier: 11,
    label: "Captain (Fleet)",
    short: "CAPT",
    minXp: 23000,
    flagOfficer: false,
    blurb: "23,000 total XP (+14,000 from Commander). Excess XP above 35,000 is held as Prestige XP while waiting on the Rear Admiral Queue.",
  },
  {
    key: "rear_admiral",
    tier: 13,
    label: "Rear Admiral",
    short: "RADM",
    minXp: 35000,
    flagOfficer: true,
    blurb: "35,000 total XP minimum — FLAG OFFICER seat, hard cap of 10 active seats.",
  },
];

const RANK_BY_KEY: Record<string, RankSpec> = Object.fromEntries(
  RANK_LADDER.map((r) => [r.key, r]),
);

export function rankSpec(key: string | null | undefined): RankSpec {
  return (key && RANK_BY_KEY[key]) || RANK_BY_KEY.ensign;
}

/** Whether a string is a valid system rank key. */
export function isRankKey(key: string | null | undefined): key is RankKey {
  return !!key && Object.prototype.hasOwnProperty.call(RANK_BY_KEY, key);
}

// ---------------------------------------------------------------------------
// Constants (spec section 1.6 + section 2)
// ---------------------------------------------------------------------------

/** Minimum total XP for a Rear Admiral seat. */
export const FLAG_OFFICER_MIN_XP = 35000;
/** HARD CAP — maximum active Rear Admiral seats. */
export const ADMIRAL_SEAT_CAP = 10;
/** Consecutive days with zero XP before a seat is revoked (inactivity decay). */
export const ADMIRAL_INACTIVITY_DAYS = 45;
/** Hard cap on engagement XP that can be earned per UTC day. */
export const DAILY_XP_CAP = 50;

/** XP earning rates (spec section 2). Bounds are inclusive. */
export const XP_RATES = {
  daily: { min: 20, max: 30, label: "Daily activity & engagement" },
  weekly: { min: 100, max: 150, label: "Weekly operations & missions" },
  lore: { min: 150, max: 250, label: "Lore & encyclopedia submissions" },
  story: { min: 300, max: 500, label: "Published stories & canon submissions" },
  milestone: { min: 750, max: 750, label: "Featured bridge story pin" },
  other: { min: 0, max: Number.MAX_SAFE_INTEGER, label: "Fleet activity" },
} as const;

export type XpCategory = keyof typeof XP_RATES;

export const XP_CATEGORIES = Object.keys(XP_RATES) as XpCategory[];

/** Clamp a requested award into the spec'd band for its category. */
export function clampXpForCategory(category: XpCategory, amount: number): number {
  const rate = XP_RATES[category] ?? XP_RATES.other;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(Math.max(Math.round(amount), rate.min), rate.max);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** UTC calendar day key ("YYYY-MM-DD") — used for the daily XP cap ledger. */
export function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Highest rank reachable purely by total XP. Rear Admiral is NEVER returned
 * here — flag-officer seats are only granted through the Admiral Queue.
 */
export function rankForXp(xp: number): RankKey {
  let key: RankKey = "ensign";
  for (const r of RANK_LADDER) {
    if (r.flagOfficer) continue;
    if (xp >= r.minXp) key = r.key;
  }
  return key;
}

export interface DeriveRankInput {
  /** Member's total XP. */
  xp: number;
  /** Currently stored system rank key, if the progression system has run. */
  currentRankKey?: string | null;
  /** Whether the onboarding checklist is at 100% (derived from real activity). */
  checklistComplete?: boolean;
  /** Whether the member currently holds an active Rear Admiral seat. */
  seatActive?: boolean;
}

/**
 * Derive the rank a member should hold right now.
 *
 * Rules:
 *  1. An active Rear Admiral seat always wins (seat revocation is handled by
 *     the queue evaluator, which clears `seatActive`).
 *  2. Members with a stored `ensign` rank are GATED: they only reach
 *     Lieutenant through 100% onboarding checklist completion — XP alone
 *     cannot move an Ensign (spec section 1.1).
 *  3. Members the system has not stamped yet (legacy accounts that predate
 *     this ladder) fall back to the pure XP ladder, including the entry gate
 *     — XP already earned is never lost.
 *  4. XP never decreases, so a stored rank is never demoted by rule 3 except
 *     when a Rear Admiral loses their seat (falls back to the XP ladder,
 *     i.e. Captain (Fleet)).
 */
export function deriveRankKey(input: DeriveRankInput): RankKey | string {
  const { xp, checklistComplete = false, seatActive = false } = input;
  if (seatActive) return "rear_admiral";

  const byXp = rankForXp(xp);
  const currentKey = input.currentRankKey;
  // Operator-assigned ranks outside the canonical ladder (created in the
  // Rank Ladder console) are sticky: only the operator can change them —
  // XP evaluation never rewrites them.
  if (currentKey && !isRankKey(currentKey)) return currentKey;
  const current = isRankKey(currentKey) ? currentKey : null;

  if (current === "ensign") {
    if (checklistComplete) return xp >= RANK_LADDER[1].minXp ? byXp : "lieutenant";
    return "ensign";
  }

  if (current === "rear_admiral") {
    // Seat revoked (seatActive false) — fall back to the XP ladder.
    return byXp;
  }

  if (current) {
    const order = RANK_LADDER.map((r) => r.key);
    return order.indexOf(byXp) >= order.indexOf(current) ? byXp : current;
  }

  // Unstamped (legacy) account — trust the XP ladder.
  if (checklistComplete && byXp === "ensign") return "lieutenant";
  return byXp;
}

export interface RankProgressInfo {
  current: RankSpec;
  next: RankSpec | null;
  /** Total XP at which the next rank unlocks (null at the top). */
  target: number | null;
  /** XP still needed for the next rank (0 at the top). */
  needed: number;
  /** 0–100 progress toward the next rank. */
  percent: number;
}

/**
 * Progress from the member's current rank toward the next one. Ensigns
 * progress through the onboarding checklist instead of XP — callers should
 * substitute the checklist percentage when `current.key === "ensign"`.
 */
export function rankProgressInfo(rankKey: string | null | undefined, xp: number): RankProgressInfo {
  const current = rankSpec(rankKey ?? rankForXp(xp));
  const order = RANK_LADDER.map((r) => r.key);
  const idx = order.indexOf(current.key);
  const next = idx >= 0 && idx < RANK_LADDER.length - 1 ? RANK_LADDER[idx + 1] : null;
  if (!next) {
    return { current, next: null, target: null, needed: 0, percent: 100 };
  }
  // A checklist-promoted Lieutenant can sit below the nominal 1,500 XP floor;
  // anchor the range at the current XP so percent never goes negative.
  const base = Math.min(xp, current.minXp);
  const range = Math.max(1, next.minXp - base);
  const percent = Math.min(100, Math.max(0, Math.round(((xp - base) / range) * 100)));
  return {
    current,
    next,
    target: next.minXp,
    needed: Math.max(0, next.minXp - xp),
    percent,
  };
}

/**
 * Daily engagement XP award for a check-in streak — 20 XP at streak start,
 * scaling to the 30 XP ceiling by day 10 (spec band: 20–30/day).
 */
export function dailyActivityXp(streak: number): number {
  return 20 + Math.min(10, Math.floor(Math.max(0, streak) / 5) * 5);
}
