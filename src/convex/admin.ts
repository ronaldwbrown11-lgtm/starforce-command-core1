import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { opRoleValidator, tierValidator } from "./schema";

// Same gate the rest of the operator surface uses; kept here so this file
// exposes no inadvertent surface that callers could bypass. Exported so
// assets.ts can re-use the exact same authorization logic.
export async function requireOperatorCapability(
  ctx: QueryCtx | MutationCtx,
  caps: string[],
) {
  const me = await getAuthUserId(ctx);
  if (!me) throw new Error("Sign in required.");
  const user = await ctx.db.get(me);
  if (!user) throw new Error("User not found.");
  if (user.role !== "admin" && !caps.includes(String(user.opRole ?? ""))) {
    throw new Error("Forbidden.");
  }
  return { me, user };
}

// -----------------------------------------------------------------------------
// Broadcasts
// -----------------------------------------------------------------------------

const broadcastAudience = v.union(
  v.object({ type: v.literal("all") }),
  v.object({ type: v.literal("tier"), tier: tierValidator }),
  v.object({ type: v.literal("opRole"), opRole: opRoleValidator }),
);

export const sendBroadcast = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    audience: broadcastAudience,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Title required.");
    if (!body) throw new Error("Body required.");
    if (body.length > 700) throw new Error("Body too long (> 700 chars).");

    const allUsers = await ctx.db.query("users").collect();
    const targets = allUsers.filter((u) => {
      if (!u.displayName && !u.email) return false; // skip anon / unverified
      if (args.audience.type === "all") return true;
      if (args.audience.type === "tier") return u.tier === args.audience.tier;
      if (args.audience.type === "opRole")
        return u.opRole === args.audience.opRole;
      return false;
    });
    const now = Date.now();
    await Promise.all(
      targets.map((u) =>
        ctx.db.insert("notifications", {
          userId: u._id,
          kind: "broadcast",
          title,
          body,
          createdAt: now,
        }),
      ),
    );
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "broadcast.send",
      target: `audience:${args.audience.type}`,
      meta: JSON.stringify({
        count: targets.length,
        audience: args.audience,
        title,
      }),
      createdAt: now,
    });
    return { ok: true, delivered: targets.length };
  },
});

export const listBroadcastHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    return await ctx.db
      .query("auditLog")
      .withIndex("by_action", (q) => q.eq("action", "broadcast.send"))
      .order("desc")
      .take(args.limit ?? 25);
  },
});

// -----------------------------------------------------------------------------
// Team roster
// -----------------------------------------------------------------------------

export const listOperators = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    const all = await ctx.db.query("users").collect();
    return all
      .filter((u) => !!u.opRole)
      .sort((a, b) =>
        (a.displayName ?? a.name ?? "").localeCompare(
          b.displayName ?? b.name ?? "",
        ),
      )
      .slice(0, args.limit ?? 80);
  },
});

// -----------------------------------------------------------------------------
// Lore CRUD
// -----------------------------------------------------------------------------

