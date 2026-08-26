import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

// =========================================================================
// Internal helpers used by the seedDemo action (src/convex/seed.ts).
// These runs run via runMutation from the action — they do the data-plane
// writes so the orchestrating action can focus on cover-art generation +
// ctx.storage uploads. All helpers are idempotent on a slug/displayName
// uniqueness key where one exists, and "no-op if table already has rows"
// for tables seeded only once.
// =========================================================================

const TABLES_TO_WIPE = [
  "stories",
  "loreEntries",
  "loreLibrary",
  "transmissions",
  "resources",
  "missions",
  "fleetReports",
  "groups",
  "groupMembers",
  "groupMessages",
  "groupPosts",
  "groupEvents",
  "groupEventSignups",
  "forumThreads",
  "sectorMap",
  "moderationItems",
  "identityVerifications",
  "auditLog",
  "comments",
  "activityFeed",
  "notifications",
] as const;

// Wipe all seed tables. `users` is intentionally excluded so re-seeding
// does not orphan authored content; if you need a full user wipe, do it
// from the dashboard's Data tab separately.
export const wipeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const t of TABLES_TO_WIPE) {
      const docs = await ctx.db.query(t).collect();
      await Promise.all(docs.map((d) => ctx.db.delete(d._id)));
    }
  },
});

// Query used by the action to resolve displayName → _id for foreign keys.
export const listUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Query used by the action to resolve group slug → _id for foreign keys.
export const listGroups = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("groups").collect();
  },
});

// Query used by the action to resolve mission slug → _id for foreign keys.
export const listMissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("missions").collect();
  },
});

// ---- Per-table idempotent inserts ---------------------------------------

export const seedUsers = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("users").collect();
    const names = new Set(existing.map((u) => u.displayName));
    for (const u of args.items) {
      if (names.has(u.displayName)) continue;
      await ctx.db.insert("users", u);
    }
  },
});

export const seedStories = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const s of args.items) {
      const existing = await ctx.db
        .query("stories")
        .withIndex("by_slug", (q) => q.eq("slug", s.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("stories", s);
    }
  },
});

/**
 * Attach (or replace) cover art on an existing seeded row by slug. The seed
 * upserts skip existing rows, so this is the escape hatch to swap regenerated
 * cover files onto already-seeded content without wiping any data.
 */
export const attachCover = internalMutation({
  args: {
    table: v.string(),
    slug: v.string(),
    coverStorageId: v.optional(v.id("_storage")),
    coverMeta: v.optional(
      v.object({
        mimeType: v.string(),
        byteSize: v.number(),
        altText: v.optional(v.string()),
      }),
    ),
    fileStorageId: v.optional(v.id("_storage")),
    fileMeta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let docId: any = null;
    if (args.table === "stories") {
      const d = await ctx.db
        .query("stories")
        .withIndex("by_slug", (q) => q.eq("slug", args.slug))
        .first();
      docId = d?._id ?? null;
    } else if (args.table === "loreEntries") {
      const d = await ctx.db
        .query("loreEntries")
        .filter((q) => q.eq(q.field("slug"), args.slug))
        .first();
      docId = d?._id ?? null;
    } else if (args.table === "loreLibrary") {
      const d = await ctx.db
        .query("loreLibrary")
        .filter((q) => q.eq(q.field("slug"), args.slug))
        .first();
      docId = d?._id ?? null;
    } else if (args.table === "transmissions") {
      const d = await ctx.db
        .query("transmissions")
        .filter((q) => q.eq(q.field("slug"), args.slug))
        .first();
      docId = d?._id ?? null;
    }
    if (!docId) {
      return { ok: false, reason: "not_found", table: args.table, slug: args.slug };
    }
    await ctx.db.patch(docId, {
      coverStorageId: args.coverStorageId,
      coverMeta: args.coverMeta,
      ...(args.fileStorageId
        ? { fileStorageId: args.fileStorageId, fileMeta: args.fileMeta }
        : {}),
    });
    return { ok: true, table: args.table, slug: args.slug };
  },
});

export const seedLore = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const l of args.items) {
      const existing = await ctx.db
        .query("loreEntries")
        .filter((q) => q.eq(q.field("slug"), l.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("loreEntries", l);
    }
  },
});

export const seedLoreLibrary = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const l of args.items) {
      const existing = await ctx.db
        .query("loreLibrary")
        .filter((q) => q.eq(q.field("slug"), l.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("loreLibrary", l);
    }
  },
});

export const seedTransmissions = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const t of args.items) {
      const existing = await ctx.db
        .query("transmissions")
        .filter((q) => q.eq(q.field("slug"), t.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("transmissions", t);
    }
  },
});

export const seedResources = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const r of args.items) {
      const existing = await ctx.db
        .query("resources")
        .filter((q) => q.eq(q.field("slug"), r.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("resources", r);
    }
  },
});

