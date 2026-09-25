// =========================================================================
// Ultra Force faction catalog.
//
// Single source of truth for the canon faction registry. Shared between
// the Convex backend (seed + validation) and the Operator Console UI.
// Factions are grouped into four canon categories; every faction carries
// a name, slug, accent color (Ultra Force palette), lucide icon name,
// and immersive canon description.
//
// The species category holds the full "Delegate Species of the Orion
// Triangle" charter (src/lib/species-canon-1.ts + species-canon-2.ts),
// transcribed verbatim from the canon document.
// =========================================================================

import { SPECIES_FACTIONS_1 } from "./species-canon-1";
import { SPECIES_FACTIONS_2 } from "./species-canon-2";

export type FactionCategoryKey = "internal" | "orion" | "fleet" | "species";

export interface FactionCategory {
  key: FactionCategoryKey;
  label: string;
  short: string;
  accent: string;
  blurb: string;
}

export interface FactionSeed {
  name: string;
  slug: string;
  category: FactionCategoryKey;
  description: string;
  accent: string;
  icon?: string;
  order: number;
  /** Registry annotation for charter duplicates (not persisted). */
  nameNote?: string;
}

export const FACTION_CATEGORIES: FactionCategory[] = [
  {
    key: "internal",
    label: "Internal Human Factions",
    short: "Human factions",
    accent: "#00E5FF",
    blurb: "The powers that shape humanity's presence in the spiral — from the core fleets to the frontier coalitions.",
  },
  {
    key: "orion",
    label: "Orion Triangle Government Bodies",
    short: "Orion bodies",
    accent: "#E6A817",
    blurb: "The ruling councils and ministries of the Orion Triangle, where policy, law, and culture intersect.",
  },
  {
    key: "fleet",
    label: "Fleet Structures",
    short: "Fleet structures",
    accent: "#1E88E5",
    blurb: "The command architectures, strike wings, and divisions that make up the armed arm of the Ultra Force.",
  },
  {
    key: "species",
    label: "Delegate Species of the Orion Triangle",
    short: "Species",
    accent: "#7A2BD9",
    blurb: "The delegate species of the Orion Triangle — each with its own homeworld, evolutionary environment, and place in Star Force's ranks. Each world keeps its own self-designation; the names below are the registry's own.",
  },
];

