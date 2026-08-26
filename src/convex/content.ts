import { query } from "./_generated/server";
import { v } from "convex/values";
import { staticImageFor } from "./staticCovers";

// =========================================================================
// Content queries — public, no auth required.
// All queries resolve `coverUrl` server-side so consumers don't need a
// second roundtrip for image rendering. They retain a `null` coverUrl when
// no `coverStorageId` is attached.
// =========================================================================

const STORY_STATUS_VALUES = [
  "draft",
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "published",
  "archived",
] as const;
type StoryStatus = (typeof STORY_STATUS_VALUES)[number];

function asStoryStatus(value: string | undefined): StoryStatus {
  return (STORY_STATUS_VALUES as readonly string[]).includes(value ?? "")
    ? (value as StoryStatus)
    : "published";
}

type MaybeCoverRow = {
  coverStorageId?: string | null | undefined;
  slug?: string | null;
};

// Server-side helper: appends resolved coverUrl to every row in a list.
async function withCoverUrls<T extends MaybeCoverRow>(
  ctx: { storage: { getUrl(id: string): Promise<string | null> } },
  rows: T[],
) {
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      // Static seed imagery is served from the site host (no Convex egress);
      // falls back to Convex storage for everything else.
      coverUrl:
        staticImageFor(r.slug) ??
        (r.coverStorageId
          ? await ctx.storage.getUrl(r.coverStorageId)
          : null),
    })),
  );
}

type MaybeFileRow = {
  coverStorageId?: string | null | undefined;
  fileStorageId?: string | null | undefined;
  slug?: string | null;
};

// Transmission/resource rows also resolve `fileUrl` (uploaded video/doc) so
// consumers don't need a second roundtrip for the media file itself.
async function withFileUrls<T extends MaybeFileRow>(
  ctx: { storage: { getUrl(id: string): Promise<string | null> } },
  rows: T[],
) {
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      coverUrl:
        staticImageFor(r.slug) ??
        (r.coverStorageId
          ? await ctx.storage.getUrl(r.coverStorageId)
          : null),
      fileUrl:
        staticImageFor(r.slug) ??
        (r.fileStorageId
          ? await ctx.storage.getUrl(r.fileStorageId)
          : null),
    })),
  );
}

export const listStories = query({
  args: {
    limit: v.optional(v.number()),
    series: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 12;
    const status = asStoryStatus(args.status);
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .take(limit);
    const filtered = args.series
      ? stories.filter(
          (s) => s.series?.toLowerCase() === args.series!.toLowerCase(),
        )
      : stories;
    return await withCoverUrls(ctx, filtered);
  },
});

export const storyBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const story = await ctx.db
      .query("stories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!story) return null;
    // Join the author for the byline card (name, rank, badge rack).
    const author = story.authorId ? await ctx.db.get(story.authorId) : null;
    return {
      ...story,
      coverUrl:
        staticImageFor(story.slug) ??
        (story.coverStorageId
          ? await ctx.storage.getUrl(story.coverStorageId)
          : null),
      author: author
        ? {
            displayName:
              author.displayName ??
              author.email?.split("@")[0] ??
              "Unnamed recruit",
            rank: author.rank ?? "Recruit",
            flair: author.flair ?? null,
            achievements: author.achievements ?? [],
          }
        : null,
    };
  },
});

export const relatedStoriesByFaction = query({
  args: { faction: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { faction, limit }) => {
    const stories = await ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(50);
    const filtered = stories
      .filter((s) => (s.factions ?? []).includes(faction))
      .slice(0, limit ?? 4);
    return await withCoverUrls(ctx, filtered);
  },
});

export const listLore = query({
  args: {
    limit: v.optional(v.number()),
    faction: v.optional(v.string()),
    sector: v.optional(v.string()),
    classification: v.optional(v.string()),
    era: v.optional(v.string()),
    entryType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 60;
    const entries = await ctx.db
      .query("loreEntries")
      .order("desc")
      .take(limit);
    const filtered = entries.filter((e) => {
      if (args.faction && e.faction !== args.faction) return false;
      if (args.sector && e.sector !== args.sector) return false;
      if (args.classification && e.classification !== args.classification)
        return false;
      if (args.era && e.era !== args.era) return false;
      if (args.entryType && e.entryType !== args.entryType) return false;
      return true;
    });
    return await withCoverUrls(ctx, filtered);
  },
});

export const loreRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("loreEntries")
      .order("desc")
      .take(limit ?? 6);
    return await withCoverUrls(ctx, rows);
  },
});

export const loreRandom = query({
  args: {
    faction: v.optional(v.string()),
    sector: v.optional(v.string()),
    classification: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("loreEntries").collect();
    const filtered = all.filter((e) => {
      if (args.faction && e.faction !== args.faction) return false;
      if (args.sector && e.sector !== args.sector) return false;
      if (args.classification && e.classification !== args.classification)
        return false;
      return true;
    });
    if (!filtered.length) return null;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    return {
      ...pick,
      coverUrl:
        staticImageFor(pick.slug) ??
        (pick.coverStorageId
          ? await ctx.storage.getUrl(pick.coverStorageId)
          : null),
    };
  },
});

