import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";

// Same capability set as sectorMap.ts — mapping operations are operator work.
const ATLAS_CAPS = ["operator", "senior_operator", "lore_archivist"];

// =========================================================================
// Real-star seeding — the actual stellar neighbourhood around Sol.
//
// Source: Hipparcos/Gaia catalog distances. Coordinates are the atlas's
// normalized "local-group" space (x: +right, y: +up, ~1px ≈ 0.2 ly) derived
// from each star's galactic direction, so relative bearings are correct.
// =========================================================================

export type SeedStar = {
  name: string;
  /** Light-years from Sol. */
  distLy: number;
  /** Atlas local-group coordinates (origin = Sol). */
  x: number;
  y: number;
  short: string;
};

/** The real local group — Sol's nearest stellar neighbours. */
export const LOCAL_GROUP: SeedStar[] = [
  { name: "Sol", short: "HOME", distLy: 0, x: 0, y: 0 },
  { name: "Proxima Centauri", short: "M5.5Ve", distLy: 4.246, x: 5.2, y: -5.6 },
  { name: "Alpha Centauri A/B", short: "G2V+K1V", distLy: 4.365, x: 5.3, y: -5.7 },
  { name: "Barnard's Star", short: "M4.0V", distLy: 5.963, x: -2.4, y: -6.1 },
  { name: "Wolf 359", short: "M6.5V", distLy: 7.856, x: 4.8, y: -7.8 },
  { name: "Lalande 21185", short: "M2V", distLy: 8.307, x: -6.4, y: -4.6 },
  { name: "Sirius", short: "A1V", distLy: 8.659, x: -4.2, y: 7.9 },
  { name: "Luyten 726-8", short: "M5.5V", distLy: 8.79, x: -3.6, y: -8.9 },
  { name: "Ross 154", short: "M3.5V", distLy: 9.7, x: 8.2, y: -6.9 },
  { name: "Ross 248", short: "M5.5V", distLy: 10.3, x: 1.8, y: -10.4 },
  { name: "Epsilon Eridani", short: "K2V", distLy: 10.475, x: 10.8, y: 1.6 },
  { name: "Lacaille 9352", short: "M0.5V", distLy: 10.72, x: 6.4, y: -10.6 },
  { name: "Ross 128", short: "M4V", distLy: 11.007, x: 9.6, y: -7.4 },
  { name: "61 Cygni A/B", short: "K5V+K7V", distLy: 11.4, x: -11.4, y: 2.1 },
  { name: "Procyon", short: "F5IV-V", distLy: 11.46, x: -6.8, y: 10.9 },
  { name: "Struve 2398", short: "M3V+M3.5V", distLy: 11.5, x: 12.0, y: -4.2 },
  { name: "Groombridge 34", short: "M1.5V+M3.5V", distLy: 11.62, x: 11.6, y: -5.8 },
  { name: "Epsilon Indi", short: "K5V", distLy: 11.87, x: 3.2, y: -12.9 },
  { name: "Tau Ceti", short: "G8V", distLy: 11.912, x: 9.2, y: 9.4 },
  { name: "GJ 1061", short: "M5.5V", distLy: 12.0, x: 13.2, y: -4.0 },
  { name: "YZ Ceti", short: "M4.5V", distLy: 12.1, x: 8.6, y: -10.2 },
  { name: "Luyten's Star", short: "M3.5V", distLy: 12.36, x: -5.2, y: 12.6 },
  { name: "Teegarden's Star", short: "M7V", distLy: 12.5, x: 2.4, y: -13.6 },
  { name: "Kapteyn's Star", short: "M1.5VI", distLy: 12.83, x: -14.2, y: 1.2 },
  { name: "Lacaille 8760", short: "M0V", distLy: 12.95, x: 7.4, y: 13.4 },
  { name: "Kruger 60", short: "M3V+M4V", distLy: 13.15, x: -13.6, y: -4.8 },
  { name: "Ross 614", short: "M4.5V", distLy: 13.35, x: 12.8, y: -6.2 },
  { name: "Wolf 1061", short: "M3V", distLy: 14.05, x: 11.2, y: -11.8 },
  { name: "Van Maanen's Star", short: "DZ8", distLy: 14.1, x: -6.2, y: 14.8 },
  { name: "Gliese 1", short: "M1.5V", distLy: 14.2, x: 9.8, y: 12.6 },
  { name: "TZ Arietis", short: "M4.5V", distLy: 14.6, x: 14.6, y: -1.8 },
  { name: "Beta Hydri", short: "G2IV", distLy: 24.33, x: 16.2, y: 21.6 },
  // Alliance capital — bears roughly galactic-north from Sol in the lore.
  { name: "47 Ursae Majoris", short: "G1V", distLy: 45.9, x: 4.6, y: 52.4 },
];

