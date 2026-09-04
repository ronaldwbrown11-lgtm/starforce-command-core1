"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { STATIC_IMAGES } from "./staticCovers";

// =========================================================================
// Demo seed for Star Force Base 1198.
//
// Public surface: `seed:seedDemo` (action). Idempotent on slugs /
// displayName. Pass `{ clear: true }` from the dashboard or CLI to wipe
// the seed tables before re-inserting.
//
// Public surface is unchanged from before — only the implementation
// moved from a single mutation to an action + internal-mutation
// helpers (see `seedHelpers.ts`). This split exists because
// `ctx.storage.store` is only callable from actions in this Convex
// runtime; the previous mutation crashed with "t.storage.store is not
// a function" when trying to upload procedural SVG covers.
//
// Run via (any of):
//   1. Dashboard → Functions tab → seed:seedDemo, args {"clear": true}
//   2. CLI: bunx convex run seed:seedDemo '{"clear": true}'
//   3. CLI (with deploy key): CONVEX_DEPLOY_KEY=… bunx convex run seed:seedDemo '"…\"'
// =========================================================================

// ---- Cover SVG generation -----------------------------------------------

const PALETTES = {
  cyanViolet: ["#04122A", "#0F2D55", "#7A2BD9"],
  magentaGold: ["#1A0530", "#3D0F58", "#E6A817"],
  emeraldCyan: ["#021E1A", "#0A4035", "#0FE2C0"],
  amberVoid: ["#1A0A02", "#3D1A04", "#F77F2A"],
  sapphire: ["#020A1F", "#0F2A55", "#1E88E5"],
} as const;
type PaletteName = keyof typeof PALETTES;

