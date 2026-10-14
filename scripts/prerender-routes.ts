/**
 * Prerender script — emits a directory HTML file per public route
 * (`dist/<route>/index.html`) from the built `dist/index.html` shell.
 *
 * Why: the app is a client-rendered SPA — every URL serves the same shell,
 * so crawlers that fetch `/lore` see the *homepage's* title/description/
 * canonical (crawler-first rendering never runs React). Google benches
 * near-duplicate documents: "Discovered - currently not indexed",
 * "Duplicate, Google chose different canonical", etc.
 *
 * Emitting one HTML file per route gives every URL unique crawler-first
 * metadata. The matching .htaccess rules internally rewrite `/lore` →
 * `lore.html` when that file exists — an internal rewrite, NOT a redirect,
 * so clean URLs serve unique content directly. Client routing is unaffected:
 * the SPA bootstraps normally and React Router takes over.
 *
 * Every emitted file is FLAT — at the root of dist/, never in a
 * subdirectory. Nested routes are flattened with dashes instead
 * (`/tools/assistant` → `tools-assistant.html`, `/lore/submit` →
 * `lore-submit.html`), and .htaccess resolves the dashed form first. Reason:
 * a real `dist/lore/` directory sitting next to `lore.html` makes mod_dir
 * 301 `/lore` → `/lore/`, so an indexed URL starts answering with a redirect
 * (and mod_rewrite skips no-slash directory URLs, so no rule can win that
 * race). The guard below enforces the flat invariant at build time.
 *
 * It also rewrites the static `<h1 id="uf-static-title">` that the shell's
 * boot screen carries (see index.html). Every route's HTML therefore ships
 * with a real heading before any JavaScript runs — Bing's Site Scan flags a
 * missing H1 per page, and the SPA's own `<h1>` only exists after React
 * mounts. src/main.tsx deletes the boot screen (and with it this H1) as soon
 * as the bundle loads, so the rendered page never has two H1s.
 *
 * Added to the build chain in package.json (after `vite build`, before
 * `package:source`), so CI produces the same files as local builds.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
// Review content + schema builders are imported from the app's single source
// of truth so the JSON-LD emitted here can never drift from what /reviews
// actually renders (Google requires markup to match visible content).
import { reviewsGraphJsonLd } from "../src/lib/reviews";

const SITE = "https://starforcebase1198.com";
const distDir = path.resolve("dist");

type Route = {
  path: string;
  title: string;
  description: string;
  /**
   * Heading text for the crawler-first `<h1 id="uf-static-title">` in the
   * boot screen. Kept identical to the heading the page itself renders (the
   * `PageHero`/hero `title` prop) so the H1 a crawler reads from the static
   * HTML matches the one visitors see, and so the boot screen shows the page
   * name while the app loads. Edit both together when a page's heading moves.
   */
  h1: string;
  /**
   * Structured data baked into the static HTML. `usePageMeta` only injects
   * JSON-LD after JavaScript runs, and most AI crawlers never run it — so the
   * crawler-facing copy has to be written here, at build time.
   */
  jsonLd?: Record<string, unknown>;
};

