import { query } from "./_generated/server";

// Slug-level dump of content tables (no PII) for audit comparisons —
// e.g. verifying restoration state against the pre-wipe evidence file
// docs/audit-pre-wipe-sitemap-20260919T0148Z.xml.
export const contentDump = query({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").take(500);
    const lore = await ctx.db.query("loreLibrary").take(500);
    const missions = await ctx.db.query("missions").take(500);
    const blog = await ctx.db.query("blogPosts").take(500);
    const products = await ctx.db.query("storeProducts").take(500);
    return {
      stories: stories.map((s) => ({ slug: s.slug, status: s.status })),
      lore: lore.map((l) => ({ slug: l.slug, status: l.status, type: l.loreType })),
      missions: missions.map((m) => ({ slug: m.slug })),
      blogPosts: blog.map((b) => ({ slug: b.slug, status: b.status })),
      storeProducts: products.map((p) => ({ slug: p.slug, status: p.status })),
    };
  },
});

// Read-only census: row count + newest document timestamp per table.
// Used to verify database health and restoration state. Exposes no PII.
export const tableCounts = query({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "users",
      "stories",
      "loreLibrary",
      "loreEntries",
      "transmissions",
      "resources",
      "missions",
      "sectorMap",
      "fleetReports",
      "moderationItems",
      "storeProducts",
      "storeOrders",
      "forumThreads",
      "groups",
      "blogPosts",
      "faqItems",
      "changelogEntries",
      "captainLogs",
      "calendarEvents",
      "contests",
      "signals",
      "factions",
      "socialLinks",
      "siteAppearance",
      "vessels",
      "messages",
      "activityFeed",
      "auditLog",
    ] as const;

    const counts: Record<string, number> = {};
    const newest: Record<string, number | null> = {};
    for (const t of tables) {
      try {
        const rows = await ctx.db.query(t).take(1001);
        counts[t] = rows.length;
        let max = 0;
        for (const r of rows) if (r._creationTime > max) max = r._creationTime;
        newest[t] = max > 0 ? max : null;
      } catch {
        counts[t] = -1; // table missing on this deployment
        newest[t] = null;
      }
    }
    return { counts, newest };
  },
});