export const loreBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const all = await ctx.db.query("loreEntries").take(500);
    const entry = all.find((e) => e.slug === slug) ?? null;
    if (!entry) return null;
    return {
      ...entry,
      coverUrl:
        staticImageFor(entry.slug) ??
        (entry.coverStorageId
          ? await ctx.storage.getUrl(entry.coverStorageId)
          : null),
    };
  },
});

export const sectors = query({
  args: {},
  handler: async (ctx) => ctx.db.query("sectorMap").collect(),
});

export const listTransmissions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("transmissions")
      .order("desc")
      .take(limit ?? 12);
    return await withFileUrls(ctx, rows);
  },
});

export const featuredTransmission = query({
  args: {},
  handler: async (ctx) => {
    const t = await ctx.db
      .query("transmissions")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .first();
    if (!t) return null;
    const [decorated] = await withFileUrls(ctx, [t]);
    return decorated;
  },
});

export const listResources = query({
  args: {
    limit: v.optional(v.number()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 24;
    const all = await ctx.db
      .query("resources")
      .order("desc")
      .take(limit);
    const filtered = args.type
      ? all.filter((r) => r.resourceType === args.type)
      : all;
    return await withFileUrls(ctx, filtered);
  },
});

// Operational ordering: active ops first, then locked, then completed,
// newest first within each bucket. Kept as a plain sort so the public
// Missions page gets a stable, sensible order without extra indexes.
const MISSION_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  locked: 1,
  completed: 2,
};

export const listMissions = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const all = await ctx.db.query("missions").take(limit);
    const sorted = [...all].sort((a, b) => {
      const pa = MISSION_STATUS_PRIORITY[a.missionStatus ?? ""] ?? 1;
      const pb = MISSION_STATUS_PRIORITY[b.missionStatus ?? ""] ?? 1;
      if (pa !== pb) return pa - pb;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    return args.status
      ? sorted.filter((m) => m.missionStatus === args.status)
      : sorted;
  },
});

export const listFleetReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("fleetReports")
      .withIndex("by_created")
      .order("desc")
      .take(limit ?? 12);
  },
});

export const trendingStories = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    // Treat views + commentCount as a simple engagement proxy.
    const all = await ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    const rows = all
      .sort(
        (a, b) =>
          (b.views ?? 0) * 1 +
          (b.commentCount ?? 0) * 5 -
          ((a.views ?? 0) * 1 + (a.commentCount ?? 0) * 5),
      )
      .slice(0, limit ?? 8);
    return await withCoverUrls(ctx, rows);
  },
});

export const trendingTags = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("stories").collect();
    const counts = new Map<string, number>();
    all.forEach((s) =>
      (s.tags ?? []).forEach((t) =>
        counts.set(t, (counts.get(t) ?? 0) + 1),
      ),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit ?? 12)
      .map(([tag, count]) => ({ tag, count }));
  },
});

// =========================================================================
// Operator-curated featured surfaces (home page)
// =========================================================================

export const listFeaturedStories = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .filter((q) => q.eq(q.field("featured"), true))
      .order("desc")
      .take(limit ?? 1);
    return await withCoverUrls(ctx, rows);
  },
});

export const listFeaturedLore = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("loreEntries")
      .filter((q) => q.eq(q.field("featured"), true))
      .order("desc")
      .take(limit ?? 3);
    return await withCoverUrls(ctx, rows);
  },
});

export const getFeaturedVideoLineup = query({
  args: {},
  handler: async (ctx) => {
    // Pull the operator-pinned featured transmissions ordered by featuredOrder.
    const list = await ctx.db
      .query("transmissions")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .order("asc")
      .take(3);
    const fallbackOrdered = list
      .slice()
      .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
    const decorated = await withFileUrls(ctx, fallbackOrdered);
    return {
      nowPlaying: decorated[0] ?? null,
      upNext: decorated.slice(1),
    };
  },
});

export const getHomeStats = query({
  args: {},
  handler: async (ctx) => {
    // Online-now approximated from sessions within the last 5 minutes.
    const recentSessions = await ctx.db.query("sessions").collect();
    const onlineThreshold = Date.now() - 5 * 60 * 1000;
    const onlineNow = recentSessions.filter(
      (s) => (s.lastSeenAt ?? 0) > onlineThreshold,
    ).length;

    const users = await ctx.db.query("users").collect();
    const featuredStories = await ctx.db
      .query("stories")
      .filter((q) => q.eq(q.field("featured"), true))
      .collect();

    // Total Cadets: count of users with displayName (i.e., real members).
    const totalCadets = users.filter((u) => !!u.displayName).length;

    return {
      onlineNow,
      totalCadets,
      featuredStoriesCount: featuredStories.length,
    };
  },
});

export const popularMembersList = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("users").collect();
    return all
      .filter((u) => !!u.displayName)
      .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
      .slice(0, limit ?? 3);
  },
});