// Public, indexable routes only. Member/private pages (/account, /messages,
// /operator/*, /auth) are noindexed at runtime by usePageMeta/RouteSyncer and
// must not be emitted here either. robots.txt deliberately has no Disallow
// lines — `Disallow` parks the URLs in Search Console's "Blocked by robots.txt"
// report instead of keeping them out of the index.
// Root "/" is skipped — dist/index.html already carries the homepage meta.
const ROUTES: Route[] = [
  {
    path: "/stories",
    title: "Fleet Stories — Star Force Base 1198",
    h1: "Transmissions from the Fleet",
    description:
      "Original fiction from the Star Force community — field reports, legends, and serialized adventures from across the galaxy.",
  },
  {
    path: "/universe",
    title: "Universe Overview — Star Force Base 1198",
    h1: "Universe Overview",
    description:
      "The Ultra Force Universe is a vast, cinematic science fiction world created by Ron Brown — its setting, the Star Force, major factions, starships, and timeline.",
    jsonLd: {
      "@type": "AboutPage",
      name: "Ultra Force Universe Overview",
      description:
        "The Ultra Force Universe is a vast, cinematic science fiction world created by Ron Brown — its setting, the Star Force, major factions, starships, and timeline.",
    },
  },
  {
    path: "/lore",
    title: "Lore Archive — Star Force Base 1198",
    h1: "The Records of Sector 1198",
    description:
      "Explore the canonical lore of the Star Force universe — factions, sectors, discoveries, and history.",
  },
  {
    path: "/map",
    title: "Star Atlas — Star Force Base 1198",
    h1: "Chart the Orion Triangle.",
    description:
      "Interactive galaxy map of the Orion Triangle. Chart new systems, propose discoveries, and build the fleet's knowledge of the frontier.",
  },
  {
    path: "/missions",
    title: "Missions — Star Force Base 1198",
    h1: "Take the operation.",
    description:
      "Take on active operations: exploration, lore bounties, community events, and rank advancement.",
  },
  {
    path: "/arcs",
    title: "Lore Arcs — Star Force Base 1198",
    h1: "Lore Arcs.",
    description:
      "Collaborative storylines written by the fleet. Contribute a chapter to an open arc and earn your place in canon.",
  },
  {
    path: "/awards",
    title: "Awards & Honors — Star Force Base 1198",
    h1: "Awards & Honors.",
    description:
      "Service ribbons, achievement badges, medals, and the Quartermaster's Locker — the decorations and collectible assets of the Star Force fleet.",
  },
  {
    path: "/vault",
    title: "Signal Vault — Star Force Base 1198",
    h1: "The Signal Vault",
    description:
      "Decrypted signals, ciphers, and classified transmissions from the Star Force archive.",
  },
  {
    path: "/events",
    title: "Operations Calendar — Star Force Base 1198",
    h1: "The Operations Calendar",
    description:
      "Upcoming events, operations, and community gatherings across Star Force Base 1198.",
  },
  {
    path: "/contests",
    title: "Lore Contests — Star Force Base 1198",
    h1: "The canon is written by the fleet.",
    description:
      "Competitive lore-writing events. Claim a prompt, win Star Credits, and canonize your entry.",
  },
  {
    path: "/store",
    title: "Requisition Depot — Star Force Base 1198",
    h1: "Official fleet requisitions.",
    description:
      "Spend Star Credits on avatar frames, badges, cosmetics, and cosmetic upgrades.",
  },
  {
    path: "/fleet-registry",
    title: "Star Force Fleet Database — Star Force Base 1198",
    h1: "FLEET DATABASE",
    description:
      "Service histories, armament sheets, and black-box files for the fleet's vessels.",
  },
  {
    path: "/blog",
    title: "Blog — Star Force Base 1198",
    h1: "Dispatches from the command center.",
    description:
      "Dispatches, dev logs, and announcements from Star Force Command.",
  },
  {
    path: "/reviews",
    title: "The Signal Log — What Cadets and Creators Say | Star Force Base 1198",
    h1: "What the fleet says after the debrief.",
    description:
      "Transmissions from Star Force operators: what the canon review, the Star Atlas, and life on the base are actually like — plus how to add yours.",
    jsonLd: reviewsGraphJsonLd(),
  },
  {
    path: "/faqs",
    title: "FAQs — Star Force Base 1198",
    h1: "Questions from the fleet.",
    description:
      "Answers to common questions about ranks, Star Credits, lore submission, and life on the base.",
  },
  {
    path: "/changelog",
    title: "Changelog — Star Force Base 1198",
    h1: "What's new at the Base",
    description:
      "Every recorded improvement to Star Force Base 1198, newest first.",
  },
  {
    path: "/videos",
    title: "Videos — Star Force Base 1198",
    h1: "Audio/Visual Archive",
    description:
      "Broadcasts, lore trailers, and community media from the Star Force universe.",
  },
  {
    path: "/maps",
    title: "Cartography Deck — Star Force Base 1198",
    h1: "Lore maps & sector claims.",
    description:
      "Interactive galaxy maps, sector charts, and community cartography tools.",
  },
  {
    path: "/community",
    title: "Community — Star Force Base 1198",
    h1: "Step inside the command center.",
    description:
      "The living heart of the base: activity, groups, members, and forums.",
  },
  {
    path: "/forums",
    title: "Forums — Star Force Base 1198",
    h1: "Long-form discussion ranks.",
    description:
      "Discussion boards for the Star Force community — lore, strategy, and off-duty comms.",
  },
  {
    path: "/groups",
    title: "Fleet Groups — Star Force Base 1198",
    h1: "Find your people.",
    description:
      "Squads, divisions, and crew hubs across the Star Force fleet.",
  },
  {
    path: "/members",
    title: "Fleet Roster — Star Force Base 1198",
    h1: "Roster of the fleet.",
    description:
      "Browse the members of Star Force — pilots, specialists, and command staff.",
  },
  {
    path: "/leaderboard",
    title: "Fleet Leaderboard — Star Force Base 1198",
    h1: "The Leaderboard",
    description:
      "The most active pilots, authors, and explorers on the base this season.",
  },
  {
    path: "/tools/assistant",
    title: "Tools Assistant — Star Force Base 1198",
    h1: "AI Lore Assistant.",
    description:
      "AI-assisted tools for lore drafting and command console support.",
  },
  {
    path: "/membership",
    title: "Membership — Star Force Base 1198",
    h1: "Enter the Ultra Force Universe",
    description:
      "Free, Pro, and Elite tiers — join Star Force and unlock the full base.",
  },
  {
    path: "/resources",
    title: "Resources — Star Force Base 1198",
    h1: "Guides, tools, and policies.",
    description:
      "Guides, tools, policies, and onboarding materials for Star Force personnel.",
  },
  {
    path: "/support",
    title: "Support — Star Force Base 1198",
    h1: "Open a channel. We answer.",
    description:
      "Get help with your account, membership, or the base.",
  },
  {
    path: "/manual",
    title: "New Cadets Manual — Star Force Base 1198",
    h1: "New Cadets Manual",
    description:
      "Everything a new cadet needs: ranks, Star Credits, the Cosmetic Lab, and contribution paths.",
  },
  {
    path: "/first-watch",
    title: "First Watch — Star Force Base 1198",
    h1: "Your first watch begins.",
    description:
      "The new cadet activation guide: complete Orientation, explore the Atlas, create your first lore entry, choose your faction, and earn your first artifact.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — Star Force Base 1198",
    h1: "Privacy Policy",
    description:
      "How Star Force Base 1198 collects, uses, and protects your data.",
  },
  {
    path: "/terms",
    title: "Terms of Service — Star Force Base 1198",
    h1: "Terms of Service",
    description:
      "The rules of engagement for Star Force Base 1198.",
  },

  // ---- Public nav pages outside the sitemap's core list ------------------
  // These pages are public and linked from the site navigation, so crawlers
  // index them too. Before this block they were served by the SPA fallback
  // (index.html) and therefore carried the *homepage's* static H1 — one
  // shared heading across many URLs. Webmaster Tools reports the H1 issue
  // per page, so each of these gets its own heading (identical to the heading
  // the page itself renders) plus its own title/description/canonical.
  //
  // Deliberately not emitted: /auth, /account, /messages (noindexed at
  // runtime), /canon-review (sign-in / operators only), /collection (member
  // data), /search (no content of its own), and the :slug detail routes
  // (their headings come from the database at request time).
  {
    path: "/factions",
    title: "Faction Profiles — Star Force Base 1198",
    h1: "Powers, blocs, and command structures.",
    description:
      "The canon faction registry: human powers, Orion Triangle bodies, fleet commands, and species delegations of the Ultra Force universe.",
  },
  {
    path: "/high-command",
    title: "High Command — Star Force Base 1198",
    h1: "The High Command",
    description:
      "The Capped Star Force progression system: your rank and XP progress, the Ensign induction checklist, the 10 Rear Admiral seats, and the promotion waitlist.",
  },
  {
    path: "/creator",
    title: "The Forge of Canon — Creator Hub · Star Force Base 1198",
    h1: "The Forge of Canon",
    description:
      "Draft new canon, reinforce existing records, deploy with your unit, and earn recognition aboard Star Force Base 1198 — the Creator Hub, Forge of Canon.",
  },
  {
    path: "/biology-lab",
    title: "Biology Lab — Star Force Base 1198",
    h1: "Species database of the fleet.",
    description:
      "The species database of the Ultra Force canon: physiology, culture, habitat, and canon notes for every species on file.",
  },
  {
    path: "/research-lab",
    title: "Research Lab — Star Force Base 1198",
    h1: "Technology database of the fleet.",
    description:
      "The technology database of the Ultra Force canon: specs, functionality, tactical and civilian applications, and canon standing for every system on file.",
  },
  {
    path: "/canon-images",
    title: "Canon Image Library — Star Force Base 1198",
    h1: "Canon Image Library",
    description:
      "The public visual canon: concept art, portraits, blueprints, and mission artwork approved into the Ultra Force canon.",
  },
  {
    path: "/storyboards",
    title: "Storyboard Builder — Star Force Base 1198",
    h1: "Storyboard Builder",
    description:
      "Compose canon storyboards panel by panel — captions, scene metadata, mission links, and export to the Canon Image Library.",
  },
  {
    path: "/artists",
    title: "Fleet Artists — Star Force Base 1198",
    h1: "Fleet Artists",
    description:
      "Artist profiles, portfolios, and canon visual contributions of the Ultra Force.",
  },
  {
    path: "/activity",
    title: "Activity Feed — Star Force Base 1198",
    h1: "Comms channel open.",
    description:
      "Recent fleet activity — published stories, filed reports, new members.",
  },
  {
    path: "/submit",
    title: "Submit Story — Star Force Base 1198",
    h1: "Transmit your story.",
    description: "Submit your story for review by the editorial team.",
  },
  {
    path: "/lore/submit",
    title: "Submit Lore — Star Force Base 1198",
    h1: "Submit lore.",
    description: "Submit a new lore entry for the Star Force archive.",
  },
  {
    path: "/wings",
    title: "Earn Your Wings — Star Force Base 1198",
    h1: "Earn your wings.",
    description:
      "The Wings ceremony: when the Bridge awards your wings, choose the fighter you will fly. Permanent. Personal. Earned.",
  },
  {
    path: "/honor",
    title:
      "1st Inter-Dimensional Fleet — Fighter Honor Wall | Star Force Base 1198",
    h1: "1st Inter-Dimensional Fleet",
    description:
      "The official fighter honor wall of the 1st Inter-Dimensional Fleet. Every awarded StarCraft fighter: the pilot, their callsign, the designation, and the permanent hull number.",
  },
  {
    path: "/fleet-registry/service-histories",
    title: "Service Histories — Star Force Fleet Database",
    h1: "SERVICE HISTORIES",
    description:
      "Operational service records, deployments, refits, and milestones for every vessel in the Star Force fleet.",
  },
  {
    path: "/fleet-registry/armament-sheets",
    title: "Armament Sheets — Star Force Fleet Database",
    h1: "ARMAMENT SHEETS",
    description:
      "Weapons loadouts, defensive systems, and ammunition profiles for every vessel class in the Star Force fleet.",
  },
  {
    path: "/fleet-registry/black-box-files",
    title: "Black-box Files — Star Force Fleet Database",
    h1: "BLACK-BOX FILES",
    description:
      "Classified incident reports and black-box recordings accessible to Star Force operators only.",
  },
];

