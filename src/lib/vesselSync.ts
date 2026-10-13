// ===========================================================================
// Fleet database → operator-console vessel mapping
//
// The fleet registry (fleetregistry.starforcebase1198.com) is the source of
// truth for the fleet — that is where Fleet Command edits ships. The operator
// console's vessel list is a mirror of it, reseeded by the "Seed vessels"
// button (see `syncFromRegistry` in src/convex/vessels.ts). Records arrive
// without the site's display vocabulary (`name`, `badge`), with `role` null on
// small craft, and with numbers where the schema stores strings, so they are
// normalized here — in one place, shared by the console UI and anything else
// that needs to build a sync payload.
// ===========================================================================

import type { RegistryVesselRecord } from "@/lib/fleetRegistry";

/** Ordered hull rules — the first match on class, then on role, wins. */
const BADGE_RULES: [RegExp, string][] = [
  [/flagship/i, "FLAGSHIP"],
  [/carrier/i, "CARRIER"],
  [/dreadnaught|dreadnought/i, "DREADNAUGHT"],
  [/battleship/i, "BATTLESHIP"],
  [/destroyer/i, "DESTROYER"],
  [/frigate/i, "FRIGATE"],
  [/corvette/i, "CORVETTE"],
  [/transport/i, "TRANSPORT"],
  [/medical|hospital/i, "MEDICAL"],
  [/repair|drydock|industrial/i, "INDUSTRIAL"],
  [/suppression|enforcer/i, "SUPPRESSION"],
  [/drone|swarm/i, "DRONE"],
  [/ghost ship|stealth/i, "STEALTH"],
  [/interceptor/i, "INTERCEPTOR"],
  [/strike/i, "STRIKE"],
  [/fighter/i, "FIGHTER"],
  [/escort/i, "ESCORT"],
];

/** Trimmed string (numbers stringified); empty / nullish → undefined. */
function text(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function deriveBadge(shipClass?: string, role?: string): string {
  for (const source of [shipClass, role]) {
    if (!source) continue;
    for (const [pattern, badge] of BADGE_RULES) {
      if (pattern.test(source)) return badge;
    }
  }
  return "ESCORT";
}

/**
 * "MK Σ31 ASTRAL RAZOR" → "ASTRAL RAZOR", "F 5000X SAGITTARIUS" →
 * "SAGITTARIUS". Only leading code tokens (digits, 1–3 letter codes, dotted
 * initials) are stripped, and never the last token, so real names survive.
 */
function deriveName(designation: string): string {
  const tokens = designation.trim().split(/\s+/);
  let i = 0;
  while (i < tokens.length - 1) {
    const token = tokens[i];
    const isCode =
      /\d/.test(token) ||
      /^[A-Za-z]{1,3}$/.test(token) ||
      (token.includes(".") && /^[A-Za-z.]{1,6}$/.test(token));
    if (!isCode) break;
    i++;
  }
  return tokens.slice(i).join(" ");
}

/** One registry record → one console vessel row, or null when unusable. */
export function toVesselInput(record: RegistryVesselRecord) {
  const designation = text(record.designation);
  if (!designation) return null;
  const shipClass = text(record.shipClass);
  const role = text(record.role) ?? shipClass ?? "Fleet vessel";
  const armament = [text(record.primaryArmament), text(record.secondaryArmament)]
    .filter(Boolean)
    .join("; ");
  const warp = text(record.warpSpeed);
  const sublight = text(record.sublightSpeed);
  return {
    designation,
    name: text(record.name) ?? deriveName(designation),
    badge: text(record.badge) ?? deriveBadge(shipClass, role),
    shipClass,
    registry: text(record.registryNumber),
    role,
    crew: text(record.crew),
    armament: armament || undefined,
    notes: text(record.notes),
    hullLength: text(record.hullLength),
    hullWidth: text(record.hullWidth),
    decks: text(record.decks),
    weight: text(record.weight),
    acceleration:
      [warp, sublight ? `SUBLIGHT ${sublight}` : ""].filter(Boolean).join(" · ") ||
      undefined,
    status: (text(record.status) ?? "active").toLowerCase(),
    builder: text(record.builder),
    fleet: text(record.fleet),
    commissionDate: text(record.commissionDate),
    armor: text(record.armor),
    propulsion: text(record.propulsion),
    capabilities: text(record.capabilities),
    maneuverability: text(record.maneuverability),
    computer: text(record.computer),
    primaryArmament: text(record.primaryArmament),
    secondaryArmament: text(record.secondaryArmament),
    defensiveSystems: text(record.defensiveSystems),
  };
}
