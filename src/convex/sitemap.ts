import { httpAction, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

const SITE = "https://starforcebase1198.com";

const MAX_PER_SECTION = 500;

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function urlEntry(loc: string, lastmod?: string, priority?: string, changefreq?: string): string {
  let xml = `  <url>\n    <loc>${escapeXml(loc)}</loc>`;
  if (lastmod) xml += `\n    <lastmod>${lastmod}</lastmod>`;
  if (changefreq) xml += `\n    <changefreq>${changefreq}</changefreq>`;
  if (priority) xml += `\n    <priority>${priority}</priority>`;
  xml += `\n  </url>`;
  return xml;
}

function isoDay(ms?: number): string {
  return new Date(ms ?? Date.now()).toISOString().split("T")[0];
}

// Slug feed for the sitemap generator. Kept as a normal query because
// httpActions cannot touch the database directly.
export const publicSitemapData = query({
  args: {},
  handler: async (ctx) => {
    const out: Array<{
      kind: "story" | "lore" | "mission" | "blog";
      slug: string;
      lastmod?: number;
    }> = [];

    // ---- Published stories ----
    const stories = await ctx.db
      .query("stories")
      .filter((q) => q.eq(q.field("status"), "published"))
      .take(MAX_PER_SECTION);
    for (const s of stories)
      out.push({ kind: "story", slug: s.slug, lastmod: s.publishedAt });

    // ---- Approved lore entries ----
    const lore = await ctx.db
      .query("loreLibrary")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .take(MAX_PER_SECTION);
    for (const l of lore) out.push({ kind: "lore", slug: l.slug });

    // ---- Fleet operations (missions) ----
    const missions = await ctx.db.query("missions").take(MAX_PER_SECTION);
    for (const m of missions) out.push({ kind: "mission", slug: m.slug });

    // ---- Published blog posts ----
    const posts = await ctx.db
      .query("blogPosts")
      .filter((q) => q.eq(q.field("status"), "published"))
      .take(MAX_PER_SECTION);
    for (const p of posts)
      out.push({ kind: "blog", slug: p.slug, lastmod: p.publishedAt ?? p.updatedAt });

    return out;
  },
});

export const generateSitemap = httpAction(async (ctx) => {
  const now = new Date().toISOString().split("T")[0];
  const entries: string[] = [];

  // ---- Static routes ----
  entries.push(urlEntry(SITE + "/", now, "1.0", "daily"));
  entries.push(urlEntry(SITE + "/stories", now, "0.9", "daily"));
  entries.push(urlEntry(SITE + "/lore", now, "0.9", "weekly"));
  entries.push(urlEntry(SITE + "/map", now, "0.8", "weekly"));
  entries.push(urlEntry(SITE + "/missions", now, "0.8", "weekly"));
  entries.push(urlEntry(SITE + "/vault", now, "0.6", "weekly"));
  entries.push(urlEntry(SITE + "/events", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/blog", now, "0.8", "weekly"));
  entries.push(urlEntry(SITE + "/faqs", now, "0.7", "monthly"));
  entries.push(urlEntry(SITE + "/changelog", now, "0.4", "monthly"));
  entries.push(urlEntry(SITE + "/community", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/forums", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/groups", now, "0.6", "weekly"));
  entries.push(urlEntry(SITE + "/members", now, "0.6", "weekly"));
  entries.push(urlEntry(SITE + "/leaderboard", now, "0.5", "weekly"));
  entries.push(urlEntry(SITE + "/tools/assistant", now, "0.4", "weekly"));
  entries.push(urlEntry(SITE + "/membership", now, "0.8", "monthly"));
  entries.push(urlEntry(SITE + "/videos", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/maps", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/resources", now, "0.6", "monthly"));
  entries.push(urlEntry(SITE + "/support", now, "0.5", "monthly"));
  entries.push(urlEntry(SITE + "/privacy", now, "0.3", "yearly"));
  entries.push(urlEntry(SITE + "/terms", now, "0.3", "yearly"));

  // ---- Dynamic content from the database ----
  try {
    const items = await ctx.runQuery(api.sitemap.publicSitemapData, {});
    for (const item of items) {
      switch (item.kind) {
        case "story":
          entries.push(
            urlEntry(`${SITE}/stories/${item.slug}`, isoDay(item.lastmod), "0.7", "weekly"),
          );
          break;
        case "lore":
          entries.push(urlEntry(`${SITE}/lore/${item.slug}`, now, "0.6", "weekly"));
          break;
        case "mission":
          entries.push(urlEntry(`${SITE}/missions/${item.slug}`, now, "0.6", "weekly"));
          break;
        case "blog":
          entries.push(
            urlEntry(`${SITE}/blog/${item.slug}`, isoDay(item.lastmod), "0.6", "weekly"),
          );
          break;
      }
    }
  } catch {
    // If the slug feed fails, still serve the static route list rather than
    // an error page — crawlers handle a partial sitemap fine.
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
});