const shell = await readFile(path.join(distDir, "index.html"), "utf8");

// The boot screen's heading placeholder, as written in index.html.
const STATIC_H1_RE = /<h1 id="uf-static-title">[\s\S]*?<\/h1>/;

/** Escape page headings (`Awards & Honors.`) for HTML text content. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Flat output file name for a route: `/lore` → `lore.html`,
 * `/tools/assistant` → `tools-assistant.html`. Never a subdirectory — see
 * the mod_dir note in the file header, and the matching .htaccess rule.
 */
function outputName(routePath: string): string {
  const trimmed = routePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return (trimmed === "" ? "index" : trimmed.replace(/\//g, "-")) + ".html";
}

let written = 0;

for (const route of ROUTES) {
  const url = `${SITE}${route.path}`;
  let html = shell;

  if (!STATIC_H1_RE.test(html)) {
    throw new Error(
      `[prerender] no <h1 id="uf-static-title"> placeholder in the shell (${route.path})`,
    );
  }
  html = html.replace(
    STATIC_H1_RE,
    `<h1 id="uf-static-title">${escapeHtml(route.h1)}</h1>`,
  );

  html = html.replace(/<title>.*?<\/title>/s, `<title>${route.title}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta name="description" content="${route.description}" />`,
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/,
    `<link rel="canonical" href="${url}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/,
    `<meta property="og:url" content="${url}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/,
    `<meta property="og:title" content="${route.title}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta property="og:description" content="${route.description}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/,
    `<meta name="twitter:title" content="${route.title}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/?>/,
    `<meta name="twitter:description" content="${route.description}" />`,
  );

  // Structured data — injected immediately before </head> so it lands in the
  // static document crawlers fetch, not in a post-hydration side effect.
  if (route.jsonLd) {
    const before = (html.match(/application\/ld\+json/g) ?? []).length;
    const payload = JSON.stringify(
      { "@context": "https://schema.org", ...route.jsonLd },
      null,
      2,
    );
    const tag = `  <script type="application/ld+json">\n${payload}\n  </script>\n`;
    const headEnd = html.lastIndexOf("</head>");
    if (headEnd === -1) {
      throw new Error(`[prerender] no </head> found for ${route.path}`);
    }
    html = html.slice(0, headEnd) + tag + html.slice(headEnd);
    const after = (html.match(/application\/ld\+json/g) ?? []).length;
    if (after !== before + 1) {
      throw new Error(
        `[prerender] JSON-LD injection failed for ${route.path} `,
      );
    }
  }

  // Fail loudly if a replacement ever misses — a silently-unmodified copy of
  // the shell would ship exactly the duplicate-content problem we're fixing.
  if (
    html === shell ||
    !html.includes(route.title) ||
    !html.includes(`>${escapeHtml(route.h1)}</h1>`) ||
    !html.includes(`<link rel="canonical" href="${url}" />`)
  ) {
    throw new Error(`[prerender] meta replacement failed for ${route.path}`);
  }

  const outPath = path.join(distDir, outputName(route.path));
  // Invariant that keeps Apache's mod_dir from redirecting an indexed URL.
  if (path.dirname(outPath) !== distDir) {
    throw new Error(
      `[prerender] ${route.path} would write into a subdirectory (${outPath}); ` +
        `prerendered pages must stay flat next to index.html`,
    );
  }
  await mkdir(distDir, { recursive: true });
  await writeFile(outPath, html);
  written++;
}

console.log(`[prerender] wrote ${written} per-route HTML files from shell`);