/**
 * Canonical brand voice constants.
 *
 * Single source of truth for hero copy + voice rules. All public + operator
 * hero surfaces should read from here so a future rep swap is a one-line change.
 */
export const VOICE = {
  /** Top-line brand title used on /, /membership, and /operator hero. */
  heroTitle: "Enter the Ultra Force Universe",
  /** Standard hero lead — applies to /, /membership, and /operator. */
  heroLead:
    "Join the galaxy's greatest archive of stories, lore, and missions. Write canon alongside other operators, broadcast podcasts, and command your own corner of the universe.",
  /** Public hero eyebrow. */
  heroEyebrow: "Star Force Base 1198 — Communications Live",
  /** Membership hero eyebrow. */
  memberEyebrow: "Membership",
  /** Operator Console eyebrow. */
  operatorEyebrow: "Operator Console",
  /** Easter-egg bottom-right badge on /operator/dashboard. */
  easterEgg: "fleet status: scanning the universe",
} as const;

/**
 * Voice rules — used by /operator/references and `/operator` brand surfaces.
 * Display-only; not enforced at compile-time.
 */
export const VOICE_RULES: ReadonlyArray<{ ok: boolean; rule: string }> = [
  { ok: true, rule: "Use 'operator' (lowercase) for members; reserve 'founder' for top-tier (G.I.A Agent)." },
  { ok: true, rule: "Read tier names from `lib/tiers.ts` — never hardcode free/cadet/officer/command/gia_agent strings." },
  { ok: true, rule: "Pair every color-only status pill with a label; 'Overage' text is required alongside red." },
  { ok: true, rule: "Use Rajdhani (display) + Inter (body) via the existing tokens; do not introduce new fonts." },
  { ok: true, rule: "Hero CTA copy follows verb + object, e.g. 'See tiers', 'Open the Lore Scanner', 'Begin reading'." },
  { ok: false, rule: "Avoid marketing clichés: 'unleash', 'synergy', 'empower', 'transformative', 'game-changing'." },
  { ok: false, rule: "Avoid declaring statistics you haven't measured — no fake numbers in copy." },
  { ok: false, rule: "Avoid hex color literals in product copy. Color tokens only." },
  { ok: false, rule: "Do not introduce 'lore/AI/chatbot' style wording outside ear-marked contexts." },
] as const;

export type VoiceKey = keyof typeof VOICE;