export const SEED_FACTIONS: FactionSeed[] = [
  // ---- Internal Human Factions ------------------------------------------
  {
    name: "Star Force",
    slug: "star-force",
    category: "internal",
    description:
      "The primary human military authority — the shield and spear of the species across charted space. Every cadet who enlists is sworn into its ranks before ever seeing a bridge.",
    accent: "#00E5FF",
    icon: "shield",
    order: 1,
  },
  {
    name: "Space Marines",
    slug: "space-marines",
    category: "internal",
    description:
      "Boarding specialists and ground-pounder elite. Where the fleet fights from the void, the Marines take and hold the deck — close, fast, and with extreme prejudice.",
    accent: "#F77F2A",
    icon: "crosshair",
    order: 2,
  },
  {
    name: "G.I.A.",
    slug: "gia",
    category: "internal",
    description:
      "The Galactic Intelligence Agency. Analysts, operatives, and ghosts who move ahead of every fleet action — collecting, denying, and occasionally rewriting the truth of what happened.",
    accent: "#7A2BD9",
    icon: "eye",
    order: 3,
  },
  {
    name: "Special Forces",
    slug: "special-forces",
    category: "internal",
    description:
      "The quiet end of the spear. Special Forces units answer to no garrison and appear where the chain of command would rather not be seen — surgical, deniable, and devastating.",
    accent: "#E6A817",
    icon: "zap",
    order: 4,
  },
  {
    name: "Outer Rim Coalition",
    slug: "outer-rim-coalition",
    category: "internal",
    description:
      "The frontier alliance of independent colonies, free ports, and deep-space stations. Loose, pragmatic, and fiercely self-governing — the Coalition trades with the fleet, but answers to no capital.",
    accent: "#0FE2C0",
    icon: "orbit",
    order: 5,
  },

  // ---- Orion Triangle Government Bodies -----------------------------------
  {
    name: "Orion High Council",
    slug: "orion-high-council",
    category: "orion",
    description:
      "The seat of civilian authority in the Orion Triangle. The High Council sets policy, ratifies fleet doctrine, and speaks for the species in the great assemblies of the galaxy.",
    accent: "#E6A817",
    icon: "landmark",
    order: 1,
  },
  {
    name: "Triumvirate Council",
    slug: "triumvirate-council",
    category: "orion",
    description:
      "Three voices, one ruling body. The Triumvirate arbitrates between the military, the ministries, and the colonies — a balance of power that has held the Triangle stable for generations.",
    accent: "#F7C948",
    icon: "scale",
    order: 2,
  },
  {
    name: "Ministries",
    slug: "ministries",
    category: "orion",
    description:
      "The administrative engine of the Triangle — diplomacy, commerce, science, and law all flow through the ministries. Bureaucrats by title, but they move the galaxy by paperwork.",
    accent: "#A78BFA",
    icon: "building2",
    order: 3,
  },
  {
    name: "Dawnwardens",
    slug: "dawnwardens",
    category: "orion",
    description:
      "The ceremonial guardians of the Triangle's founding charter. Part historians, part wardens, they keep the old oaths and remind every administration what the dawn of the accord cost.",
    accent: "#FFD166",
    icon: "sun",
    order: 4,
  },
  {
    name: "Aru'areth Cultural Units",
    slug: "arureath-cultural-units",
    category: "orion",
    description:
      "The official cultural delegations of the Aru'areth people within the Triangle — keepers of tradition, art, and the long memory of a species that measures history in millennia.",
    accent: "#C084FC",
    icon: "star",
    order: 5,
  },

  // ---- Fleet Structures ----------------------------------------------------
  {
    name: "Ultra Force",
    slug: "ultra-force",
    category: "fleet",
    description:
      "The grand unified fleet itself — every hull, crew, and cadet under one banner. The Ultra Force is the largest armed expedition humanity has ever assembled.",
    accent: "#00E5FF",
    icon: "rocket",
    order: 1,
  },
  {
    name: "1st Inter-Dimensional Fleet",
    slug: "1st-interdimensional-fleet",
    category: "fleet",
    description:
      "The flagship formation tasked with transit, survey, and defense across dimensional boundaries. Where other fleets patrol space, the 1st patrols the spaces between spaces.",
    accent: "#1E88E5",
    icon: "layers",
    order: 2,
  },
  {
    name: "Command Groups",
    slug: "command-groups",
    category: "fleet",
    description:
      "The strategic nerve centers of the fleet — flag bridges, coordination decks, and the officers who turn doctrine into deployment. Command Groups are where campaigns are won before a shot is fired.",
    accent: "#38BDF8",
    icon: "command",
    order: 3,
  },
  {
    name: "Strike Wings",
    slug: "strike-wings",
    category: "fleet",
    description:
      "Fast, hard-hitting carrier formations built around fighters and assault craft. Strike Wings are the fleet's first response — in-system before the alarm finishes sounding.",
    accent: "#F77F2A",
    icon: "zap",
    order: 4,
  },
  {
    name: "Marine Divisions",
    slug: "marine-divisions",
    category: "fleet",
    description:
      "The embarked ground forces of the fleet, organized into divisions that ride with every major battlegroup. They garrison, they assault, and they hold.",
    accent: "#EF4444",
    icon: "swords",
    order: 5,
  },
  {
    name: "Suppression Flotillas",
    slug: "suppression-flotillas",
    category: "fleet",
    description:
      "Dedicated to blockade, interdiction, and fire support. Suppression Flotillas deny the enemy their space — no convoy moves, no lane opens, without their say.",
    accent: "#0EA5E9",
    icon: "waves",
    order: 6,
  },
  {
    name: "Ghost Ship Divisions",
    slug: "ghost-ship-divisions",
    category: "fleet",
    description:
      "The fleet's dark wings — stealth hulls, signal ghosts, and ships that official records insist do not exist. Ghost Ship Divisions operate where the light does not reach.",
    accent: "#A78BFA",
    icon: "ghost",
    order: 7,
  },

  // ---- Delegate Species of the Orion Triangle -------------------------------
  // The full canon species charter, transcribed verbatim
  // (src/lib/species-canon-1.ts + species-canon-2.ts). Entries are keyed by
  // slug, so re-seeding updates canon text in place without duplicating rows.
  ...SPECIES_FACTIONS_1,
  ...SPECIES_FACTIONS_2,
];

export const CATEGORY_MAP: Record<FactionCategoryKey, FactionCategory> =
  Object.fromEntries(FACTION_CATEGORIES.map((c) => [c.key, c])) as Record<
    FactionCategoryKey,
    FactionCategory
  >;

export function slugifyFactionName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidFactionCategory(key: string): key is FactionCategoryKey {
  return FACTION_CATEGORIES.some((c) => c.key === key);
}