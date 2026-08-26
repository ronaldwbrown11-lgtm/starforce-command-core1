/**
 * Canonical Ultra Force / Star Force Base 1198 tier definitions.
 *
 * This is the single source of truth for tier metadata on the
 * client + it's mirrored by the `TIERS` + `tierValidator`
 * in `src/convex/schema.ts`. Keep both in sync.
 *
 * Pricing is in USD. Generations and storage are product limits.
 */

export const TIER_IDS = [
  "free",
  "cadet",
  "officer",
  "command",
  "gia_agent",
] as const;

export type TierId = (typeof TIER_IDS)[number];

export type Tier = {
  id: TierId;
  name: string;
  blurb: string;
  cycles: string | null; // null = free
  priceLabel: string | null;
  variant: "default" | "violet" | "cyan" | "gold";
  benefits: string[];
  aiGenerations: number; // monthly cap
  storageGb: number; // GB
  maxUploadMb: number; // MB
  flag: "free" | "standard" | "priority" | "top";
  cta: { label: string; href: string };
};

export const TIERS: Record<TierId, Tier> = {
  free: {
    id: "free",
    name: "Free Member",
    blurb: "Step inside the universe. Build your profile, join the public conversation, and start drafting your first drop.",
    cycles: null,
    priceLabel: "Free",
    variant: "default",
    benefits: [
      "Public group access",
      "Read open lore",
      "Comment + react",
      "Submit a story for review",
      "Podcast publishing",
      "Featured placement",
      "Private groups", // matches user data (note: free tier includes this per spec)
    ],
    aiGenerations: 10,
    storageGb: 0.5,
    maxUploadMb: 5,
    flag: "free",
    cta: { label: "Continue Mission", href: "/auth" },
  },
  cadet: {
    id: "cadet",
    name: "Cadet",
    blurb: "Your first clearance upgrade. Create more, store more, and collaborate in private rooms.",
    cycles: "/ month",
    priceLabel: "$5.00",
    variant: "cyan",
    benefits: [
      "100 AI generations / month",
      "5 GB storage",
      "50 MB max upload",
      "Private groups",
      "Podcast publishing",
      "Featured placement",
    ],
    aiGenerations: 100,
    storageGb: 5,
    maxUploadMb: 50,
    flag: "standard",
    cta: { label: "Promote to Cadet", href: "/auth" },
  },
  officer: {
    id: "officer",
    name: "Officer",
    blurb: "For steady creators, building consistent arcs.",
    cycles: "/ month",
    priceLabel: "$12.00",
    variant: "violet",
    benefits: [
      "300 AI generations / month",
      "15 GB storage",
      "100 MB max upload",
      "Private groups",
      "Podcast publishing",
      "Featured placement",
    ],
    aiGenerations: 300,
    storageGb: 15,
    maxUploadMb: 100,
    flag: "standard",
    cta: { label: "Promote to Officer", href: "/auth" },
  },
  command: {
    id: "command",
    name: "Command",
    blurb: "Run bigger operations — series releases, team collaborations, frequent drops.",
    cycles: "/ 30d",
    priceLabel: "$25.00",
    variant: "violet",
    benefits: [
      "750 AI generations / month",
      "40 GB storage",
      "200 MB max upload",
      "Private groups",
      "Podcast publishing",
      "Featured placement (priority)",
    ],
    aiGenerations: 750,
    storageGb: 40,
    maxUploadMb: 200,
    flag: "priority",
    cta: { label: "Take Command", href: "/auth" },
  },
  gia_agent: {
    id: "gia_agent",
    name: "G.I.A Agent",
    blurb: "Top-tier access for serious builders of the universe.",
    cycles: "/ 30d",
    priceLabel: "$49.00",
    variant: "gold",
    benefits: [
      "2000 AI generations / month",
      "100 GB storage",
      "500 MB max upload",
      "Private groups",
      "Podcast publishing",
      "Featured placement (top)",
    ],
    aiGenerations: 2000,
    storageGb: 100,
    maxUploadMb: 500,
    flag: "top",
    cta: { label: "Become G.I.A Agent", href: "/auth" },
  },
};