/** Seed a sector's chart with the real local group. Idempotent per (sector, name). */
export const seedLocalGroup = mutation({
  args: {
    sectorSlug: v.string(),
    includeSol: v.optional(v.boolean()),
    includeUma: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // The Sol sector is PUBLIC-seedable: it carries the fixed, operator-free
    // catalog below, so any visitor opening an empty Sol chart triggers the
    // canonical local group. Every other sector stays operator-gated.
    const isSol = /^sol(-sector)?$/.test(args.sectorSlug);
    if (!isSol) await requireOperatorCapability(ctx, ATLAS_CAPS);
    let sector = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", args.sectorSlug))
      .unique();
    if (!sector && isSol) {
      // Fall back to any Sol-named sector row before creating one.
      // Array.find yields `undefined` on miss; the variable is `Doc | null`
      // (from .unique() above), so normalize before assigning.
      const all = await ctx.db.query("sectorMap").collect();
      sector = all.find((s) => s.kind !== "system" && /sol/i.test(s.name)) ?? null;
      if (!sector) {
        const id = await ctx.db.insert("sectorMap", {
          name: "Sol Sector",
          slug: args.sectorSlug,
          x: 500,
          y: 420,
          r: 96,
          description:
            "Birth sector of humanity and cradle of Star Force — the real stellar neighbourhood within 50 light-years of Earth.",
        });
        sector = await ctx.db.get(id);
      }
    }
    if (!sector || sector.kind === "system") {
      throw new Error("Sector not found.");
    }
    const stars = LOCAL_GROUP.filter((s) => {
      if (s.name === "Sol") return args.includeSol !== false;
      if (s.name === "47 Ursae Majoris") return args.includeUma !== false;
      return true;
    });
    const existing = await ctx.db
      .query("sectorMap")
      .withIndex("by_sector", (q) => q.eq("sectorSlug", args.sectorSlug))
      .collect();
    const taken = new Set(existing.map((e) => e.name));
    let added = 0;
    for (const star of stars) {
      if (taken.has(star.name)) continue;
      await ctx.db.insert("sectorMap", {
        name: star.name.slice(0, 60),
        slug: `${args.sectorSlug}:${slugify(star.name)}`.slice(0, 80),
        x: sector.x + star.x,
        y: sector.y + star.y,
        kind: "system",
        sectorSlug: sector.slug,
        description: `Catalog star, ${star.distLy.toFixed(2)} ly from Sol.`,
        distLy: star.distLy,
      });
      added++;
    }
    return { added, skipped: stars.length - added };
  },
});

/** One-click idempotent seed for the Sol sector. */
export const seedSolSector = mutation({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, ATLAS_CAPS);
    let sector = await ctx.db
      .query("sectorMap")
      .withIndex("by_slug", (q) => q.eq("slug", "sol-sector"))
      .unique();
    if (!sector) {
      const solX = 500;
      const solY = 420;
      await ctx.db.insert("sectorMap", {
        name: "Sol Sector",
        slug: "sol-sector",
        x: solX,
        y: solY,
        r: 96,
        description:
          "Birth sector of humanity and cradle of Star Force — the real stellar neighbourhood within 50 light-years of Earth.",
      });
      sector = await ctx.db
        .query("sectorMap")
        .withIndex("by_slug", (q) => q.eq("slug", "sol-sector"))
        .unique();
    }
    if (!sector) throw new Error("Sector creation failed.");
    const existing = await ctx.db
      .query("sectorMap")
      .withIndex("by_sector", (q) => q.eq("sectorSlug", "sol-sector"))
      .collect();
    const taken = new Set(existing.map((e) => e.name));
    let added = 0;
    for (const star of LOCAL_GROUP) {
      if (taken.has(star.name)) continue;
      await ctx.db.insert("sectorMap", {
        name: star.name.slice(0, 60),
        slug: `sol-sector:${slugify(star.name)}`.slice(0, 80),
        x: sector.x + star.x,
        y: sector.y + star.y,
        kind: "system",
        sectorSlug: sector.slug,
        description: `Catalog star, ${star.distLy.toFixed(2)} ly from Sol.`,
        distLy: star.distLy,
      });
      added++;
    }
    return { added, skipped: LOCAL_GROUP.length - added, sectorId: sector._id };
  },
});

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
