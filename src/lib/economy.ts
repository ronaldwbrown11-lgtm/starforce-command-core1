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
} as const;

export type FrameId = keyof typeof FRAME_CATALOG;
