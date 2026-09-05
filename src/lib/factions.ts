// =========================================================================
// Ultra Force faction catalog.
//
// Single source of truth for the canon faction registry. Shared between
// the Convex backend (seed + validation) and the Operator Console UI.
// Factions are grouped into four canon categories; every faction carries
// a name, slug, accent color (Ultra Force palette), lucide icon name,
// and immersive canon description.
// =========================================================================

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
    label: "Species Groups",
    short: "Species",
    accent: "#7A2BD9",
    blurb: "The peoples and cultures of the galaxy — each with its own biology, history, and place in the canon.",
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

  // ---- Species Groups -------------------------------------------------------
  {
    name: "Velkarian",
    slug: "velkarian",
    category: "species",
    description:
      "A warrior people whose honor codes shape every treaty they sign. Velkarian crews are prized across the fleet for their discipline and their terrifying focus in battle.",
    accent: "#C084FC",
    icon: "swords",
    order: 1,
  },
  {
    name: "Helioxian",
    slug: "helioxian",
    category: "species",
    description:
      "Starborn and solar-blessed, the Helioxians are navigators and cartographers without equal. Their elders claim to read the gravity wells the way others read text.",
    accent: "#FFD166",
    icon: "sun",
    order: 2,
  },
  {
    name: "Kethari",
    slug: "kethari",
    category: "species",
    description:
      "A nocturnal species of patient hunters and archivists. Kethari memory-keepers serve as the canon's most exacting librarians — they forget nothing, and forgive slowly.",
    accent: "#94A3B8",
    icon: "moon",
    order: 3,
  },
  {
    name: "Auroran",
    slug: "auroran",
    category: "species",
    description:
      "Artists, diplomats, and light-weavers from the polar worlds. Auroran ships are famous for their beauty and their sudden, gorgeous violence when pushed to war.",
    accent: "#0FE2C0",
    icon: "sparkles",
    order: 4,
  },
  {
    name: "Chronari",
    slug: "chronari",
    category: "species",
    description:
      "Keepers of the long now. The Chronari measure engagements in centuries and alliances in eons — a people whose patience makes empires look impatient.",
    accent: "#22D3EE",
    icon: "clock",
    order: 5,
  },
  {
    name: "Gravethari",
    slug: "gravethari",
    category: "species",
    description:
      "Massive, slow-speaking beings born under crushing gravity. Gravethari engineers build the fleet's heaviest structures — they think in foundations, not fixtures.",
    accent: "#F77F2A",
    icon: "weight",
    order: 6,
  },
  {
    name: "Silthari",
    slug: "silthari",
    category: "species",
    description:
      "A lithe, melodic species of the high canyons. Silthari vox-weavers serve as the fleet's finest signal corps — their language is half song, and their code is unbreakable.",
    accent: "#E879F9",
    icon: "feather",
    order: 7,
  },
  {
    name: "Myr-Kael",
    slug: "myr-kael",
    category: "species",
    description:
      "Forge-born and fire-tempered, the Myr-Kael are the fleet's preeminent shipwrights. A Myr-Kael hull is a promise written in alloy: it will bring you home.",
    accent: "#EF4444",
    icon: "flame",
    order: 8,
  },
  {
    name: "Veyrathi",
    slug: "veyrathi",
    category: "species",
    description:
      "Winged riders of the storm belts, the Veyrathi are scouts and couriers without peer. Their reflexes blur the line between pilot and ship.",
    accent: "#7DD3FC",
    icon: "wind",
    order: 9,
  },
  {
    name: "Auralith",
    slug: "auralith",
    category: "species",
    description:
      "Crystal-born philosophers of the deep mines. Auralith resonators attune the fleet's jump drives — their hum is the sound of a species remembering its song.",
    accent: "#34D399",
    icon: "gem",
    order: 10,
  },
  {
    name: "Umbraxi",
    slug: "umbraxi",
    category: "species",
    description:
      "Shadow-dwellers who hunt in the dark between stars. Umbraxi operatives are the quiet answer to questions no one wants asked.",
    accent: "#8B5CF6",
    icon: "eclipse",
    order: 11,
  },
  {
    name: "Nythori",
    slug: "nythori",
    category: "species",
    description:
      "A contemplative people of the ice moons, given to prophecy and long silences. Nythori observers ride on every major campaign, watching the shape of what comes.",
    accent: "#818CF8",
    icon: "moon-star",
    order: 12,
  },
  {
    name: "Orvaxian",
    slug: "orvaxian",
    category: "species",
    description:
      "Highland herdsmen turned shock troops. Orvaxian infantry are famed for their stamina — they can outmarch logistics and still win the ridge.",
    accent: "#FBBF24",
    icon: "mountain",
    order: 13,
  },
  {
    name: "Vedan",
    slug: "vedan",
    category: "species",
    description:
      "Amphibious engineers of the tidal worlds. Vedan salvage crews are the fleet's miracle workers — they can raise a ship from a reef and have it flying by morning.",
    accent: "#60A5FA",
    icon: "droplets",
    order: 14,
  },
  {
    name: "Lithovex",
    slug: "lithovex",
    category: "species",
    description:
      "A young, adaptable species from the mineral belts, quick to learn and quicker to volunteer. Lithovex cadets are among the most enthusiastic recruits in the academy.",
    accent: "#A3E635",
    icon: "box",
    order: 15,
  },
  {
    name: "Aru'areth",
    slug: "arureath",
    category: "species",
    description:
      "An ancient people of the deep spiral, long-lived and long-memoried. The Aru'areth remember every star that ever burned in their skies — and the fleet listens when they speak.",
    accent: "#C084FC",
    icon: "star",
    order: 16,
  },
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