function buildCoverSvg(opts: {
  palette: PaletteName;
  title: string;
  subtitle?: string;
  seed: number;
  /** 0-1 band; controls planet band y position */
  planetBandY?: number;
}): string {
  const [a, b, c] = PALETTES[opts.palette];
  const stars: string[] = [];
  for (let i = 0; i < 110; i++) {
    const r = ((opts.seed * 9301 + i * 49297) % 233280) / 233280;
    const x = Math.floor(r * 1600);
    const y = Math.floor(((r * 7919) % 1) * 900);
    const size = 0.4 + ((r * 100) % 1) * 1.6;
    const opacity = 0.2 + ((r * 1000) % 1) * 0.7;
    stars.push(
      `<circle cx="${x}" cy="${y}" r="${size.toFixed(1)}" fill="white" opacity="${opacity.toFixed(2)}"/>`,
    );
  }
  const bandY = (opts.planetBandY ?? 0.45) * 900;
  const planetCx = 1100 + ((opts.seed % 11) - 5) * 24;
  const planetCy = bandY + ((opts.seed % 9) - 4) * 30;
  const planetR = 180 + (opts.seed % 5) * 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient><radialGradient id="planet" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="${c}"/><stop offset="0.6" stop-color="${b}"/><stop offset="1" stop-color="#000814"/></radialGradient><radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity="0.45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><radialGradient id="vignette" cx="50%" cy="50%" r="80%"><stop offset="0.6" stop-color="black" stop-opacity="0"/><stop offset="1" stop-color="black" stop-opacity="0.45"/></radialGradient></defs><rect width="1600" height="900" fill="url(#bg)"/>${stars.join("")}<g><ellipse cx="${planetCx}" cy="${planetCy}" rx="${planetR + 160}" ry="${planetR * 0.22}" fill="none" stroke="${c}" stroke-opacity="0.6" stroke-width="3"/><ellipse cx="${planetCx}" cy="${planetCy}" rx="${planetR + 220}" ry="${planetR * 0.32}" fill="none" stroke="${a}" stroke-opacity="0.35" stroke-width="2"/><circle cx="${planetCx}" cy="${planetCy}" r="${planetR + 40}" fill="url(#halo)"/><circle cx="${planetCx}" cy="${planetCy}" r="${planetR}" fill="url(#planet)"/></g><rect width="1600" height="900" fill="url(#vignette)"/></svg>`;
}

type CoverResult = {
  storageId: Id<"_storage">;
  byteSize: number;
  mimeType: string;
  source: "fetched" | "svg-fallback";
  fetchError?: string;
};

async function fetchOrBuildCover(
  // This file runs in the Node.js runtime (`"use node";` at top), where
  // the global `fetch` is available. Convex's ActionCtx no longer
  // exposes `ctx.fetch` on this version, so we call the Node global.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  spec: CoverSpec & { url?: string },
): Promise<CoverResult> {
  if (spec.url) {
    try {
      const res = await fetch(spec.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Convex seed; Starforce Base 1198) StarforceChronicle/1.0",
          Accept: "image/jpeg,image/png,image/webp,image/*",
        },
        redirect: "follow",
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 1024) {
          const storageId = await ctx.storage.store(blob);
          return {
            storageId,
            byteSize: blob.size,
            mimeType:
              blob.type && blob.type.startsWith("image/")
                ? blob.type
                : "image/jpeg",
            source: "fetched",
          };
        }
        return buildFallback(ctx, spec, `response too small (${blob.size} bytes)`);
      }
      return buildFallback(ctx, spec, `HTTP ${res.status} ${res.statusText}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return buildFallback(ctx, spec, msg);
    }
  }
  return buildFallback(ctx, spec, "no url");
}

async function buildFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  spec: CoverSpec,
  fetchError: string,
): Promise<CoverResult> {
  const svg = buildCoverSvg(spec);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const storageId = await ctx.storage.store(blob);
  return {
    storageId,
    byteSize: blob.size,
    mimeType: "image/svg+xml",
    source: "svg-fallback",
    fetchError,
  };
}

// ---- Cover spec (deterministic; same as before) --------------------------

type CoverSpec = {
  palette: PaletteName;
  title: string;
  subtitle?: string;
  seed: number;
  planetBandY?: number;
  /** Optional real-image URL. fetchOrBuildCover tries this first;
   *  falls back to the procedural SVG on any failure. */
  url?: string;
};

// Real sci-fi imagery sourced from Wikimedia Commons (NASA / Hubble / Webb
// release imagery, all public domain). Width-suffixed thumbnails so each
// download well-under 1.5 MB.
const COVER_URLS = {
  pillarsOfCreation:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg/1920px-Pillars_of_creation_2014_HST_WFC3-UVIS_full-res_denoised.jpg",
  carinaNebula:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/1920px-Andromeda_Galaxy_%28with_h-alpha%29.jpg",
  sombreroGalaxy:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Sombrero_Galaxy_in_infrared_light_%28Hubble_Space_Telescope_and_Spitzer_Space_Telescope%29.jpg/1920px-Sombrero_Galaxy_in_infrared_light_%28Hubble_Space_Telescope_and_Spitzer_Space_Telescope%29.jpg",
  andromedaGalaxy:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Eagle_nebula_pillars.jpg/1920px-Eagle_nebula_pillars.jpg",
  crabNebula:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Crab_Nebula.jpg/1920px-Crab_Nebula.jpg",
  saturnEquinox:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Saturn_during_Equinox.jpg/1920px-Saturn_during_Equinox.jpg",
} as const;

const COVER_SPECS: Array<{ key: string; spec: CoverSpec }> = [
  {
    key: "story-signal-sol",
    spec: {
      palette: "cyanViolet",
      title: "Signal at the Sol system-Gemini",
      subtitle: "Sol Files · Ep 01",
      seed: 41,
      url: COVER_URLS.carinaNebula,
    },
  },
  {
    key: "story-outer-belt",
    spec: {
      palette: "amberVoid",
      title: "The Outer Belt Survey",
      subtitle: "Cartographers' Guild Field Desk",
      seed: 12,
      url: COVER_URLS.pillarsOfCreation,
    },
  },
  {
    key: "lore-sol-system",
    spec: {
      palette: "sapphire",
      title: "Sol system-Gemini",
      subtitle: "Encyclopedia · location",
      seed: 7,
      url: COVER_URLS.sombreroGalaxy,
    },
  },
  {
    key: "lore-outer-belt",
    spec: {
      palette: "emeraldCyan",
      title: "The Outer Belt",
      subtitle: "Encyclopedia · location",
      seed: 19,
      url: COVER_URLS.andromedaGalaxy,
    },
  },
  {
    key: "lore-cmdr-singh",
    spec: {
      palette: "magentaGold",
      title: "Cmdr. Singh",
      subtitle: "Encyclopedia · character",
      seed: 23,
      url: COVER_URLS.crabNebula,
    },
  },
  {
    key: "transmission-bridge-041",
    spec: {
      palette: "cyanViolet",
      title: "Bridge Briefing #041",
      subtitle: "Live broadcast · Sol system-Gemini",
      seed: 9,
      planetBandY: 0.55,
      url: COVER_URLS.saturnEquinox,
    },
  },
  // Lore Library plates (image items reuse these as both file + cover)
  {
    key: "lorelib-image-carina",
    spec: {
      palette: "cyanViolet",
      title: "Cosmic Cliffs Plate",
      subtitle: "Carina Nebula · deep field",
      seed: 55,
      url: COVER_URLS.carinaNebula,
    },
  },
  {
    key: "lorelib-image-pillars",
    spec: {
      palette: "amberVoid",
      title: "Pillars of Creation Plate",
      subtitle: "Outer Belt · survey pass",
      seed: 63,
      url: COVER_URLS.pillarsOfCreation,
    },
  },
];

// ---- Users --------------------------------------------------------------

type UserSpec = {
  displayName: string;
  name: string;
  email: string;
  emailVerificationTime?: number;
  rank: string;
  xp: number;
  fleet: string;
  tier: "free" | "cadet" | "officer" | "command" | "gia_agent";
  role?: "user" | "member" | "admin";
  opRole?:
    | "operator"
    | "senior_operator"
    | "story_editor"
    | "lore_archivist"
    | "community_moderator";
  bio?: string;
  achievements?: string[];
};

const USER_SPECS: UserSpec[] = [
  {
    displayName: "Cmdr. Vega",
    name: "Cmdr. Vega",
    email: "admin@starforce.local",
    rank: "Captain",
    xp: 9020,
    fleet: "Terran Reach",
    tier: "gia_agent",
    role: "admin",
    opRole: "senior_operator",
    bio: "Founder-grade operator. Logged in from the bridge, mostly.",
    achievements: ["first_story", "broadcaster", "crew_chief"],
  },
  {
    displayName: "Inka Tess",
    name: "Inka Tess",
    email: "inka@starforce.local",
    rank: "Captain",
    xp: 12500,
    fleet: "Terran Reach",
    tier: "command",
    bio: "Ship-handler, lore nerd, signal chaser.",
    achievements: ["first_flight", "lore_contributor", "broadcaster"],
  },
  {
    displayName: "Helio Bram",
    name: "Helio Bram",
    email: "helio@starforce.local",
    rank: "Admiral",
    xp: 22840,
    fleet: "Outer Belt",
    tier: "gia_agent",
    bio: "Long-haul pilot. Coordinator of the Outer Belt sweep.",
    achievements: ["pioneer", "centurion", "lore_contributor", "explorer"],
  },
  {
    displayName: "Mirra Singh",
    name: "Mirra Singh",
    email: "mirra@starforce.local",
    rank: "Commander",
    xp: 5860,
    fleet: "Terran Reach",
    tier: "command",
    bio: "Sector Patrol commander. Patient, methodical.",
    achievements: ["veteran", "crew_chief"],
  },
  {
    displayName: "Cyran Vale",
    name: "Cyran Vale",
    email: "cyran@starforce.local",
    rank: "Commander",
    xp: 6240,
    fleet: "Outer Belt",
    tier: "command",
    bio: "Cartographers' Guild chair.",
    achievements: ["explorer", "first_story"],
  },
  {
    displayName: "Zara Kova",
    name: "Zara Kova",
    email: "zara@starforce.local",
    rank: "Pilot",
    xp: 1920,
    fleet: "Outer Belt",
    tier: "officer",
    bio: "Routine pilot — Outer Belt short hops.",
  },
  {
    displayName: "Dax Norel",
    name: "Dax Norel",
    email: "dax@starforce.local",
    rank: "Pilot",
    xp: 2110,
    fleet: "Sol system-Gemini",
    tier: "officer",
    bio: "Signal pilot. Posts thoughtful transit logs.",
  },
  {
    displayName: "Kael Reyes",
    name: "Kael Reyes",
    email: "kael@starforce.local",
    rank: "Aspirant",
    xp: 740,
    fleet: "Terran Reach",
    tier: "cadet",
    bio: "Aspirant climbing the bridge ladder.",
  },
  {
    displayName: "Theo Nyx",
    name: "Theo Nyx",
    email: "theo@starforce.local",
    rank: "Admiral",
    xp: 28150,
    fleet: "Darkspire Expanse",
    tier: "gia_agent",
    bio: "Darkspire vet. Stubborn. Cheerful.",
    achievements: ["pioneer", "centurion"],
  },
  {
    displayName: "Luna Park",
    name: "Luna Park",
    email: "luna@starforce.local",
    rank: "Recruit",
    xp: 120,
    fleet: "Terran Reach",
    tier: "free",
    bio: "Brand new. Day one on the bridge.",
  },
  {
    displayName: "Jonas Park",
    name: "Jonas Park",
    email: "jonas@starforce.local",
    rank: "Captain",
    xp: 9740,
    fleet: "Sol system-Gemini",
    tier: "command",
    bio: "Signal specialist. Quietly prolific.",
    achievements: ["first_story", "broadcaster", "crew_chief"],
  },
  {
    displayName: "Nyx Arden",
    name: "Nyx Arden",
    email: "nyx@starforce.local",
    rank: "Aspirant",
    xp: 510,
    fleet: "Outer Belt",
    tier: "cadet",
    bio: "Cadet cohort 2242.",
  },
];

// ---- Stories / Lore / Transmissions / Resources / Missions -------------

type StorySpec = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  series?: string;
  factions?: string[];
  sectors?: string[];
  classification?: string;
  tags?: string[];
  views?: number;
  commentCount?: number;
  readMinutes?: number;
  status: Doc<"stories">["status"];
  publishedAt?: number;
  submittedAt?: number;
  coverKey?: string;
  featured?: boolean;
  featuredOrder?: number;
  author?: string;
};

const STORY_SPECS: StorySpec[] = [
  {
    slug: "signal-at-sol-system-gemini",
    title: "Signal at the Sol system-Gemini",
    coverKey: "story-signal-sol",
    excerpt:
      "When a long-dead beacon resumed broadcasting on a Terran frequency, Sector Patrol was first to confirm.",
    content:
      "Opening log: the Sol system-Gemini beacon resumed at 04:18 local. Initial sweep teams returned with mixed signals — three confirmed contacts, one anomaly we haven't classified yet. Mirra Singh deployed two recon wings. This dispatch is being filed from the bridge while the second wing enters the dark corridor. We expect contact within hours.",
    series: "Sol Files",
    factions: ["Terran Reach"],
    sectors: ["Sol system-Gemini"],
    classification: "open",
    tags: ["Example", "recon", "beacon", "signal"],
    views: 1242,
    commentCount: 24,
    readMinutes: 6,
    status: "published",
    publishedAt: 0, // resolved at action runtime
    featured: true,
    featuredOrder: 1,
    author: "Mirra Singh",
  },
  {
    slug: "outer-belt-survey",
    title: "The Outer Belt Survey",
    coverKey: "story-outer-belt",
    excerpt:
      "Three months of cartography. Three pilot corps. One uncharted corridor the charts aren't showing.",
    content:
      "We pulled the latest survey from the Outer Belt. Three pilot corps took turns on the long arc. Most of the corridor mapped clean, but one segment refuses to pencil in. We're putting it on the no-go list until the cartographers cross-check. Filed under Outer Belt rules — file this under 'do not enter until matched.'",
    series: "Outer Belt Survey",
    factions: ["Outer Belt"],
    sectors: ["Outer Belt"],
    classification: "restricted",
    tags: ["Example", "cartography", "survey"],
    views: 612,
    commentCount: 11,
    readMinutes: 4,
    status: "published",
    publishedAt: 0,
    featured: true,
    featuredOrder: 2,
    author: "Cyran Vale",
  },
  {
    slug: "darkspire-notes",
    title: "Darkspire Notes",
    excerpt: "Field notes from a three-week sit-in at an unattested listening post.",
    content:
      "The listening post is small but functional. The team logged thirty signals a night, mostly background hum, but a dozen patterns repeat on a 9-minute cycle. We don't know what they are. We're not assigning a name yet. This goes to the scrolls.",
    series: "Field Notes",
    factions: ["Outer Belt"],
    sectors: ["Darkspire Expanse"],
    classification: "open",
    tags: ["Example", "listening-post", "field-notes"],
    views: 880,
    commentCount: 6,
    readMinutes: 5,
    status: "published",
    publishedAt: 0,
    author: "Theo Nyx",
  },
  {
    slug: "cadet-log-first-watch",
    title: "Cadet Log: First Watch",
    excerpt: "First command rotation notes. Honest, short, and full of lessons learned the slow way.",
    content:
      "My first command rotation. Three things I learned: keep the manifest short, ask twice before you commit, and never run a sector sweep solo on day one. Filed for the next cohort.",
    series: "Cadet Logs",
    factions: ["Terran Reach"],
    classification: "open",
    tags: ["Example", "cadet", "training"],
    views: 412,
    commentCount: 9,
    readMinutes: 3,
    status: "published",
    publishedAt: 0,
    author: "Kael Reyes",
  },
  {
    slug: "bridge-briefing-broadcast",
    title: "Bridge Briefing — Live from the Bridge",
    excerpt: "Live broadcast from the bridge on the Sol system-Gemini sector.",
    content:
      "Standing weekly briefing covering active recon, signals in net, and operator queue. Live broadcast.",
    series: "Bridge Briefings",
    factions: ["Terran Reach"],
    sectors: ["Sol system-Gemini"],
    classification: "open",
    tags: ["Example", "briefing", "live"],
    views: 540,
    commentCount: 12,
    readMinutes: 8,
    status: "published",
    publishedAt: 0,
    author: "Inka Tess",
  },
  {
    slug: "deep-orbit-letters",
    title: "Deep Orbit Letters",
    excerpt: "Personal letters home from a long deployment. Selected by Inka.",
    content:
      "A collection of letters home from the second wing of Sector Patrol. Selected, annotated.",
    series: "Cadet Logs",
    factions: ["Terran Reach"],
    sectors: ["Sol system-Gemini"],
    classification: "open",
    tags: ["Example", "letters", "long-read"],
    views: 230,
    commentCount: 4,
    readMinutes: 9,
    status: "published",
    publishedAt: 0,
    author: "Inka Tess",
  },
  {
    slug: "sol-cadet-brief-draft",
    title: "Sol system-Gemini Cadet Brief",
    excerpt: "DRAFT — pending cross-faction review.",
    content: "Draft pending cross-faction review.",
    series: "Sol Files",
    factions: ["Sol system-Gemini", "Terran Reach"],
    sectors: ["Sol system-Gemini"],
    classification: "open",
    tags: ["Example", "draft"],
    status: "submitted",
    submittedAt: 0,
    author: "Kael Reyes",
  },
];

type LoreSpec = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  faction?: string;
  sector?: string;
  classification?: string;
  entryType: "character" | "location" | "event" | "artifact";
  featured?: boolean;
  featuredOrder?: number;
  coverKey?: string;
  author?: string;
};

const LORE_SPECS: LoreSpec[] = [
  {
    slug: "sol-system-gemini",
    title: "Sol system-Gemini",
    coverKey: "lore-sol-system",
    excerpt:
      "The Sol system-Gemini is a long, narrow corridor with unstable beacon traffic. Surveys conducted quarterly.",
    content:
      "The Sol system-Gemini is the most active anomaly corridor in the Terran Reach. Beacon traffic resumed in 2242 after nearly four decades of silence. Sector Patrol maintains a standing wing here; the listening-post network reports in every nine hours.",
    faction: "Terran Reach",
    sector: "Sol system-Gemini",
    classification: "open",
    entryType: "location",
    featured: true,
    featuredOrder: 1,
    author: "Inka Tess",
  },
  {
    slug: "outer-belt",
    title: "The Outer Belt",
    coverKey: "lore-outer-belt",
    excerpt: "Resource-rich but largely unmapped. Cartography ongoing.",
    content:
      "Surveyed annually. Three pilot corps rotate. The western edge of the belt contains hostile signal traffic that does not match any known Terran or Outer Belt protocol.",
    faction: "Outer Belt",
    sector: "Outer Belt",
    classification: "restricted",
    entryType: "location",
    featured: true,
    featuredOrder: 2,
    author: "Helio Bram",
  },
  {
    slug: "cmdr-singh",
    title: "Cmdr. Singh",
    coverKey: "lore-cmdr-singh",
    excerpt: "Sector Patrol commander. Quiet, methodical, alert.",
    content:
      "Mirra Singh was promoted to Sector Patrol commander in 2241 after the dissolution of Bridge Council's signal unit. Her standing orders prioritize the Sol system-Gemini corridor.",
    faction: "Terran Reach",
    sector: "Sol system-Gemini",
    classification: "open",
    entryType: "character",
    featured: true,
    featuredOrder: 3,
    author: "Inka Tess",
  },
  {
    slug: "listening-post-network",
    title: "The Listening Post Network",
    excerpt: "A scattered network of unattended posts logging signal anomalies.",
    content:
      "Posts report back to a rolling database every 9 hours. Maintenance crews rotate quarterly; physical access requires a senior-operator badge.",
    faction: "Outer Belt",
    classification: "open",
    entryType: "artifact",
    author: "Helio Bram",
  },
  {
    slug: "darkspire-expanse",
    title: "The Darkspire Expanse",
    excerpt: "Mostly empty. The lore teams love it. Nothing loves them back.",
    content: "Sparse traffic. Patient explorers only.",
    faction: "Outer Belt",
    sector: "Darkspire Expanse",
    classification: "open",
    entryType: "location",
    author: "Theo Nyx",
  },
  {
    slug: "coreward",
    title: "Coreward",
    excerpt: "Old routes, longer hauls, and deep archives.",
    content: "Routes have been catalogued for 200 years.",
    faction: "Terran Reach",
    sector: "Coreward",
    classification: "open",
    entryType: "location",
    author: "Inka Tess",
  },
  {
    slug: "helio-bram",
    title: "Helio Bram",
    excerpt: "Long-haul pilot. Outer Belt coordinator.",
    content:
      "Helio Bram joined the Cartographers' Guild at 19 and now chairs the Outer Belt survey group.",
    faction: "Outer Belt",
    classification: "open",
    entryType: "character",
    author: "Cyran Vale",
  },
  {
    slug: "signal-event-9min",
    title: "The Nine-Minute Signal",
    excerpt: "A repeating signal pattern reported by listening posts.",
    content:
      "First recorded in 2241. Pattern repeats every nine minutes across at least a dozen listening posts. Origin remains unidentified.",
    faction: "Outer Belt",
    classification: "restricted",
    entryType: "event",
    author: "Helio Bram",
  },
];

type TransmissionSpec = {
  slug: string;
  title: string;
  description: string;
  videoUrl?: string;
  transmissionType?: "briefing" | "mission" | "lore-deepdive";
  durationSeconds?: number;
  featured?: boolean;
  featuredOrder?: number;
  coverKey?: string;
};

// Real deep-space broadcast footage (NASA Images, public domain) —
// Orion camera views from the Artemis II apogee raise burn. The `~mobile`
// rendition is the lightest verified MP4 (84 MB) and supports byte-range
// requests, so a <video> element can stream it directly.
const VIDEO_URL =
  "https://images-assets.nasa.gov/video/art002m1200920011_Apogee_Raise_Burn/art002m1200920011_Apogee_Raise_Burn~mobile.mp4";

type LoreLibrarySpec = {
  slug: string;
  title: string;
  description: string;
  loreType: "bible" | "image" | "database";
  status: "draft" | "submitted" | "approved" | "rejected" | "archived";
  faction?: string;
  sector?: string;
  classification?: string;
  coverKey?: string; // image items reuse the fetched plate as file + cover
  databaseUrl?: string;
  databaseName?: string;
  featured?: boolean;
  featuredOrder?: number;
  author?: string;
};

const LORE_LIBRARY_SPECS: LoreLibrarySpec[] = [
  {
    slug: "lore-bible-1198",
    title: "Star Force Base 1198 — Lore Bible",
    description:
      "The canonical reference for factions, sectors, ranks, and the operating fiction of Sector 1198. Covers the Terran Reach, the Outer Belt, Darkspire Expanse, and the listening-post network.",
    loreType: "bible",
    status: "approved",
    faction: "Terran Reach",
    sector: "Coreward",
    classification: "open",
    featured: true,
    featuredOrder: 1,
    author: "Cmdr. Vega",
  },
  {
    slug: "lore-bible-signal-decoder",
    title: "Signal Decoder Field Manual",
    description:
      "Operator-side manual for decoding the nine-minute repeating signal patterns logged by the listening-post network.",
    loreType: "bible",
    status: "submitted",
    faction: "Outer Belt",
    classification: "restricted",
    author: "Inka Tess",
  },
  {
    slug: "lore-image-cosmic-cliffs",
    title: "Cosmic Cliffs Plate — Carina Nebula",
    description:
      "High-resolution deep-field plate of the Carina Nebula, as retransmitted by the long-range observatory.",
    loreType: "image",
    status: "approved",
    faction: "Terran Reach",
    classification: "open",
    coverKey: "lorelib-image-carina",
    featured: true,
    featuredOrder: 2,
    author: "Helio Bram",
  },
  {
    slug: "lore-image-pillars",
    title: "Pillars of Creation Plate",
    description:
      "Archival plate of the Pillars of Creation captured on a survey pass through the Outer Belt corridor.",
    loreType: "image",
    status: "approved",
    faction: "Outer Belt",
    sector: "Outer Belt",
    classification: "open",
    coverKey: "lorelib-image-pillars",
    author: "Cyran Vale",
  },
  {
    slug: "lore-db-fleet-registry",
    title: "Fleet Registry Database",
    description:
      "Live registry of commissioned vessels, wings, and patrol rotations. Access via the Fleet subdomain.",
    loreType: "database",
    status: "approved",
    faction: "Terran Reach",
    databaseName: "Fleet Registry",
    databaseUrl: "https://fleetregistry.starforcebase1198.com",
    featured: true,
    featuredOrder: 3,
    author: "Cmdr. Vega",
  },
  {
    slug: "lore-db-signal-intel",
    title: "Signal Intelligence Database",
    description:
      "Rolling archive of signals captured by the listening-post network, indexed by origin and cycle.",
    loreType: "database",
    status: "approved",
    faction: "Outer Belt",
    databaseName: "Signal Intel",
    databaseUrl: "https://starforcebase1198.com/vault",
    author: "Helio Bram",
  },
  {
    slug: "lore-db-sector-atlas",
    title: "Sector Atlas Database",
    description:
      "Cartographic master record of sectors, routes, and survey passes across the Terran Reach and the Outer Belt.",
    loreType: "database",
    status: "approved",
    faction: "Terran Reach",
    classification: "open",
    databaseName: "Sector Atlas",
    databaseUrl: "https://starforcebase1198.com/map",
    featured: true,
    featuredOrder: 4,
    author: "Cyran Vale",
  },
  {
    slug: "lore-db-personnel-archive",
    title: "Personnel Archive Database",
    description:
      "Commissioned roster, ranks, wing assignments, and service records for all active personnel of Sector 1198.",
    loreType: "database",
    status: "approved",
    faction: "Terran Reach",
    classification: "restricted",
    databaseName: "Personnel Archive",
    databaseUrl: "https://personnel.starforcebase1198.com",
    author: "Cmdr. Vega",
  },
];

const TRANSMISSION_SPECS: TransmissionSpec[] = [
  {
    slug: "bridge-briefing-041",
    title: "Bridge Briefing #041: The Sol system-Gemini",
    coverKey: "transmission-bridge-041",
    description:
      "Stand-up briefing covering the Sol system-Gemini beacon and ongoing recon. Footage: deep-space camera views from the long apogee burn — a real broadcast retransmission.",
    videoUrl: VIDEO_URL,
    transmissionType: "briefing",
    durationSeconds: 612,
    featured: true,
    featuredOrder: 1,
  },
  {
    slug: "field-logs-outer-belt-wave-3",
    title: "Field Logs: Outer Belt Survey Wave 3",
    description: "Field recordings from the third Outer Belt sweep.",
    transmissionType: "mission",
    durationSeconds: 920,
  },
  {
    slug: "lore-deepdive-listening-post",
    title: "Lore Deep Dive: The Listening Post Network",
    description: "How the listening-post network operates, and why it matters.",
    transmissionType: "lore-deepdive",
    durationSeconds: 740,
  },
  {
    slug: "cadet-orientation-2242",
    title: "Cadet Orientation, Class of 2242",
    description: "Welcome brief for incoming cadets.",
    transmissionType: "briefing",
    durationSeconds: 540,
  },
];

const RESOURCE_SPECS = [
  { title: "Onboarding Handbook", slug: "onboarding-handbook", description: "Equip, ranks, fleet code of conduct.", resourceType: "onboarding" },
  { title: "Lore Style Guide", slug: "lore-style-guide", description: "How we write lore at Star Force Base 1198.", resourceType: "policy" },
  { title: "Signal Log Decoder", slug: "signal-log-decoder", description: "Tool to decode temporal signal pattern.", resourceType: "tool" },
  { title: "Community Charter", slug: "community-charter", description: "Community expectations, escalation paths.", resourceType: "policy" },
  { title: "Cadet Reading List", slug: "cadet-reading-list", description: "Recommended archive entries for new cadets.", resourceType: "guide" },
  {
    title: "Operator Briefing Templates",
    slug: "operator-briefing-templates",
    description: "Templates for moderator / operator briefings.",
    resourceType: "download",
    tierRequired: "command" as Doc<"resources">["tierRequired"],
  },
];

const MISSION_SPECS = [
  {
    title: "Map the Unmap",
    slug: "map-the-unmap",
    description: "Survey the unnamed segment of the Outer Belt.",
    missionStatus: "active",
    xpReward: 250,
    tierRequired: "officer" as Doc<"missions">["tierRequired"],
    location: "Outer Belt — unnamed corridor, Grid 7-Theta",
    durationLabel: "~2 hours, solo or small crew",
    briefing:
      "The cartographers' sweep terminated forty-eight hours ago at the rim of the named charts. Beyond the last buoy sits a corridor that has never carried a designation — no survey beacon, no salvage claim, no signal log. Command wants it named, charted, and safe before the next resupply run takes the shortcut through it.\n\nYou are not asked to fight anything. You are asked to look carefully. Fly the corridor at low burn, log every wreck and every echo, and come home with a story the fleet can trust. What you find — a derelict, a ghost signal, a patch of dead space — becomes the name this corridor carries for the next hundred years.\n\nThe Outer Belt does not forgive carelessness, but it rewards the thorough. Keep your transponder on, keep your report honest, and keep an eye on your six. The Bridge will read every word you file.",
    objectives: [
      "Cross the last named buoy and enter Grid 7-Theta on a slow approach",
      "Log at least three significant contacts: wrecks, anomalies, or signal echoes",
      "Verify the corridor is clear for resupply traffic, or flag the hazard",
      "Propose a designation for the corridor in your field report",
    ],
    reportGuidance:
      "Tell Command what you saw: route taken, contacts logged, any hazards, and the designation you propose. Screenshot-style detail beats poetry — the Bridge compiles these into the navigation registry.",
  },
  {
    title: "Cadet Welcome Tour",
    slug: "cadet-welcome-tour",
    description: "Run an orientation for the new cohort.",
    missionStatus: "active",
    xpReward: 75,
    location: "Sol system-Gemini — transit lanes & Base 1198 decks",
    durationLabel: "~45 minutes",
    briefing:
      "A new cohort clears the gates this week, and someone has to show them the ship. Every station, every corridor, every rule that keeps a base of 1,198 souls breathing in vacuum — someone explains it first. This mission is that someone.\n\nGrab two or three new arrivals, walk them through the public decks, and answer the questions that matter: where the mess is, how the rank ladder works, what the Outer Belt is really like, and why the archive is worth their time. You do not need a uniform or a podium. You need to be patient and honest.\n\nThe tour ends where it began: at the airlock where they boarded, so the new cohort sees the whole loop of the life they just signed up for. File a short report on how it went, and Command will mark your name on their welcome dossier.",
    objectives: [
      "Meet at least two newly arrived members of the fleet",
      "Show the public decks: mess, archive, hangar, and signal room",
      "Answer questions about ranks, missions, and the community charter",
      "File a short welcome report with any questions you could not answer",
    ],
    reportGuidance:
      "Keep it brief: who you toured, which decks you covered, and anything the newcomers asked that we should explain better next time.",
  },
  {
    title: "Bridge Q4 Review",
    slug: "bridge-q4-review",
    description: "Compile the last quarter's signals.",
    missionStatus: "completed",
    xpReward: 150,
    location: "Coreward — Bridge Council chambers",
    durationLabel: "Seasonal review",
    briefing:
      "Every quarter, the Bridge Council closes its books on the signals that moved the fleet: the stories that won the archive, the transmissions that reached the most decks, the operations that changed how the Outer Belt feels. The Q4 review collated all of it into a single readout for Command.\n\nThis operation is closed. The compiled review now lives in the archive as the reference for how the base ended its year — what worked, what was tried, and what the fleet is carrying into the next quarter. If you want to know what a completed operation looks like from the inside, read the summary and study how the reports were filed.",
    objectives: [
      "Collect the top signals, stories, and transmissions of the quarter",
      "Summarize each one for the Command readout",
      "Flag the operations worth repeating next quarter",
      "Deliver the compiled review to the Bridge Council",
    ],
    reportGuidance:
      "Completed operations no longer accept reports. The Q4 readout is archived as a reference for how the fleet closes a season.",
  },
];

// Sector chart coordinates feed the Galaxy Map Mini widget.
const SECTOR_SPECS = [
  { name: "Terran Reach", slug: "terran-reach", x: 120, y: 80, loreCount: 12 },
  { name: "Sol system-Gemini", slug: "sol-system-gemini", x: 240, y: 110, loreCount: 8 },
  { name: "Outer Belt", slug: "outer-belt", x: 360, y: 220, loreCount: 15 },
  { name: "Void Reaches", slug: "void-reaches", x: 180, y: 260, loreCount: 5 },
  { name: "Coreward", slug: "coreward", x: 80, y: 200, loreCount: 9 },
  { name: "Darkspire Expanse", slug: "darkspire-expanse", x: 300, y: 60, loreCount: 7 },
];

const FLEET_REPORTS = [
  {
    title: "Weekly Comms Summary",
    content: "All channels green. Sol system-Gemini beacon still broadcasting on Terran frequency.",
    authorDisplayName: "Mirra Singh",
  },
  {
    title: "Map the Unmap — Recon 3 field report",
    content:
      "Ran the unnamed corridor at low burn from the last named buoy. Two derelicts logged, one active echo on a decaying orbital path — no traffic hazard, but I'd hold resupply to a wide approach until the echo decays. Proposing the designation 'Kestrel Run'.",
    authorDisplayName: "Helio Bram",
    missionSlug: "map-the-unmap",
  },
  {
    title: "Cadet Welcome Tour — cohort 2242",
    content:
      "Walked four new arrivals through the mess, archive, hangar, and signal room. Big questions were ranks and the Outer Belt itself. No blockers; the welcome dossier is ready for the Bridge.",
    authorDisplayName: "Cmdr. Vega",
    missionSlug: "cadet-welcome-tour",
  },
];

const GROUP_SPECS = [
  { name: "Sector Patrol", slug: "sector-patrol", description: "Active patrol wing for the Sol system-Gemini.", category: "ops", privacy: "public", memberCount: 7 },
  { name: "Cartographers' Guild", slug: "cartographers-guild", description: "Mapping the Outer Belt, sector by sector.", category: "intel", privacy: "public", memberCount: 6 },
  { name: "Listening Post Ops", slug: "listening-post-ops", description: "Operators of the listening-post network.", category: "intel", privacy: "private", memberCount: 4 },
  { name: "Bridge Council", slug: "bridge-council", description: "Cross-faction moderator circle.", category: "governance", privacy: "classified", memberCount: 6 },
  // Lore-themed micro-communities (#3): factions, ship crews, homeworlds.
  { name: "Ultra Force Vanguard", slug: "ultra-force-vanguard", description: "The standing fleet. Drills, tactics, and faction pride.", category: "faction", privacy: "public", memberCount: 12 },
  { name: "G.I.A. Riftwatch", slug: "gia-riftwatch", description: "Galactic Intelligence Agency field analysts tracking rift anomalies.", category: "faction", privacy: "private", memberCount: 8 },
  { name: "Chrono Monks Archive", slug: "chrono-monks-archive", description: "Keepers of the timeline. We debate causality over tea.", category: "faction", privacy: "public", memberCount: 5 },
  { name: "Starforge Union Yards", slug: "starforge-union-yards", description: "Shipwrights and engineers — blueprints, refits, and drydock gossip.", category: "faction", privacy: "public", memberCount: 9 },
  { name: "ISS Aurora Crew", slug: "iss-aurora-crew", description: "Crew of the ISV Aurora. Ship's mess, shared lore, monthly missions.", category: "ship", privacy: "private", memberCount: 6 },
  { name: "New Terra Homeworld Collective", slug: "new-terra-collective", description: "Adopted homeworld of the Sol diaspora. Culture, festivals, petitions.", category: "planet", privacy: "public", memberCount: 11 },
];


// ---- Group workspace demo data (memberships, posts, chat, missions/events) ----

type GroupMemberSpec = {
  groupSlug: string;
  userDisplay: string;
  role: "owner" | "moderator" | "member";
  daysAgo: number;
};

// Roles reflect the group's hierarchy for the owner-powers demo.
const GROUP_MEMBER_SPECS: GroupMemberSpec[] = [
  // Sector Patrol — owner: Mirra Singh
  { groupSlug: "sector-patrol", userDisplay: "Mirra Singh", role: "owner", daysAgo: 90 },
  { groupSlug: "sector-patrol", userDisplay: "Jonas Park", role: "moderator", daysAgo: 60 },
  { groupSlug: "sector-patrol", userDisplay: "Dax Norel", role: "moderator", daysAgo: 45 },
  { groupSlug: "sector-patrol", userDisplay: "Inka Tess", role: "member", daysAgo: 50 },
  { groupSlug: "sector-patrol", userDisplay: "Zara Kova", role: "member", daysAgo: 20 },
  { groupSlug: "sector-patrol", userDisplay: "Kael Reyes", role: "member", daysAgo: 30 },
  { groupSlug: "sector-patrol", userDisplay: "Luna Park", role: "member", daysAgo: 7 },
  // Cartographers' Guild — owner: Cyran Vale
  { groupSlug: "cartographers-guild", userDisplay: "Cyran Vale", role: "owner", daysAgo: 120 },
  { groupSlug: "cartographers-guild", userDisplay: "Helio Bram", role: "moderator", daysAgo: 90 },
  { groupSlug: "cartographers-guild", userDisplay: "Theo Nyx", role: "moderator", daysAgo: 70 },
  { groupSlug: "cartographers-guild", userDisplay: "Jonas Park", role: "member", daysAgo: 55 },
  { groupSlug: "cartographers-guild", userDisplay: "Zara Kova", role: "member", daysAgo: 40 },
  { groupSlug: "cartographers-guild", userDisplay: "Nyx Arden", role: "member", daysAgo: 14 },
  // Listening Post Ops — owner: Inka Tess
  { groupSlug: "listening-post-ops", userDisplay: "Inka Tess", role: "owner", daysAgo: 80 },
  { groupSlug: "listening-post-ops", userDisplay: "Jonas Park", role: "moderator", daysAgo: 65 },
  { groupSlug: "listening-post-ops", userDisplay: "Dax Norel", role: "member", daysAgo: 40 },
  { groupSlug: "listening-post-ops", userDisplay: "Helio Bram", role: "member", daysAgo: 25 },
  // Bridge Council — owner: Cmdr. Vega
  { groupSlug: "bridge-council", userDisplay: "Cmdr. Vega", role: "owner", daysAgo: 200 },
  { groupSlug: "bridge-council", userDisplay: "Mirra Singh", role: "moderator", daysAgo: 150 },
  { groupSlug: "bridge-council", userDisplay: "Theo Nyx", role: "moderator", daysAgo: 120 },
  { groupSlug: "bridge-council", userDisplay: "Inka Tess", role: "member", daysAgo: 100 },
  { groupSlug: "bridge-council", userDisplay: "Helio Bram", role: "member", daysAgo: 90 },
  { groupSlug: "bridge-council", userDisplay: "Cyran Vale", role: "member", daysAgo: 85 },
];

type GroupPostSpec = {
  groupSlug: string;
  authorDisplay: string;
  title: string;
  body: string;
  kind: "post" | "announcement";
  pinned?: boolean;
  hoursAgo: number;
};

const GROUP_POST_SPECS: GroupPostSpec[] = [
  {
    groupSlug: "sector-patrol",
    authorDisplay: "Mirra Singh",
    title: "Patrol window extended through the week",
    body: "Standing order: patrol window extended through Sunday. Wings 1 and 2 rotate Friday 06:00; corridor 4 stays on the watch list until the trace resolves. Log any corridor-4 contact in the patrol log, not the general channel.",
    kind: "announcement",
    pinned: true,
    hoursAgo: 26,
  },
  {
    groupSlug: "sector-patrol",
    authorDisplay: "Jonas Park",
    title: "Signal trace — corridor 4",
    body: "Third harmonic keeps repeating on the corridor-4 relay. Same 9-minute cycle as the listening posts. Attaching the raw trace to the patrol log; open to cross-checks.",
    kind: "post",
    hoursAgo: 20,
  },
  {
    groupSlug: "sector-patrol",
    authorDisplay: "Kael Reyes",
    title: "First watch notes",
    body: "First watch signed. All quiet on deck — two transits logged, both clean. Filed my notes to the cadet log so the next cohort has something to read.",
    kind: "post",
    hoursAgo: 5,
  },
  {
    groupSlug: "cartographers-guild",
    authorDisplay: "Cyran Vale",
    title: "Wave 3 survey archived",
    body: "Wave 3 sheets are archived to the atlas. Twelve segments mapped clean; the unnamed corridor stays on the no-go list until the cross-check clears. Great work by the survey corps.",
    kind: "announcement",
    pinned: true,
    hoursAgo: 48,
  },
  {
    groupSlug: "cartographers-guild",
    authorDisplay: "Helio Bram",
    title: "Unnamed corridor — cross-check open",
    body: "Opening the cross-check on the unnamed corridor segment. Two independent passes needed before it goes back on the chart. Volunteer in-thread.",
    kind: "post",
    hoursAgo: 30,
  },
  {
    groupSlug: "cartographers-guild",
    authorDisplay: "Nyx Arden",
    title: "Draft chart sheet for review",
    body: "Draft sheet 12 uploaded to the atlas draft shelf. One coordinate offset flagged inline — would like a second pair of eyes before it ships.",
    kind: "post",
    hoursAgo: 12,
  },
  {
    groupSlug: "listening-post-ops",
    authorDisplay: "Inka Tess",
    title: "Post rotation — Q4 roster",
    body: "Q4 rotation is posted. Sign the sheet by Friday 18:00. Nights stay two-person minimum; Helio covers the long dark sweep as usual.",
    kind: "announcement",
    pinned: true,
    hoursAgo: 70,
  },
  {
    groupSlug: "listening-post-ops",
    authorDisplay: "Jonas Park",
    title: "Nine-minute pattern shifted",
    body: "Heads up: the repeating pattern shifted +9 seconds tonight. Logged to the signal archive. Not a failure mode we've seen before — leave the posts on continuous record.",
    kind: "post",
    hoursAgo: 8,
  },
  {
    groupSlug: "listening-post-ops",
    authorDisplay: "Dax Norel",
    title: "Maintenance window Thursday",
    body: "Maintenance window set for Thursday 02:00. Posts 3 and 4 go offline in sequence; expect ~10 minutes of dark time each.",
    kind: "post",
    hoursAgo: 16,
  },
  {
    groupSlug: "bridge-council",
    authorDisplay: "Cmdr. Vega",
    title: "Council agenda — 2242.12",
    body: "Agenda for session 2242.12: (1) corridor-4 escalation, (2) Q4 roster sign-off, (3) lore consistency review, (4) cadet cohort expansion. Amendments welcome before session.",
    kind: "announcement",
    pinned: true,
    hoursAgo: 90,
  },
  {
    groupSlug: "bridge-council",
    authorDisplay: "Mirra Singh",
    title: "Fleet tactics review notes",
    body: "Notes from the tactics review are attached. Two changes proposed for the standing patrol doctrine — both are small, both save transit time on corridor sweeps.",
    kind: "post",
    hoursAgo: 40,
  },
  {
    groupSlug: "bridge-council",
    authorDisplay: "Theo Nyx",
    title: "Escalation path proposal",
    body: "Proposal: a two-step escalation path for contested corridor claims, so the council doesn't have to convene for every boundary question. Draft attached.",
    kind: "post",
    hoursAgo: 22,
  },
];

type GroupMessageSpec = {
  groupSlug: string;
  authorDisplay: string;
  body: string;
  hoursAgo: number;
};

const GROUP_MESSAGE_SPECS: GroupMessageSpec[] = [
  // Sector Patrol channel
  { groupSlug: "sector-patrol", authorDisplay: "Inka Tess", body: "Copy — patrol window extended, wings 1 and 2 rotate Friday.", hoursAgo: 26 },
  { groupSlug: "sector-patrol", authorDisplay: "Mirra Singh", body: "Confirmed. Corridor 4 stays on the watch list until the trace resolves.", hoursAgo: 25 },
  { groupSlug: "sector-patrol", authorDisplay: "Jonas Park", body: "Trace log attached — third harmonic keeps repeating.", hoursAgo: 20 },
  { groupSlug: "sector-patrol", authorDisplay: "Dax Norel", body: "Standing by for the corridor 4 handoff at 06:00.", hoursAgo: 14 },
  { groupSlug: "sector-patrol", authorDisplay: "Kael Reyes", body: "First watch signed. All quiet on deck.", hoursAgo: 5 },
  // Cartographers' Guild channel
  { groupSlug: "cartographers-guild", authorDisplay: "Cyran Vale", body: "Wave 3 sheets are up in the atlas.", hoursAgo: 48 },
  { groupSlug: "cartographers-guild", authorDisplay: "Helio Bram", body: "Nice work. Cross-check the unnamed segment before Monday.", hoursAgo: 47 },
  { groupSlug: "cartographers-guild", authorDisplay: "Zara Kova", body: "Pulled the no-go list — 2 segments still pending.", hoursAgo: 30 },
  { groupSlug: "cartographers-guild", authorDisplay: "Theo Nyx", body: "Chart sheet 12 draft uploaded.", hoursAgo: 18 },
  { groupSlug: "cartographers-guild", authorDisplay: "Nyx Arden", body: "Reviewed — one coordinate offset, flagged inline.", hoursAgo: 12 },
  // Listening Post Ops channel
  { groupSlug: "listening-post-ops", authorDisplay: "Inka Tess", body: "Q4 rotation posted. Sign the sheet by Friday.", hoursAgo: 70 },
  { groupSlug: "listening-post-ops", authorDisplay: "Dax Norel", body: "Maintenance window set for Thursday 02:00.", hoursAgo: 16 },
  { groupSlug: "listening-post-ops", authorDisplay: "Helio Bram", body: "Copy — I'll cover the night sweep.", hoursAgo: 15 },
  { groupSlug: "listening-post-ops", authorDisplay: "Inka Tess", body: "Good. Keep the logs tight.", hoursAgo: 14 },
  { groupSlug: "listening-post-ops", authorDisplay: "Jonas Park", body: "Pattern shifted +9 seconds. Logged to the signal archive.", hoursAgo: 8 },
  // Bridge Council channel
  { groupSlug: "bridge-council", authorDisplay: "Cmdr. Vega", body: "Agenda for 2242.12 is up.", hoursAgo: 90 },
  { groupSlug: "bridge-council", authorDisplay: "Mirra Singh", body: "Added the tactics review under item 3.", hoursAgo: 40 },
  { groupSlug: "bridge-council", authorDisplay: "Theo Nyx", body: "Escalation path proposal attached.", hoursAgo: 22 },
  { groupSlug: "bridge-council", authorDisplay: "Cyran Vale", body: "Guild supports item 4 with amendments.", hoursAgo: 18 },
];

type GroupEventSpec = {
  groupSlug: string;
  createdByDisplay: string;
  title: string;
  description: string;
  kind: "mission" | "event";
  status: "open" | "in_progress" | "completed" | "cancelled";
  hoursAgo: number;
  scheduledDaysAhead?: number;
  signupDisplays: string[];
};

const GROUP_EVENT_SPECS: GroupEventSpec[] = [
  {
    groupSlug: "sector-patrol",
    createdByDisplay: "Mirra Singh",
    title: "Recon sweep — Corridor 4",
    description: "Two-wing sweep of corridor 4 with signal logging on the relay. Bring a full charge; expect a 4-hour window.",
    kind: "mission",
    status: "in_progress",
    hoursAgo: 20,
    signupDisplays: ["Mirra Singh", "Jonas Park", "Dax Norel"],
  },
  {
    groupSlug: "sector-patrol",
    createdByDisplay: "Mirra Singh",
    title: "Weekly patrol briefing",
    description: "Standing weekly briefing. Corridor status, rotation sign-off, new-cadet introductions.",
    kind: "event",
    status: "open",
    hoursAgo: 4,
    scheduledDaysAhead: 2,
    signupDisplays: ["Kael Reyes", "Luna Park"],
  },
  {
    groupSlug: "cartographers-guild",
    createdByDisplay: "Cyran Vale",
    title: "Chart pass 12 — Outer Belt",
    description: "Third chart pass on the unnamed corridor segment. Two independent transits required before the segment is re-charted.",
    kind: "mission",
    status: "open",
    hoursAgo: 30,
    scheduledDaysAhead: 4,
    signupDisplays: ["Helio Bram", "Zara Kova", "Nyx Arden"],
  },
  {
    groupSlug: "cartographers-guild",
    createdByDisplay: "Cyran Vale",
    title: "Cartographers' monthly meet",
    description: "Monthly guild meet — wave debriefs, chart standard review, open questions.",
    kind: "event",
    status: "completed",
    hoursAgo: 200,
    signupDisplays: ["Cyran Vale", "Theo Nyx"],
  },
  {
    groupSlug: "listening-post-ops",
    createdByDisplay: "Inka Tess",
    title: "Signal sync hour",
    description: "Hour-long sync across all posts. Pattern watch, maintenance windows, log review.",
    kind: "event",
    status: "open",
    hoursAgo: 10,
    scheduledDaysAhead: 1,
    signupDisplays: ["Jonas Park", "Dax Norel"],
  },
  {
    groupSlug: "bridge-council",
    createdByDisplay: "Cmdr. Vega",
    title: "Council session 2242.12",
    description: "Regular council session. Agenda posted; amendments due beforehand.",
    kind: "event",
    status: "completed",
    hoursAgo: 160,
    signupDisplays: ["Cmdr. Vega", "Mirra Singh", "Inka Tess"],
  },
];

const THREAD_SPECS = [
  { title: "Sol system-Gemini beacon — anyone else tracking this?", slug: "sol-system-gemini-beacon-tracking", forumId: "general", content: "Brief: Sol system-Gemini beacon resumed broadcasting last week. Anyone else picking it up?" },
  { title: "Outer Belt survey wave 3 — debrief", slug: "outer-belt-survey-wave-3", forumId: "operations", content: "Wave 3 debrief coming. Submit questions in-thread." },
  { title: "Cadet reading list — open for additions", slug: "cadet-reading-list-thread", forumId: "onboarding", content: "Open thread for proposed additions to the cadet reading list." },
  { title: "Favorite sci-fi weapons (from the field)", slug: "favorite-sci-fi-weapons", forumId: "general", content: "Open thread: what's in your kit?" },
  { title: "Alien species theories — keep it civil", slug: "alien-species-theories", forumId: "lore", content: "Open thread. Lore-team corrections welcome, no acrimony." },
  { title: "New fleet tactics — share what works", slug: "new-fleet-tactics", forumId: "operations", content: "Open thread. Tactical say-do." },
];

const ACTIVITY_ENTRIES = [
  { actor: "Cmdr. Vega", verb: "published", targetType: "story", targetId: "story:signal-at-sol-system-gemini", url: "/stories/signal-at-sol-system-gemini", summary: "Signal at the Sol system-Gemini", daysAgo: 3 },
  { actor: "Mirra Singh", verb: "published", targetType: "story", targetId: "story:outer-belt-survey", url: "/stories/outer-belt-survey", summary: "The Outer Belt Survey", daysAgo: 6 },
  { actor: "Helio Bram", verb: "published_lore", targetType: "lore", targetId: "lore:outer-belt", url: "/lore/outer-belt", summary: "The Outer Belt", daysAgo: 4 },
  { actor: "Inka Tess", verb: "messaged", targetType: "thread", targetId: "thread:inka-to-mirra", summary: undefined, daysAgo: 1 },
  { actor: "Cyran Vale", verb: "filed_report", targetType: "fleet_report", targetId: "report:wave-3", summary: undefined, daysAgo: 2 },
];

const MODERATION_ITEMS = [
  { targetType: "comment", targetId: "seed:comment-1", reason: "Off-topic", status: "pending", daysAgo: 1 },
  { targetType: "story", targetId: "seed:story-draft", reason: "Lore consistency check requested", status: "pending", daysAgo: 2 },
];

// ---- Cover refresh --------------------------------------------------------

/**
 * Rebuild every cover plate and attach it to the already-seeded rows
 * (stories, lore entries, transmissions, lore library) by slug. The regular
 * seed upserts skip existing rows, so this is the way to replace stored
 * covers without wiping data. Run: bunx convex run seed:refreshCovers '{}'
 */
/**
 * Cover keys whose imagery ships as a static site file in `public/covers/`
 * (see `staticCovers.ts`). At render time the static URL wins over any
 * `coverStorageId`, so uploading a Convex storage copy for these slugs is
 * pure waste — it burns file storage on every seed run and leaves orphaned
 * assets behind. Both seed paths skip them.
 *
 * Note: the two `lorelib-image-*` plates are NOT skipped — their stored copy
 * doubles as the downloadable Lore Library file (`fileStorageId`).
 */
function isStaticCoverKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATIC_IMAGES, key);
}

export const refreshCovers = action({
  args: {},
  handler: async (ctx) => {
    const runM = (
      name: string,
      _args: Record<string, unknown> = {},
    ): Promise<unknown> =>
      (ctx.runMutation as (n: string, a: unknown) => Promise<unknown>)(
        name,
        _args,
      );

    const coverByKey = new Map<
      string,
      { storageId: Id<"_storage">; mimeType: string; byteSize: number; altText: string }
    >();
    const diagnostics: Array<{ key: string; source: string; fetchError?: string }> = [];
    for (const c of COVER_SPECS) {
      if (isStaticCoverKey(c.key)) {
        diagnostics.push({ key: c.key, source: "static-file" });
        continue;
      }
      const { storageId, byteSize, mimeType, source, fetchError } =
        await fetchOrBuildCover(ctx, c.spec);
      coverByKey.set(c.key, {
        storageId,
        mimeType,
        byteSize,
        altText: c.spec.title,
      });
      diagnostics.push({ key: c.key, source, fetchError });
    }

    const coverArgs = (key?: string) => {
      const cover = key ? coverByKey.get(key) : undefined;
      return cover
        ? {
            coverStorageId: cover.storageId,
            coverMeta: {
              mimeType: cover.mimeType,
              byteSize: cover.byteSize,
              altText: cover.altText,
            },
          }
        : {};
    };

    const results: unknown[] = [];
    for (const s of STORY_SPECS) {
      if (!s.coverKey) continue;
      results.push(
        await runM("seedHelpers:attachCover", {
          table: "stories",
          slug: s.slug,
          ...coverArgs(s.coverKey),
        }),
      );
    }
    for (const l of LORE_SPECS) {
      if (!l.coverKey) continue;
      results.push(
        await runM("seedHelpers:attachCover", {
          table: "loreEntries",
          slug: l.slug,
          ...coverArgs(l.coverKey),
        }),
      );
    }
    for (const t of TRANSMISSION_SPECS) {
      if (!t.coverKey) continue;
      results.push(
        await runM("seedHelpers:attachCover", {
          table: "transmissions",
          slug: t.slug,
          ...coverArgs(t.coverKey),
        }),
      );
    }
    for (const l of LORE_LIBRARY_SPECS) {
      if (!l.coverKey) continue;
      const cover = coverByKey.get(l.coverKey);
      const isImage = l.loreType === "image";
      results.push(
        await runM("seedHelpers:attachCover", {
          table: "loreLibrary",
          slug: l.slug,
          ...coverArgs(l.coverKey),
          ...(isImage && cover
            ? {
                fileStorageId: cover.storageId,
                fileMeta: {
                  fileName: `${l.slug}.jpg`,
                  mimeType: cover.mimeType,
                  byteSize: cover.byteSize,
                },
              }
            : {}),
        }),
      );
    }
    return { ok: true, diagnostics, results };
  },
});

// ---- The action ----------------------------------------------------------

export const seedDemo = action({
  args: { clear: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    // Local typed wrappers around ctx.runMutation / runQuery. Convex's strict
    // typing wants FunctionReference objects, but at runtime string paths
    // work fine for internal helpers. We cast once here and use the wrappers
    // throughout the action.
    const runM = (
      name: string,
      _args: Record<string, unknown> = {},
    ): Promise<unknown> =>
      (ctx.runMutation as (n: string, a: unknown) => Promise<unknown>)(
        name,
        _args,
      );
    const runQ = (
      name: string,
      _args: Record<string, unknown> = {},
    ): Promise<unknown> =>
      (ctx.runQuery as (n: string, a: unknown) => Promise<unknown>)(name, _args);

    const now = Date.now();

    // 1. Optional wipe (calls internal helper mutation).
    if (args.clear) {
      await runM("seedHelpers:wipeAll", {});
    }

    // 2. Fetch (or build) cover plates. Wikimedia URL FIRST via Node.js
    // runtime fetch; procedural SVG fallback if any URL fails.
    const coverByKey = new Map<
      string,
      { storageId: Id<"_storage">; mimeType: string; byteSize: number; altText: string }
    >();
    const coverDiagnostics: Array<{
      key: string;
      source: string;
      fetchError?: string;
    }> = [];
    for (const c of COVER_SPECS) {
      const { storageId, byteSize, mimeType, source, fetchError } =
        await fetchOrBuildCover(ctx, c.spec);
      coverByKey.set(c.key, {
        storageId,
        mimeType,
        byteSize,
        altText: c.spec.title,
      });
      coverDiagnostics.push({ key: c.key, source, fetchError });
    }

    // 3. Seed users (idempotent on displayName).
    await runM("seedHelpers:seedUsers", {
      items: USER_SPECS.map((u) => ({
        ...u,
        emailVerificationTime: u.emailVerificationTime ?? now,
      })),
    });

    // 4. Resolve user IDs for foreign keys.
    const allUsers = (await runQ("seedHelpers:listUsers", {})) as Doc<"users">[];
    const userByDisplay = new Map<string, Doc<"users">>();
    for (const u of allUsers) {
      if (!u.displayName) continue;
      userByDisplay.set(u.displayName, u);
    }
    const operatorId = userByDisplay.get("Cmdr. Vega")?._id;
    if (!operatorId) {
      throw new Error(
        "seedDemo: 'Cmdr. Vega' user not found after seeding users — abort before stories/lore reference an orphan author.",
      );
    }

    const authorIdFor = (displayName?: string) =>
      (displayName ? userByDisplay.get(displayName)?._id : null) ?? operatorId;

    // 5. Stories.
    await runM("seedHelpers:seedStories", {
      items: STORY_SPECS.map((s) => {
        const cover = s.coverKey ? coverByKey.get(s.coverKey) : undefined;
        return {
          slug: s.slug,
          title: s.title,
          excerpt: s.excerpt,
          content: s.content,
          series: s.series,
          factions: s.factions,
          sectors: s.sectors,
          classification: s.classification,
          tags: s.tags,
          views: s.views,
          commentCount: s.commentCount,
          readMinutes: s.readMinutes,
          status: s.status,
          publishedAt: s.publishedAt
            ? s.publishedAt > 0
              ? s.publishedAt
              : now - (STORY_SPECS.indexOf(s) === 0 ? 3 : 6) * 86_400_000
            : now - 30 * 86_400_000,
          submittedAt: s.submittedAt
            ? s.submittedAt > 0
              ? s.submittedAt
              : now - 86_400_000
            : undefined,
          featured: s.featured,
          featuredOrder: s.featuredOrder,
          coverStorageId: cover?.storageId,
          coverMeta: cover
            ? {
                mimeType: cover.mimeType,
                byteSize: cover.byteSize,
                altText: cover.altText,
              }
            : undefined,
          authorId: authorIdFor(s.author),
          createdAt: now - 30 * 86_400_000,
          updatedAt: now,
        };
      }),
    });

    // 6. Lore entries.
    await runM("seedHelpers:seedLore", {
      items: LORE_SPECS.map((l) => {
        const cover = l.coverKey ? coverByKey.get(l.coverKey) : undefined;
        return {
          slug: l.slug,
          title: l.title,
          excerpt: l.excerpt,
          content: l.content,
          faction: l.faction,
          sector: l.sector,
          classification: l.classification,
          entryType: l.entryType,
          featured: l.featured,
          featuredOrder: l.featuredOrder,
          coverStorageId: cover?.storageId,
          coverMeta: cover
            ? {
                mimeType: cover.mimeType,
                byteSize: cover.byteSize,
                altText: cover.altText,
              }
            : undefined,
          authorId: authorIdFor(l.author),
          createdAt: now,
        };
      }),
    });

    // 6b. Lore Library (bibles / images / databases).
    await runM("seedHelpers:seedLoreLibrary", {
      items: LORE_LIBRARY_SPECS.map((l) => {
        const cover = l.coverKey ? coverByKey.get(l.coverKey) : undefined;
        return {
          slug: l.slug,
          title: l.title,
          description: l.description,
          loreType: l.loreType,
          status: l.status,
          authorId: authorIdFor(l.author),
          faction: l.faction,
          sector: l.sector,
          classification: l.classification,
          fileStorageId: cover?.storageId,
          fileMeta: cover
            ? {
                fileName: `${l.slug}.jpg`,
                mimeType: cover.mimeType,
                byteSize: cover.byteSize,
              }
            : undefined,
          coverStorageId: cover?.storageId,
          coverMeta: cover
            ? {
                mimeType: cover.mimeType,
                byteSize: cover.byteSize,
                altText: cover.altText,
              }
            : undefined,
          databaseUrl: l.databaseUrl,
          databaseName: l.databaseName,
          featured: l.featured,
          featuredOrder: l.featuredOrder,
          submittedAt:
            l.status === "submitted" ? now - 86_400_000 : undefined,
          createdAt:
            now - (l.status === "submitted" ? 2 : 7) * 86_400_000,
        };
      }),
    });

    // 7. Transmissions.
    await runM("seedHelpers:seedTransmissions", {
      items: TRANSMISSION_SPECS.map((t) => {
        const cover = t.coverKey ? coverByKey.get(t.coverKey) : undefined;
        return {
          slug: t.slug,
          title: t.title,
          description: t.description,
          videoUrl: t.videoUrl,
          transmissionType: t.transmissionType,
          durationSeconds: t.durationSeconds,
          featured: t.featured,
          featuredOrder: t.featuredOrder,
          coverStorageId: cover?.storageId,
          coverMeta: cover
            ? {
                mimeType: cover.mimeType,
                byteSize: cover.byteSize,
                altText: cover.altText,
              }
            : undefined,
          createdAt: now,
        };
      }),
    });

    // 8. Resources / Missions / Sectors / Fleet Reports / Groups / Threads.
    await runM("seedHelpers:seedResources", { items: RESOURCE_SPECS });
    await runM("seedHelpers:seedMissions", { items: MISSION_SPECS });
    await runM("seedHelpers:seedSectors", { items: SECTOR_SPECS });
    await runM("seedHelpers:seedFleetReports", {
      items: FLEET_REPORTS.map((f) => ({
        title: f.title,
        content: f.content,
        authorId: authorIdFor(f.authorDisplayName),
        createdAt: now,
      })),
    });
    await runM("seedHelpers:seedGroups", { items: GROUP_SPECS });

    // 8b. Group workspace: memberships (roles), posts, chat, missions/events.
    const allGroups = (await runQ("seedHelpers:listGroups", {})) as Doc<"groups">[];
    const groupBySlug = new Map<string, Doc<"groups">>();
    for (const g of allGroups) groupBySlug.set(g.slug, g);

    const groupIdFor = (slug: string) => groupBySlug.get(slug)?._id;
    const userIdFor = (displayName: string) =>
      userByDisplay.get(displayName)?._id;

    const GROUP_MEMBERS = GROUP_MEMBER_SPECS.map((m) => ({
      groupId: groupIdFor(m.groupSlug),
      userId: userIdFor(m.userDisplay),
      role: m.role,
      joinedAt: now - m.daysAgo * 86_400_000,
    })).filter((m) => m.groupId && m.userId);
    if (GROUP_MEMBERS.length !== GROUP_MEMBER_SPECS.length) {
      throw new Error(
        "seedDemo: group-workspace membership references a missing group/user — check GROUP_MEMBER_SPECS.",
      );
    }
    await runM("seedHelpers:seedGroupMembers", { items: GROUP_MEMBERS });

    await runM("seedHelpers:seedGroupPosts", {
      items: GROUP_POST_SPECS.map((p) => ({
        groupId: groupIdFor(p.groupSlug),
        authorId: userIdFor(p.authorDisplay),
        title: p.title,
        body: p.body,
        kind: p.kind,
        pinned: p.pinned ?? false,
        createdAt: now - p.hoursAgo * 3_600_000,
      })).filter((p) => p.groupId && p.authorId),
    });

    await runM("seedHelpers:seedGroupMessages", {
      items: GROUP_MESSAGE_SPECS.map((msg) => ({
        groupId: groupIdFor(msg.groupSlug),
        authorId: userIdFor(msg.authorDisplay),
        body: msg.body,
        createdAt: now - msg.hoursAgo * 3_600_000,
      })).filter((msg) => msg.groupId && msg.authorId),
    });

    await runM("seedHelpers:seedGroupEvents", {
      items: GROUP_EVENT_SPECS.map((ev) => ({
        groupId: groupIdFor(ev.groupSlug),
        createdBy: userIdFor(ev.createdByDisplay),
        title: ev.title,
        description: ev.description,
        kind: ev.kind,
        status: ev.status,
        scheduledAt: ev.scheduledDaysAhead
          ? now + ev.scheduledDaysAhead * 86_400_000
          : undefined,
        createdAt: now - ev.hoursAgo * 3_600_000,
        signupUserIds: ev.signupDisplays
          .map((d) => userIdFor(d))
          .filter((id): id is Id<"users"> => Boolean(id)),
      })).filter((ev) => ev.groupId && ev.createdBy),
    });

    await runM("seedHelpers:seedThreads", {
      items: THREAD_SPECS.map((t) => ({
        ...t,
        authorId: authorIdFor("Mirra Singh"),
        replyCount: 0,
        lastActivityAt: now,
        createdAt: now,
      })),
    });

    // 9. Activity (once-only table).
    await runM("seedHelpers:seedActivity", {
      items: ACTIVITY_ENTRIES.map((a) => ({
        actorId: userByDisplay.get(a.actor)?._id ?? operatorId,
        verb: a.verb,
        targetType: a.targetType,
        targetId: a.targetId,
        url: a.url,
        summary: a.summary,
        createdAt: now - a.daysAgo * 86_400_000,
      })),
    });

    // 10. Moderation / Identity / AuditLog.
    await runM("seedHelpers:seedModeration", {
      items: MODERATION_ITEMS.map((m) => ({
        ...m,
        reporterId: undefined,
        createdAt: now - m.daysAgo * 86_400_000,
      })),
    });
    await runM("seedHelpers:seedIdentity", {
      items: [
        {
          userId: operatorId,
          status: "pending",
          notes: "Awaiting operator review.",
          createdAt: now - 86_400_000,
          updatedAt: now - 86_400_000,
        },
      ],
    });
    await runM("seedHelpers:seedAudit", {
      items: [
        {
          actorId: operatorId,
          action: "story.publish",
          target: "story:seed",
          createdAt: now - 3 * 86_400_000,
        },
      ],
    });

    return { ok: true, seededAt: now, covers: coverDiagnostics };
  },
});
