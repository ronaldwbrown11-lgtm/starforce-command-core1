import { httpAction } from "./_generated/server";

const SITE = "https://starforcebase1198.com";

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

export const generateSitemap = httpAction(async () => {
  const now = new Date().toISOString().split("T")[0];
  const entries: string[] = [];

  entries.push(urlEntry(SITE + "/", now, "1.0", "daily"));
  entries.push(urlEntry(SITE + "/stories", now, "0.9", "daily"));
  entries.push(urlEntry(SITE + "/lore", now, "0.9", "weekly"));
  entries.push(urlEntry(SITE + "/map", now, "0.8", "weekly"));
  entries.push(urlEntry(SITE + "/missions", now, "0.8", "weekly"));
  entries.push(urlEntry(SITE + "/blog", now, "0.8", "weekly"));
  entries.push(urlEntry(SITE + "/faqs", now, "0.7", "monthly"));
  entries.push(urlEntry(SITE + "/community", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/forums", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/groups", now, "0.6", "weekly"));
  entries.push(urlEntry(SITE + "/members", now, "0.6", "weekly"));
  entries.push(urlEntry(SITE + "/membership", now, "0.8", "monthly"));
  entries.push(urlEntry(SITE + "/videos", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/maps", now, "0.7", "weekly"));
  entries.push(urlEntry(SITE + "/resources", now, "0.6", "monthly"));
  entries.push(urlEntry(SITE + "/support", now, "0.5", "monthly"));
  entries.push(urlEntry(SITE + "/privacy", now, "0.3", "yearly"));
  entries.push(urlEntry(SITE + "/terms", now, "0.3", "yearly"));

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
