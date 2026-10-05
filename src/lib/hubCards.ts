// ---------------------------------------------------------------------------
// Creator Hub command cards — the quick-link cards in the Resources section
// of /creator (The Forge of Canon).
//
// These defaults are (a) the fallback CreatorHub renders before any rows are
// seeded, and (b) the "Restore default cards" payload operators can push from
// the Content Desk → Hub cards tab to get an editable starting set.
// ---------------------------------------------------------------------------

export type HubCardSeed = {
  label: string;
  description: string;
  href: string;
  /** lucide key — see CARD_ICONS in CreatorHub / HUB_CARD_ICON_KEYS below. */
  icon: string;
  /** Group eyebrow. "Database" cards render in the databases row. */
  tag: string;
};

/** Every icon key the card editor offers (mapped to lucide in CreatorHub). */
export const HUB_CARD_ICON_KEYS = [
  "book",
  "user",
  "ship",
  "cpu",
  "map",
  "globe",
  "hourglass",
  "pen",
  "flag",
  "shield",
  "library",
  "target",
  "users",
  "rocket",
  "trophy",
  "sparkles",
] as const;

/**
 * The four lore databases (reference while drafting) + the reference shelf.
 * Destinations are the stylized database pages, not raw storage/Convex URLs.
 */
export const DEFAULT_HUB_CARDS: HubCardSeed[] = [
  // ---- The four databases ----------------------------------------------
  {
    label: "Personnel Archive",
    description:
      "Personnel dossiers and character sheets — pull a face from the roster straight into your entry.",
    href: "/lore/databases/lore-db-personnel-archive",
    icon: "user",
    tag: "Database",
  },
  {
    label: "Fleet Registry",
    description:
      "Vessel database: hull classes, armament sheets, and service histories.",
    href: "/lore/databases/lore-db-fleet-registry",
    icon: "ship",
    tag: "Database",
  },
  {
    label: "The Armory",
    description:
      "Base small-arms database — build stories, lore, and new weapons from the manifest.",
    href: "/lore/databases/the-armory",
    icon: "target",
    tag: "Database",
  },
  {
    label: "Heavy Armor and Artillery",
    description:
      "Armored vehicles and floating big-gun platforms of the fleet.",
    href: "/lore/databases/heavy-armor-and-artillery",
    icon: "shield",
    tag: "Database",
  },
  {
    label: "Species Database",
    description:
      "Biology Lab dossiers — physiology, culture, habitat, and canon notes for every species on file.",
    href: "/biology-lab",
    icon: "globe",
    tag: "Database",
  },
  {
    label: "Technology Database",
    description:
      "Research Lab records — specs, function, and field notes for every device in the canon.",
    href: "/research-lab",
    icon: "cpu",
    tag: "Database",
  },
  // ---- Reference shelf ---------------------------------------------------
  {
    label: "Universe Bible",
    description: "The operating canon, issued as documents.",
    href: "/lore",
    icon: "book",
    tag: "Reference",
  },
  {
    label: "Faction Profiles",
    description: "Powers, blocs, and command structures of the galaxy.",
    href: "/factions",
    icon: "flag",
    tag: "Reference",
  },
  {
    label: "Sector Maps",
    description: "Charts of every mapped region.",
    href: "/maps",
    icon: "map",
    tag: "Reference",
  },
  {
    label: "Star Atlas",
    description: "The interactive galaxy map.",
    href: "/map",
    icon: "globe",
    tag: "Reference",
  },
  {
    label: "Timeline",
    description: "Campaign arcs in chronological order.",
    href: "/arcs",
    icon: "hourglass",
    tag: "Reference",
  },
  {
    label: "Ship Blueprints",
    description: "Fleet registry and armament sheets.",
    href: "/fleet-registry",
    icon: "ship",
    tag: "Reference",
  },
  {
    label: "Style Guides",
    description: "Submission orders and house style — opens in the reader.",
    href: "/resources",
    icon: "pen",
    tag: "Reference",
  },
];