export const TIER_ORDER: TierId[] = ["free", "cadet", "officer", "command", "gia_agent"];

export const RANK_THRESHOLDS: Array<{ rank: string; xp: number }> = [
  { rank: "Recruit", xp: 0 },
  { rank: "Aspirant", xp: 500 },
  { rank: "Pilot", xp: 1500 },
  { rank: "Commander", xp: 4000 },
  { rank: "Captain", xp: 9000 },
  { rank: "Admiral", xp: 20000 },
];

export function tierLabel(id: TierId | null | undefined): string {
  if (!id) return "Free Member";
  return TIERS[id]?.name ?? id;
}

export function tierFlagPill(flag: "free" | "standard" | "priority" | "top") {
  switch (flag) {
    case "top":
      return { variant: "gold" as const, label: "Top placement" };
    case "priority":
      return { variant: "violet" as const, label: "Priority" };
    case "standard":
      return { variant: "info" as const, label: "Active" };
    case "free":
    default:
      return { variant: "default" as const, label: "Free" };
  }
}

export function tierPillVariant(id: TierId | null | undefined) {
  switch (id) {
    case "free":
      return "default" as const;
    case "cadet":
      return "info" as const;
    case "officer":
      return "violet" as const;
    case "command":
      return "violet" as const;
    case "gia_agent":
      return "gold" as const;
    default:
      return "default" as const;
  }
}

// Re-export canonical cap helpers so the frontend can mirror the backend (`src/convex/tiers.ts`).
export const TIER_CAPS_FRONTEND = {
  free: { aiCap: 10, storageGbCap: 0.5, maxUploadMbCap: 5 },
  cadet: { aiCap: 100, storageGbCap: 5, maxUploadMbCap: 50 },
  officer: { aiCap: 300, storageGbCap: 15, maxUploadMbCap: 100 },
  command: { aiCap: 750, storageGbCap: 40, maxUploadMbCap: 200 },
  gia_agent: { aiCap: 2000, storageGbCap: 100, maxUploadMbCap: 500 },
} as const;

export function getAiCap(id: TierId | null | undefined): number {
  if (!id) return TIER_CAPS_FRONTEND.free.aiCap;
  return (TIER_CAPS_FRONTEND as Record<string, { aiCap: number }>)[id]?.aiCap ?? TIER_CAPS_FRONTEND.free.aiCap;
}
export function getStorageCap(id: TierId | null | undefined): number {
  if (!id) return TIER_CAPS_FRONTEND.free.storageGbCap;
  return (TIER_CAPS_FRONTEND as Record<string, { storageGbCap: number }>)[id]?.storageGbCap ?? TIER_CAPS_FRONTEND.free.storageGbCap;
}
export function getMaxUploadMb(id: TierId | null | undefined): number {
  if (!id) return TIER_CAPS_FRONTEND.free.maxUploadMbCap;
  return (TIER_CAPS_FRONTEND as Record<string, { maxUploadMbCap: number }>)[id]?.maxUploadMbCap ?? TIER_CAPS_FRONTEND.free.maxUploadMbCap;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export type OveragePayload = {
  code: "ultraforce_overage_requires_confirm";
  kind?: "ai" | "storage";
  current: number;
  projected: number;
  cap: number;
  tier: TierId;
};

export function parseOverageError(message: string): OveragePayload | null {
  try {
    const parsed = JSON.parse(message);
    if (parsed && parsed.code === "ultraforce_overage_requires_confirm") {
      return parsed as OveragePayload;
    }
  } catch {
    // not JSON
  }
  return null;
}

export function formatPercent(used: number, cap: number): number {
  if (!cap || cap <= 0) return 0;
  return Math.min(999, Math.max(0, Math.round((used / cap) * 100)));
}