export const seedMissions = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const m of args.items) {
      const existing = await ctx.db
        .query("missions")
        .filter((q) => q.eq(q.field("slug"), m.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("missions", m);
    }
  },
});

export const seedGroups = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const g of args.items) {
      const existing = await ctx.db
        .query("groups")
        .filter((q) => q.eq(q.field("slug"), g.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("groups", g);
    }
  },
});

export const seedThreads = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const t of args.items) {
      const existing = await ctx.db
        .query("forumThreads")
        .filter((q) => q.eq(q.field("slug"), t.slug))
        .first();
      if (existing) continue;
      await ctx.db.insert("forumThreads", t);
    }
  },
});

// ---- Group workspace (roles, posts, chat, missions/events) -------------
// Each of these is once-only *per group* (or per group+user pair for
// memberships) so re-running the seed never duplicates workspace content.

export const seedGroupMembers = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    for (const m of args.items) {
      const existing = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", m.groupId))
        .filter((q) => q.eq(q.field("userId"), m.userId))
        .first();
      if (existing) continue;
      await ctx.db.insert("groupMembers", {
        groupId: m.groupId,
        userId: m.userId,
        joinedAt: m.joinedAt,
        role: m.role ?? "member",
      });
    }
  },
});

export const seedGroupPosts = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    // Posts have no natural unique key — once-only per table, so re-running
    // the seed never duplicates the feed (a `clear: true` wipe resets it).
    const anyExisting = await ctx.db.query("groupPosts").first();
    if (anyExisting) return;
    for (const p of args.items) {
      await ctx.db.insert("groupPosts", {
        groupId: p.groupId,
        authorId: p.authorId,
        title: p.title,
        body: p.body,
        kind: p.kind ?? "post",
        pinned: p.pinned ?? false,
        createdAt: p.createdAt,
      });
    }
  },
});

export const seedGroupMessages = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const anyExisting = await ctx.db.query("groupMessages").first();
    if (anyExisting) return;
    for (const msg of args.items) {
      await ctx.db.insert("groupMessages", {
        groupId: msg.groupId,
        authorId: msg.authorId,
        body: msg.body,
        createdAt: msg.createdAt,
      });
    }
  },
});

export const seedGroupEvents = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const anyExisting = await ctx.db.query("groupEvents").first();
    if (anyExisting) return;
    for (const ev of args.items) {
      const eventId = await ctx.db.insert("groupEvents", {
        groupId: ev.groupId,
        createdBy: ev.createdBy,
        title: ev.title,
        description: ev.description,
        kind: ev.kind,
        status: ev.status ?? "open",
        scheduledAt: ev.scheduledAt,
        createdAt: ev.createdAt,
      });
      for (const userId of ev.signupUserIds ?? []) {
        await ctx.db.insert("groupEventSignups", {
          eventId,
          userId,
          createdAt: ev.createdAt + 1000,
        });
      }
    }
  },
});

// ---- Once-only inserts (skip entirely if the table has any rows) ----

export const seedSectors = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("sectorMap").collect();
    if (existing.length > 0) return;
    for (const s of args.items) await ctx.db.insert("sectorMap", s);
  },
});

export const seedFleetReports = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("fleetReports").collect();
    if (existing.length > 0) return;
    for (const f of args.items) await ctx.db.insert("fleetReports", f);
  },
});

export const seedActivity = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("activityFeed").collect();
    if (existing.length > 0) return;
    for (const a of args.items) await ctx.db.insert("activityFeed", a);
  },
});

export const seedModeration = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("moderationItems").collect();
    if (existing.length > 0) return;
    for (const m of args.items) await ctx.db.insert("moderationItems", m);
  },
});

export const seedIdentity = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("identityVerifications")
      .collect();
    if (existing.length > 0) return;
    for (const v of args.items) await ctx.db.insert("identityVerifications", v);
  },
});

export const seedAudit = internalMutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("auditLog").collect();
    if (existing.length > 0) return;
    for (const a of args.items) await ctx.db.insert("auditLog", a);
  },
});

/**
 * Add "Example" tag to all seeded stories that don't already have it.
 * Safe to re-run — only touches stories missing the tag.
 */
export const tagSeededStoriesExample = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();
    let patched = 0;
    for (const s of stories) {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      if (tags.includes("Example")) continue;
      await ctx.db.patch(s._id, { tags: ["Example", ...tags] });
      patched++;
    }
    return { patched };
  },
});

/**
 * Tag all existing stories with "Example" so visitors can tell demo
 * content from real submissions. Safe to re-run.
 */
export const tagAllStoriesExample = mutation({
  args: {},
  handler: async (ctx) => {
    const stories = await ctx.db.query("stories").collect();
    let patched = 0;
    for (const s of stories) {
      const tags = Array.isArray(s.tags) ? s.tags : [];
      if (tags.includes("Example")) continue;
      await ctx.db.patch(s._id, { tags: ["Example", ...tags] });
      patched++;
    }
    return { patched };
  },
});
