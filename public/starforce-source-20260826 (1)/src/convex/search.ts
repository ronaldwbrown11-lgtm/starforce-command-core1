import { query } from "./_generated/server";
import { v } from "convex/values";

// =========================================================================
// Site-wide full-text search.
//
// Searches the Convex search indexes on the public content and community
// tables and normalizes hits into a single grouped shape the frontend can
// render uniformly. Only *public* rows are surfaced: drafts/submitted
// stories, unapproved lore-library items, and classified groups never leak
// into results.
//
// Update method: reactive Convex query — results re-resolve whenever the
// underlying tables change, so new content is searchable immediately after
// it is published (Convex backfills search indexes automatically).
// =========================================================================

type TableId = { _id: unknown };

/**
 * Tokenizes a search query into the individual terms Convex full-text search
 * matches on, lowercased, de-duplicated, capped to the search API limit.
 */
function tokenizeTerms(q: string): string[] {
  const terms = q.toLowerCase().match(/[a-z0-9']{2,}/g) ?? [];
  return [...new Set(terms)].slice(0, 16);
}

/**
 * Builds a snippet of `text` (whitespace-collapsed) that centers on the
 * earliest match of any search term, with ellipses on truncated edges.
 * Falls back to a plain head slice when nothing matches.
 */
function buildSnippet(text: string, terms: string[], maxLen = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;

  const lower = clean.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i >= 0 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return clean.slice(0, maxLen).trimEnd() + "…";

  const start = Math.max(0, idx - 60);
  const end = Math.min(clean.length, start + maxLen);
  return (start > 0 ? "…" : "") + clean.slice(start, end).trim() + (end < clean.length ? "…" : "");
}

/**
 * Runs one or more index queries and merges them into a single de-duplicated
 * list (by document id), preserving the relevance order of the first index
 * and appending unique hits from later indexes up to `per` items.
 */
async function mergeIndexHits<T extends TableId>(
  runs: Array<() => Promise<T[]>>,
  per: number,
): Promise<T[]> {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const run of runs) {
    if (out.length >= per) break;
    const hits = await run();
    for (const hit of hits) {
      const key = String(hit._id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
      if (out.length >= per) break;
    }
  }
  return out;
}

export const siteSearch = query({
  args: {
    query: v.string(),
    /** Max items per result group (1–12, default 6). */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { query: raw, limit }) => {
    const q = raw.trim();
    const per = Math.min(Math.max(limit ?? 6, 1), 12);
    if (q.length < 2) return { query: q, groups: [] };
    const terms = tokenizeTerms(q);

    // ---- Stories (title + content indexes, published only) ----
    const stories = await mergeIndexHits(
      [
        () =>
          ctx.db
            .query("stories")
            .withSearchIndex("search_title", (idx) => idx.search("title", q))
            .filter((f) => f.eq(f.field("status"), "published"))
            .take(per * 2),
        () =>
          ctx.db
            .query("stories")
            .withSearchIndex("search_content", (idx) => idx.search("content", q))
            .filter((f) => f.eq(f.field("status"), "published"))
            .take(per * 2),
      ],
      per,
    );

    // ---- Lore entries (title + content indexes) ----
    const lore = await mergeIndexHits(
      [
        () =>
          ctx.db
            .query("loreEntries")
            .withSearchIndex("search_title", (idx) => idx.search("title", q))
            .take(per * 2),
        () =>
          ctx.db
            .query("loreEntries")
            .withSearchIndex("search_content", (idx) => idx.search("content", q))
            .take(per * 2),
      ],
      per,
    );

    // ---- Lore library (title index, approved only) ----
    const loreLibrary = await ctx.db
      .query("loreLibrary")
      .withSearchIndex("search_title", (idx) => idx.search("title", q))
      .filter((f) => f.eq(f.field("status"), "approved"))
      .take(per);

    // ---- Transmissions (title index) ----
    const transmissions = await ctx.db
      .query("transmissions")
      .withSearchIndex("search_title", (idx) => idx.search("title", q))
      .take(per);

    // ---- Resources (title index) ----
    const resources = await ctx.db
      .query("resources")
      .withSearchIndex("search_title", (idx) => idx.search("title", q))
      .take(per);

    // ---- Forum threads (title index) ----
    const forumThreads = await ctx.db
      .query("forumThreads")
      .withSearchIndex("search_title", (idx) => idx.search("title", q))
      .take(per);

    // ---- Groups (name index, classified groups withheld) ----
    const groups = await ctx.db
      .query("groups")
      .withSearchIndex("search_name", (idx) => idx.search("name", q))
      .filter((f) => f.neq(f.field("privacy"), "classified"))
      .take(per);

    // ---- Members (display name index) ----
    const users = await ctx.db
      .query("users")
      .withSearchIndex("search_display_name", (idx) => idx.search("displayName", q))
      .filter((f) => f.gt(f.field("displayName"), ""))
      .take(per);

    const groupsOut: Array<{
      type: string;
      label: string;
      href: string;
      items: Array<{
        id: string;
        title: string;
        description: string;
        href: string;
        meta: string[];
        coverUrl: string | null;
        matchedTerms: string[];
      }>;
    }> = [];

    if (stories.length) {
      groupsOut.push({
        type: "stories",
        label: "Stories",
        href: "/stories",
        items: await Promise.all(
          stories.map(async (s) => ({
            id: s._id,
            title: s.title,
            description: buildSnippet(s.content || s.excerpt, terms),
            href: `/stories/${s.slug}`,
            meta: [
              s.series ?? "Standalone",
              ...(s.readMinutes ? [`${s.readMinutes} min read`] : []),
            ],
            coverUrl: s.coverStorageId
              ? await ctx.storage.getUrl(s.coverStorageId)
              : null,
            matchedTerms: terms,
          })),
        ),
      });
    }

    if (lore.length) {
      groupsOut.push({
        type: "lore",
        label: "Lore Entries",
        href: "/lore?tab=entries",
        items: await Promise.all(
          lore.map(async (e) => ({
            id: e._id,
            title: e.title,
            description: buildSnippet(e.content || e.excerpt, terms),
            href: `/lore/${e.slug}`,
            meta: [e.entryType, e.faction, e.sector, e.era].filter(
              (m): m is string => !!m,
            ),
            coverUrl: e.coverStorageId
              ? await ctx.storage.getUrl(e.coverStorageId)
              : null,
            matchedTerms: terms,
          })),
        ),
      });
    }

    if (loreLibrary.length) {
      groupsOut.push({
        type: "loreLibrary",
        label: "Lore Library",
        href: "/lore",
        items: loreLibrary.map((item) => ({
          id: item._id,
          title: item.title,
          description: buildSnippet(item.description, terms),
          href: `/lore/${item.slug}`,
          meta: [item.loreType, item.faction, item.sector].filter(
            (m): m is string => !!m,
          ),
          coverUrl: null,
          matchedTerms: terms,
        })),
      });
    }

    if (transmissions.length) {
      groupsOut.push({
        type: "transmissions",
        label: "Transmissions",
        href: "/videos",
        items: await Promise.all(
          transmissions.map(async (t) => ({
            id: t._id,
            title: t.title,
            description: buildSnippet(t.description, terms),
            href: "/videos",
            meta: [
              t.transmissionType,
              t.durationSeconds ? `${t.durationSeconds}s` : null,
            ].filter((m): m is string => !!m),
            coverUrl: t.coverStorageId
              ? await ctx.storage.getUrl(t.coverStorageId)
              : null,
            matchedTerms: terms,
          })),
        ),
      });
    }

    if (resources.length) {
      groupsOut.push({
        type: "resources",
        label: "Resources",
        href: "/resources",
        items: resources.map((r) => ({
          id: r._id,
          title: r.title,
          description: buildSnippet(r.description, terms),
          href: "/resources",
          meta: [r.resourceType, r.tierRequired].filter(
            (m): m is string => !!m,
          ),
          coverUrl: null,
          matchedTerms: terms,
        })),
      });
    }

    if (forumThreads.length) {
      groupsOut.push({
        type: "forumThreads",
        label: "Forum Threads",
        href: "/forums",
        items: forumThreads.map((t) => ({
          id: t._id,
          title: t.title,
          description: buildSnippet(t.content, terms),
          href: "/forums",
          meta: [t.forumId, `${t.replyCount ?? 0} replies`],
          coverUrl: null,
          matchedTerms: terms,
        })),
      });
    }

    if (groups.length) {
      groupsOut.push({
        type: "groups",
        label: "Groups",
        href: "/groups",
        items: groups.map((g) => ({
          id: g._id,
          title: g.name,
          description: buildSnippet(g.description, terms),
          href: `/groups/${g.slug}`,
          meta: [g.category, g.privacy, `${g.memberCount ?? 0} members`].filter(
            (m): m is string => !!m,
          ),
          coverUrl: null,
          matchedTerms: terms,
        })),
      });
    }

    if (users.length) {
      groupsOut.push({
        type: "users",
        label: "Members",
        href: "/members",
        items: users.map((u) => ({
          id: u._id,
          title: u.displayName ?? "Cadet",
          description: buildSnippet(u.bio ?? "", terms) || "Fleet member",
          href: `/u/${u._id}`,
          meta: [u.rank, u.tier].filter((m): m is string => !!m),
          coverUrl: null,
          matchedTerms: terms,
        })),
      });
    }

    return { query: q, groups: groupsOut };
  },
});