export const upsertLore = mutation({
  args: {
    id: v.optional(v.id("loreEntries")),
    title: v.string(),
    slug: v.string(),
    excerpt: v.string(),
    content: v.string(),
    faction: v.optional(v.string()),
    sector: v.optional(v.string()),
    classification: v.optional(v.string()),
    entryType: v.optional(v.string()),
    tierRequired: v.optional(tierValidator),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "lore_archivist",
    ]);
    const title = args.title.trim();
    const slug = args.slug.trim();
    if (!title) throw new Error("Title required.");
    if (!slug) throw new Error("Slug required.");
    const excerpt = args.excerpt.trim().slice(0, 280);
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Not found.");
      await ctx.db.patch(args.id, {
        title,
        slug,
        excerpt,
        content: args.content,
        faction: args.faction,
        sector: args.sector,
        classification: args.classification,
        entryType: args.entryType,
        tierRequired: args.tierRequired,
      });
      id = args.id;
    } else {
      id = await ctx.db.insert("loreEntries", {
        title,
        slug,
        excerpt,
        content: args.content,
        faction: args.faction,
        sector: args.sector,
        classification: args.classification,
        entryType: args.entryType,
        tierRequired: args.tierRequired,
        authorId: me,
        createdAt: Date.now(),
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "lore.edit" : "lore.create",
      target: `lore:${id}`,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const archiveLore = mutation({
  args: { id: v.id("loreEntries") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "lore_archivist",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found.");
    // Soft-archive: clear featured flag (preserves the document so deep
    // links + audit history still resolve).
    await ctx.db.patch(args.id, {
      featured: false,
      featuredOrder: undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "lore.archive",
      target: `lore:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// -----------------------------------------------------------------------------
// Transmissions CRUD
// -----------------------------------------------------------------------------

export const upsertTransmission = mutation({
  args: {
    id: v.optional(v.id("transmissions")),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    videoUrl: v.optional(v.string()),
    // Podcast / audio-only episode (#29) — direct audio URL.
    audioUrl: v.optional(v.string()),
    transmissionType: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const title = args.title.trim();
    const slug = args.slug.trim();
    if (!title) throw new Error("Title required.");
    if (!slug) throw new Error("Slug required.");
    const description = args.description.trim().slice(0, 480);
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Not found.");
      await ctx.db.patch(args.id, {
        title,
        slug,
        description,
        videoUrl: args.videoUrl,
        audioUrl: args.audioUrl,
        transmissionType: args.transmissionType,
        durationSeconds: args.durationSeconds,
      });
      id = args.id;
    } else {
      id = await ctx.db.insert("transmissions", {
        title,
        slug,
        description,
        videoUrl: args.videoUrl,
        audioUrl: args.audioUrl,
        transmissionType: args.transmissionType,
        durationSeconds: args.durationSeconds,
        createdAt: Date.now(),
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "transmission.edit" : "transmission.create",
      target: `transmission:${id}`,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const archiveTransmission = mutation({
  args: { id: v.id("transmissions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found.");
    await ctx.db.patch(args.id, {
      featured: false,
      featuredOrder: undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "transmission.archive",
      target: `transmission:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// -----------------------------------------------------------------------------
// Resources CRUD
// -----------------------------------------------------------------------------

export const upsertResource = mutation({
  args: {
    id: v.optional(v.id("resources")),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    resourceType: v.optional(v.string()),
    tierRequired: v.optional(tierValidator),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const title = args.title.trim();
    const slug = args.slug.trim();
    if (!title) throw new Error("Title required.");
    if (!slug) throw new Error("Slug required.");
    const description = args.description.trim().slice(0, 320);
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Not found.");
      await ctx.db.patch(args.id, {
        title,
        slug,
        description,
        resourceType: args.resourceType,
        tierRequired: args.tierRequired,
        url: args.url,
      });
      id = args.id;
    } else {
      id = await ctx.db.insert("resources", {
        title,
        slug,
        description,
        resourceType: args.resourceType,
        tierRequired: args.tierRequired,
        url: args.url,
        createdAt: Date.now(),
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "resource.edit" : "resource.create",
      target: `resource:${id}`,
      createdAt: Date.now(),
    });
    return id;
  },
});

// -----------------------------------------------------------------------------
// Missions CRUD (ops board briefings)
// -----------------------------------------------------------------------------

const MISSION_STATUSES = ["active", "locked", "completed"] as const;

export const upsertMission = mutation({
  args: {
    id: v.optional(v.id("missions")),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    missionStatus: v.optional(v.string()),
    xpReward: v.optional(v.number()),
    tierRequired: v.optional(tierValidator),
    briefing: v.optional(v.string()),
    objectives: v.optional(v.array(v.string())),
    location: v.optional(v.string()),
    durationLabel: v.optional(v.string()),
    reportGuidance: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const title = args.title.trim();
    const slug = args.slug.trim();
    if (!title) throw new Error("Title required.");
    if (!slug) throw new Error("Slug required.");
    const missionStatus = MISSION_STATUSES.includes(
      args.missionStatus as (typeof MISSION_STATUSES)[number],
    )
      ? args.missionStatus
      : "active";
    const description = args.description.trim().slice(0, 480);
    const briefing = (args.briefing ?? "").trim().slice(0, 6000);
    const reportGuidance = (args.reportGuidance ?? "").trim().slice(0, 1000);
    const objectives = (args.objectives ?? [])
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
      .slice(0, 12);
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Not found.");
      await ctx.db.patch(args.id, {
        title,
        slug,
        description,
        missionStatus,
        xpReward: args.xpReward,
        tierRequired: args.tierRequired,
        briefing: briefing || undefined,
        objectives: objectives.length ? objectives : undefined,
        location: args.location?.trim() || undefined,
        durationLabel: args.durationLabel?.trim() || undefined,
        reportGuidance: reportGuidance || undefined,
      });
      id = args.id;
    } else {
      id = await ctx.db.insert("missions", {
        title,
        slug,
        description,
        missionStatus,
        xpReward: args.xpReward,
        tierRequired: args.tierRequired,
        briefing: briefing || undefined,
        objectives: objectives.length ? objectives : undefined,
        location: args.location?.trim() || undefined,
        durationLabel: args.durationLabel?.trim() || undefined,
        reportGuidance: reportGuidance || undefined,
        createdAt: Date.now(),
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "mission.edit" : "mission.create",
      target: `mission:${id}`,
      createdAt: Date.now(),
    });
    return id;
  },
});

export const archiveMission = mutation({
  args: { id: v.id("missions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "mission.archive",
      target: `mission:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// -----------------------------------------------------------------------------
// Analytics time-series
// -----------------------------------------------------------------------------

function dayKey(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function fillDateRange(days: number) {
  const out: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    out[d.toISOString().slice(0, 10)] = 0;
  }
  return out;
}

export const analyticsTimeSeries = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const days = args.days ?? 30;
    const since = Date.now() - days * 86400000;

    // ---- story submissions ----
    const stories = await ctx.db.query("stories").collect();
    const storyBuckets = fillDateRange(days);
    for (const s of stories) {
      if (s.createdAt < since) continue;
      const k = dayKey(s.createdAt);
      storyBuckets[k] = (storyBuckets[k] ?? 0) + 1;
    }
    const storySubmissions = Object.entries(storyBuckets).map(
      ([date, count]) => ({ date, count }),
    );

    // ---- active users (distinct userId per day) ----
    // Source of truth is Convex Auth's live `authSessions` table: each
    // session's creation time is a real sign-in. The legacy `sessions`
    // ledger is merged in for completeness but is no longer written to, so
    // without this the chart would sit at zero forever.
    const userBuckets: Record<string, Set<string>> = {};
    const touchUser = (userId: Id<"users">, at: number) => {
      if (at < since) return;
      const k = dayKey(at);
      (userBuckets[k] ??= new Set()).add(userId);
    };
    const [authSessions, legacySessions] = await Promise.all([
      ctx.db.query("authSessions").collect(),
      ctx.db.query("sessions").collect(),
    ]);
    for (const s of authSessions) touchUser(s.userId, s._creationTime);
    for (const s of legacySessions) touchUser(s.userId, s.lastSeenAt);
    const baseUserBuckets = fillDateRange(days);
    for (const [date, set] of Object.entries(userBuckets)) {
      baseUserBuckets[date] = set.size;
    }
    const activeUsers = Object.entries(baseUserBuckets).map(
      ([date, count]) => ({ date, count }),
    );

    // ---- moderation throughput ----
    const logs = await ctx.db
      .query("auditLog")
      .withIndex("by_created")
      .order("desc")
      .take(2000);
    const modBuckets = fillDateRange(days);
    for (const l of logs) {
      if (l.createdAt < since) break;
      if (!l.action.startsWith("moderation.")) continue;
      const k = dayKey(l.createdAt);
      modBuckets[k] = (modBuckets[k] ?? 0) + 1;
    }
    const moderationActions = Object.entries(modBuckets).map(
      ([date, count]) => ({ date, count }),
    );

    // ---- broadcast reach ----
    const broadcastBuckets = fillDateRange(days);
    for (const l of logs) {
      if (l.createdAt < since) break;
      if (l.action !== "broadcast.send") continue;
      let delivered = 0;
      try {
        delivered = (JSON.parse(l.meta ?? "{}") as { count?: number }).count ?? 0;
      } catch {
        // ignore
      }
      const k = dayKey(l.createdAt);
      broadcastBuckets[k] = (broadcastBuckets[k] ?? 0) + delivered;
    }
    const broadcastReach = Object.entries(broadcastBuckets).map(
      ([date, count]) => ({ date, count }),
    );

    return { storySubmissions, activeUsers, moderationActions, broadcastReach };
  },
});

export const archiveResource = mutation({
  args: { id: v.id("resources") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "resource.archive",
      target: `resource:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
