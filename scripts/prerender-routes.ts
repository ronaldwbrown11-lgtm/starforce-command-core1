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
 * so clean URLs serve unique content directly (directory-style emission
 * was rejected: mod_dir 301s `/lore` → `/lore/`, recreating the
 * "Page with redirect" problem). Client routing is unaffected: the SPA
 * bootstraps normally and React Router takes over.
 *
 * Added to the build chain in package.json (after `vite build`, before
 * `package:source`), so CI produces the same files as local builds.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const SITE = "https://starforcebase1198.com";
const distDir = path.resolve("dist");

type Route = { path: string; title: string; description: string };

// Public, indexable routes only. Member/private pages (/account, /messages,
// /operator/*, /auth) are excluded by robots.txt or noindex by design.
// Root "/" is skipped — dist/index.html already carries the homepage meta.
const ROUTES: Route[] = [
  {
    path: "/stories",
    title: "Fleet Stories — Star Force Base 1198",
    description:
      "Original fiction from the Star Force community — field reports, legends, and serialized adventures from across the galaxy.",
  },
  {
    path: "/lore",
    title: "Lore Archive — Star Force Base 1198",
    description:
      "Explore the canonical lore of the Star Force universe — factions, sectors, discoveries, and history.",
  },
  {
    path: "/map",
    title: "Star Atlas — Star Force Base 1198",
    description:
      "Interactive galaxy map of the Orion Triangle. Chart new systems, propose discoveries, and build the fleet's knowledge of the frontier.",
  },
  {
    path: "/missions",
    title: "Missions — Star Force Base 1198",
    description:
      "Take on active operations: exploration, lore bounties, community events, and rank advancement.",
  },
  {
    path: "/vault",
    title: "Signal Vault — Star Force Base 1198",
    description:
      "Decrypted signals, ciphers, and classified transmissions from the Star Force archive.",
  },
  {
    path: "/events",
    title: "Operations Calendar — Star Force Base 1198",
    description:
      "Upcoming events, operations, and community gatherings across Star Force Base 1198.",
  },
  {
    path: "/contests",
    title: "Lore Contests — Star Force Base 1198",
    description:
      "Competitive lore-writing events. Claim a prompt, win Star Credits, and canonize your entry.",
  },
  {
    path: "/store",
    title: "Requisition Depot — Star Force Base 1198",
    description:
      "Spend Star Credits on avatar frames, badges, cosmetics, and cosmetic upgrades.",
  },
  {
    path: "/fleet-registry",
    title: "Star Force Fleet Database — Star Force Base 1198",
    description:
      "Service histories, armament sheets, and black-box files for the fleet's vessels.",
  },
  {
    path: "/blog",
    title: "Blog — Star Force Base 1198",
    description:
      "Dispatches, dev logs, and announcements from Star Force Command.",
  },
  {
    path: "/faqs",
    title: "FAQs — Star Force Base 1198",
    description:
      "Answers to common questions about ranks, Star Credits, lore submission, and life on the base.",
  },
  {
    path: "/changelog",
    title: "Changelog — Star Force Base 1198",
    description:
      "Every recorded improvement to Star Force Base 1198, newest first.",
  },
  {
    path: "/videos",
    title: "Videos — Star Force Base 1198",
    description:
      "Broadcasts, lore trailers, and community media from the Star Force universe.",
  },
  {
    path: "/maps",
    title: "Cartography Deck — Star Force Base 1198",
    description:
      "Interactive galaxy maps, sector charts, and community cartography tools.",
  },
  {
    path: "/community",
    title: "Community — Star Force Base 1198",
    description:
      "The living heart of the base: activity, groups, members, and forums.",
  },
  {
    path: "/forums",
    title: "Forums — Star Force Base 1198",
    description:
      "Discussion boards for the Star Force community — lore, strategy, and off-duty comms.",
  },
  {
    path: "/groups",
    title: "Fleet Groups — Star Force Base 1198",
    description:
      "Squads, divisions, and crew hubs across the Star Force fleet.",
  },
  {
    path: "/members",
    title: "Fleet Roster — Star Force Base 1198",
    description:
      "Browse the members of Star Force — pilots, specialists, and command staff.",
  },
  {
    path: "/leaderboard",
    title: "Fleet Leaderboard — Star Force Base 1198",
    description:
      "The most active pilots, authors, and explorers on the base this season.",
  },
  {
    path: "/tools/assistant",
    title: "Tools Assistant — Star Force Base 1198",
    description:
      "AI-assisted tools for lore drafting and command console support.",
  },
  {
    path: "/membership",
    title: "Membership — Star Force Base 1198",
    description:
      "Free, Pro, and Elite tiers — join Star Force and unlock the full base.",
  },
  {
    path: "/resources",
    title: "Resources — Star Force Base 1198",
    description:
      "Guides, tools, policies, and onboarding materials for Star Force personnel.",
  },
  {
    path: "/support",
    title: "Support — Star Force Base 1198",
    description:
      "Get help with your account, membership, or the base.",
  },
  {
    path: "/manual",
    title: "New Cadets Manual — Star Force Base 1198",
    description:
      "Everything a new cadet needs: ranks, Star Credits, the Cosmetic Lab, and contribution paths.",
  },
  {
    path: "/first-watch",
    title: "First Watch — Star Force Base 1198",
    description:
      "The new cadet activation guide: complete Orientation, explore the Atlas, create your first lore entry, choose your faction, and earn your first artifact.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — Star Force Base 1198",
    description:
      "How Star Force Base 1198 collects, uses, and protects your data.",
  },
  {
    path: "/terms",
    title: "Terms of Service — Star Force Base 1198",
    description:
      "The rules of engagement for Star Force Base 1198.",
  },
];

const shell = await readFile(path.join(distDir, "index.html"), "utf8");

let written = 0;

for (const route of ROUTES) {
  const url = `${SITE}${route.path}`;
  let html = shell;

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

  // Fail loudly if a replacement ever misses — a silently-unmodified copy of
  // the shell would ship exactly the duplicate-content problem we're fixing.
  if (
    html === shell ||
    !html.includes(route.title) ||
    !html.includes(`<link rel="canonical" href="${url}" />`)
  ) {
    throw new Error(`[prerender] meta replacement failed for ${route.path}`);
  }

  const outPath = path.join(distDir, `${route.path}.html`);
  const outDir = path.dirname(outPath);
  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, html);
  written++;
}

console.log(`[prerender] wrote ${written} per-route HTML files from shell`);