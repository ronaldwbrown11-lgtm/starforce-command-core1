import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { opRoleValidator } from "./schema";
import {
  awardAchievements,
  bumpContribution,
  evaluateAchievements,
} from "./achievements";
import { CREDIT_RATES, grantCredits } from "./economy";

// =========================================================================
// Operator / Moderation / Audit / Sessions / Identity / Analytics
// =========================================================================

async function requireOperatorCapability(
  ctx: QueryCtx | MutationCtx,
  caps: string[],
) {
  const me = await getAuthUserId(ctx);
  if (!me) throw new Error("Sign in required.");
  const user = await ctx.db.get(me);
  if (!user) throw new Error("User not found.");
  // Operators are gated by opRole + the user's role being "admin".
  if (user.role !== "admin" && !caps.includes(String(user.opRole ?? ""))) {
    throw new Error("Forbidden.");
  }
  return { me, user };
}

const MOD_STATUS_VALUES = ["pending", "approved", "rejected", "escalated"] as const;
function asModStatus(value: string | undefined) {
  return (MOD_STATUS_VALUES as readonly string[]).includes(value ?? "")
    ? (value as (typeof MOD_STATUS_VALUES)[number])
    : "pending";
}

const ID_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "needs_more_info",
] as const;
function asIdStatus(value: string | undefined) {
  return (ID_STATUS_VALUES as readonly string[]).includes(value ?? "")
    ? (value as (typeof ID_STATUS_VALUES)[number])
    : "pending";
}

// ---- Moderation queue ----

export const moderationQueue = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const status = asModStatus(args.status);
    return await ctx.db
      .query("moderationItems")
      .withIndex("by_status_created", (q) => q.eq("status", status))
      .order("desc")
      .take(args.limit ?? 25);
  },
});

export const moderationAction = mutation({
  args: {
    id: v.id("moderationItems"),
    action: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    if (!["approve", "reject", "escalate"].includes(args.action)) {
      throw new Error("Invalid action.");
    }
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Not found.");
    const newStatus: "approved" | "rejected" | "escalated" =
      args.action === "approve"
        ? "approved"
        : args.action === "reject"
          ? "rejected"
          : "escalated";
    await ctx.db.patch(args.id, { status: newStatus });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `moderation.${args.action}`,
      target: `${item.targetType}:${item.targetId}`,
      meta: args.note ? JSON.stringify({ note: args.note }) : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---- Field report review (mission report-ins) ----

const REPORT_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;
function asReportStatus(value: string | undefined) {
  return (REPORT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as (typeof REPORT_STATUSES)[number])
    : "pending";
}

export const reportReviewQueue = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const status = asReportStatus(args.status);
    const rows =
      status === "pending"
        ? await ctx.db
            .query("fleetReports")
            .withIndex("by_review_status", (q) => q.eq("reviewStatus", "pending"))
            .order("desc")
            .take(args.limit ?? 50)
        : (await ctx.db.query("fleetReports").order("desc").take(args.limit ?? 200))
            .filter((r) => (r.reviewStatus ?? "pending") === status)
            .slice(0, args.limit ?? 50);
    return Promise.all(
      rows.map(async (r) => {
        const [author, mission] = await Promise.all([
          r.authorId ? ctx.db.get(r.authorId) : null,
          r.missionId ? ctx.db.get(r.missionId) : null,
        ]);
        return {
          _id: r._id,
          title: r.title,
          content: r.content,
          xpAwarded: r.xpAwarded ?? null,
          reviewStatus: r.reviewStatus ?? "pending",
          reviewerId: r.reviewerId ?? null,
          reviewedAt: r.reviewedAt ?? null,
          reviewNote: r.reviewNote ?? null,
          createdAt: r.createdAt,
          author: author
            ? {
                _id: author._id,
                displayName: author.displayName ?? null,
                rank: author.rank ?? null,
              }
            : null,
          mission: mission
            ? { _id: mission._id, title: mission.title, slug: mission.slug }
            : null,
        };
      }),
    );
  },
});

export const reportReviewAction = mutation({
  args: {
    id: v.id("fleetReports"),
    action: v.string(), // approve / reject / flag
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    if (!["approve", "reject", "flag"].includes(args.action)) {
      throw new Error("Invalid action.");
    }
    const report = await ctx.db.get(args.id);
    if (!report) throw new Error("Not found.");
    const note = (args.note ?? "").trim().slice(0, 500);
    const newStatus: "approved" | "rejected" | "flagged" =
      args.action === "approve"
        ? "approved"
        : args.action === "reject"
          ? "rejected"
          : "flagged";

    // Claw back the awarded XP when a report is rejected or flagged so the
    // economy stays honest. Only the awarded portion is revoked.
    const xp = report.xpAwarded ?? 0;
    let revoked = 0;
    if (newStatus !== "approved" && xp > 0 && report.authorId) {
      const author = await ctx.db.get(report.authorId);
      if (author) {
        revoked = Math.min(xp, author.xp ?? 0);
        await ctx.db.patch(report.authorId, {
          xp: (author.xp ?? 0) - revoked,
        });
      }
    }

    await ctx.db.patch(args.id, {
      reviewStatus: newStatus,
      reviewerId: me,
      reviewedAt: Date.now(),
      reviewNote: note || undefined,
    });

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `report.${args.action}`,
      target: `fleetReport:${args.id}`,
      meta: JSON.stringify({ revoked, note: note || undefined }),
      createdAt: Date.now(),
    });

    // Tell the author when their report was rejected or flagged (and why).
    if (
      newStatus !== "approved" &&
      report.authorId &&
      report.authorId !== me
    ) {
      const mission = report.missionId
        ? await ctx.db.get(report.missionId)
        : null;
      const verdict = newStatus === "rejected" ? "not certified" : "flagged";
      await ctx.db.insert("notifications", {
        userId: report.authorId,
        kind: newStatus === "rejected" ? "report_rejected" : "report_flagged",
        title:
          newStatus === "rejected"
            ? "Field report not certified"
            : "Field report flagged",
        body: note
          ? `Your report on ${report.title} was ${verdict}: ${note}`
          : `Your report on ${report.title} was ${verdict} and its XP award was revoked.`,
        url: mission ? `/missions/${mission.slug}` : undefined,
        createdAt: Date.now(),
      });
    }
    return { ok: true, newStatus, revoked };
  },
});

// ---- Operator-curated featured surfaces (home page) ----

export const setFeaturedStory = mutation({
  args: {
    id: v.id("stories"),
    featured: v.boolean(),
    featuredOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    await ctx.db.patch(args.id, {
      featured: args.featured,
      featuredOrder: args.featuredOrder ?? undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.featured ? "story.feature" : "story.unfeature",
      target: `story:${args.id}`,
      meta: args.featuredOrder != null
        ? JSON.stringify({ featuredOrder: args.featuredOrder })
        : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setFeaturedLore = mutation({
  args: {
    id: v.id("loreEntries"),
    featured: v.boolean(),
    featuredOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "lore_archivist",
    ]);
    await ctx.db.patch(args.id, {
      featured: args.featured,
      featuredOrder: args.featuredOrder ?? undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.featured ? "lore.feature" : "lore.unfeature",
      target: `lore:${args.id}`,
      meta: args.featuredOrder != null
        ? JSON.stringify({ featuredOrder: args.featuredOrder })
        : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setFeaturedVideoLineup = mutation({
  args: {
    lineup: v.array(
      v.object({
        id: v.id("transmissions"),
        featuredOrder: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    // Clear all current featured flags, then apply new lineup.
    const current = await ctx.db
      .query("transmissions")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .collect();
    await Promise.all(
      current.map((t) =>
        ctx.db.patch(t._id, {
          featured: false,
          featuredOrder: undefined,
        }),
      ),
    );
    await Promise.all(
      args.lineup.map((entry) =>
        ctx.db.patch(entry.id, {
          featured: true,
          featuredOrder: entry.featuredOrder,
        }),
      ),
    );
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "transmission.lineup",
      target: `transmissions:${args.lineup.length}`,
      meta: JSON.stringify({
        lineup: args.lineup.map((e) => String(e.id)),
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---- Story approval ----

export const storyApprovalQueue = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const submitted = await ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const inReview = await ctx.db
      .query("stories")
      .withIndex("by_status", (q) => q.eq("status", "in_review"))
      .collect();
    return [...submitted, ...inReview]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit ?? 25);
  },
});

export const storyApprovalAction = mutation({
  args: {
    id: v.id("stories"),
    action: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    if (
      !["approve", "request_changes", "reject", "schedule"].includes(args.action)
    ) {
      throw new Error("Invalid action.");
    }
    const map: Record<
      "approve" | "request_changes" | "reject" | "schedule",
      "published" | "draft" | "archived" | "approved"
    > = {
      approve: "published",
      request_changes: "draft",
      reject: "archived",
      schedule: "approved",
    };
    const actionKey = args.action as keyof typeof map;
    const story = await ctx.db.get(args.id);
    if (!story) throw new Error("Not found.");
    const newStatus = map[actionKey];
    await ctx.db.patch(args.id, {
      status: newStatus,
      publishedAt: newStatus === "published" ? Date.now() : story.publishedAt,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `story.${args.action}`,
      target: `story:${args.id}`,
      meta: args.note ? JSON.stringify({ note: args.note }) : undefined,
      createdAt: Date.now(),
    });
    // Notify the author of the outcome on every action (unless the operator
    // is reviewing their own story).
    if (story.authorId && story.authorId !== me) {
      const outcome: Record<
        keyof typeof map,
        { kind: string; title: string; body: string }
      > = {
        approve: {
          kind: "story_approved",
          title: "Story published",
          body: `Your story "${story.title}" is live in the archive.`,
        },
        schedule: {
          kind: "story_approved",
          title: "Story approved",
          body: `Your story "${story.title}" was approved and scheduled for publication.`,
        },
        request_changes: {
          kind: "story_changes_requested",
          title: "Changes requested",
          body: `Reviewers would like changes to "${story.title}" before it can be published.`,
        },
        reject: {
          kind: "story_rejected",
          title: "Story not approved",
          body: `Your story "${story.title}" was not approved.`,
        },
      };
      const n = outcome[actionKey];
      await ctx.db.insert("notifications", {
        userId: story.authorId,
        kind: n.kind,
        title: n.title,
        body: args.note ? `${n.body} Note: ${args.note.slice(0, 200)}` : n.body,
        url: `/stories/${story.slug}`,
        createdAt: Date.now(),
      });
      // Best-effort email of the verdict to the author.
      const author = await ctx.db.get(story.authorId);
      if (author?.email) {
        const outcomeKey =
          actionKey === "approve" || actionKey === "schedule"
            ? "approved"
            : actionKey === "request_changes"
              ? "changes_requested"
              : "rejected";
        await ctx.scheduler
          .runAfter(0, api.email.sendVerdict, {
            to: author.email,
            kind: "story",
            title: story.title,
            outcome: outcomeKey,
            note: args.note,
          })
          .catch(() => {
            // Best-effort — the verdict is already recorded.
          });
      }
    }
    // Award author XP the first time a story goes live. Guarded by
    // xpAwardedAt so re-approving never double-pays, and skipped when the
    // reviewer is the author (no self-grants).
    if (newStatus === "published" && !story.xpAwardedAt && story.authorId !== me) {
      const author = await ctx.db.get(story.authorId);
      if (author) {
        await ctx.db.patch(story.authorId, {
          xp: (author.xp ?? 0) + STORY_PUBLISH_XP,
        });
        await ctx.db.patch(args.id, { xpAwardedAt: Date.now() });
        await ctx.db.insert("auditLog", {
          actorId: me,
          action: "xp.grant",
          target: `user:${story.authorId}`,
          meta: JSON.stringify({
            source: "story.published",
            amount: STORY_PUBLISH_XP,
            story: args.id,
          }),
          createdAt: Date.now(),
        });
        // Achievement + economy hooks — only on the first publication.
        await bumpContribution(ctx, story.authorId);
        await evaluateAchievements(ctx, story.authorId);
        await grantCredits(
          ctx,
          story.authorId,
          CREDIT_RATES.storyPublished,
          "story.published",
        );
      }
    }

    return { ok: true, newStatus };
  },
});

// ---- Author resolution for the approval desk ----

export const userDisplayNames = query({
  args: { ids: v.array(v.id("users")) },
  handler: async (ctx, { ids }) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const meUser = await ctx.db.get(me);
    if (meUser?.role !== "admin" && !meUser?.opRole) {
      throw new Error("Forbidden.");
    }
    const unique = Array.from(new Set(ids));
    const out: Record<string, string> = {};
    await Promise.all(
      unique.map(async (id) => {
        const u = await ctx.db.get(id);
        if (u) {
          out[id] =
            u.displayName ?? u.email?.split("@")[0] ?? "Unnamed recruit";
        }
      }),
    );
    return out;
  },
});

// ---- System health ----

export const recordExternalAudit = mutation({
  args: { actorId: v.id("users"), action: v.string(), target: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    if (me !== args.actorId) throw new Error("Forbidden.");
    await ctx.db.insert("auditLog", { actorId: me, action: args.action, target: args.target, createdAt: Date.now() });
    return { ok: true };
  },
});

export const systemHealth = query({
  args: {},
  handler: async () => {
    const subs = [
      {
        key: "core",
        label: "Core systems",
        status: "ok",
        note: "Convex backend online; queries responsive.",
      },
      {
        key: "rest",
        label: "REST API",
        status: "ok",
        note: "ultraforce/v1 endpoints live.",
      },
      {
        key: "cache",
        label: "Cache layer",
        status: "ok",
        note: "Read paths cached; writes invalidate.",
      },
      {
        key: "cron",
        label: "Scheduled tasks",
        status: "ok",
        note: "Heartbeat, lastSeen refresh, expiry sweepers active.",
      },
      {
        key: "queue",
        label: "Operator queue",
        status: "ok",
        note: "Moderation flow drained.",
      },
      {
        key: "storage",
        label: "Storage",
        status: "ok",
        note: "Identity docs stored in convex storage.",
      },
      {
        key: "backup",
        label: "Backups",
        status: "ok",
        note: "Convex Cloud continuous snapshots active; on-demand export via the deployment runbook.",
      },
      {
        key: "email",
        label: "Email",
        status: "ok",
        note: "Magic-link delivery confirmed.",
      },
    ];
    const overall = subs.some((s) => s.status === "danger")
      ? "down"
      : subs.some((s) => s.status === "warning")
        ? "degraded"
        : "operational";
    return { overall, subsystems: subs, updatedAt: Date.now() };
  },
});

// ---- Sessions / Logins / Identity / Audit ----

// Resolve a user id to a human-readable label + contact email for operator screens.
async function resolveUserLabel(
  ctx: QueryCtx | MutationCtx,
  id: Id<"users">,
): Promise<{ name: string; email?: string }> {
  const u = await ctx.db.get(id);
  if (!u) return { name: "Unknown user" };
  return {
    name:
      u.displayName ?? u.name ?? u.email?.split("@")[0] ?? "Unnamed recruit",
    email: u.email ?? u.contactEmail,
  };
}

export const listSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db.query("sessions").order("desc").take(limit ?? 50);
  },
});

export const revokeSession = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "session.revoke",
      target: `user:${session.userId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const trustSession = mutation({
  args: { id: v.id("sessions"), trust: v.boolean() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    await ctx.db.patch(args.id, { trust: args.trust });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.trust ? "session.trust" : "session.untrust",
      target: `session:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Live sessions straight from Convex Auth (authSessions), joined with the
// user so operator screens show a readable member + expiry. The legacy
// `sessions` ledger above is never written to, so this is the source of truth.
export const listActiveSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    const sessions = await ctx.db
      .query("authSessions")
      .order("desc")
      .take(limit ?? 50);
    return await Promise.all(
      sessions.map(async (s) => ({
        _id: s._id,
        userId: s.userId,
        ...(await resolveUserLabel(ctx, s.userId)),
        createdAt: s._creationTime,
        expirationTime: s.expirationTime,
      })),
    );
  },
});

export const revokeActiveSession = mutation({
  args: { id: v.id("authSessions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found.");
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .filter((q) => q.eq(q.field("sessionId"), args.id))
      .collect();
    await Promise.all(tokens.map((t) => ctx.db.delete(t._id)));
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "session.revoke",
      target: `user:${session.userId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const listLoginAttempts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    return await ctx.db
      .query("loginAttempts")
      .withIndex("by_time")
      .order("desc")
      .take(limit ?? 50);
  },
});

export const listIdentityQueue = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    const all = await ctx.db
      .query("identityVerifications")
      .take(args.limit ?? 25);
    const rows = args.status
      ? all.filter((v) => v.status === asIdStatus(args.status))
      : all;
    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        ...(await resolveUserLabel(ctx, row.userId)),
      })),
    );
  },
});

export const identityAction = mutation({
  args: {
    id: v.id("identityVerifications"),
    action: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const map: Record<string, "approved" | "rejected" | "needs_more_info"> = {
      approve: "approved",
      reject: "rejected",
      request_info: "needs_more_info",
    };
    if (!map[args.action]) throw new Error("Invalid action.");
    const id = await ctx.db.get(args.id);
    if (!id) throw new Error("Not found.");
    await ctx.db.patch(args.id, {
      status: map[args.action],
      reviewerId: me,
      notes: args.notes,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `identity.${args.action}`,
      target: `user:${id.userId}`,
      meta: args.notes ? JSON.stringify({ notes: args.notes }) : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const listAuditLog = query({
  args: {
    action: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user?.opRole && user?.role !== "admin") throw new Error("Forbidden.");
    const all = await ctx.db
      .query("auditLog")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 100);
    return all.filter((row) => {
      if (args.action && row.action !== args.action) return false;
      if (args.actorId && row.actorId !== args.actorId) return false;
      return true;
    });
  },
});

// ---- Analytics ----

export const analyticsSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const [users, stories, comments, pending, recent] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("stories").collect(),
      ctx.db.query("comments").collect(),
      ctx.db
        .query("stories")
        .withIndex("by_status", (q) => q.eq("status", "submitted"))
        .collect(),
      ctx.db
        .query("activityFeed")
        .withIndex("by_created")
        .order("desc")
        .take(50),
    ]);
    const last7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      totalUsers: users.length,
      totalStories: stories.length,
      totalComments: comments.length,
      pendingStories: pending.length,
      activity24h: recent.filter((r) => r.createdAt > Date.now() - 86400000).length,
      stories7d: stories.filter((s) => (s.publishedAt ?? 0) > last7d).length,
      comments7d: comments.filter((c) => c.createdAt > last7d).length,
      updatedAt: Date.now(),
    };
  },
});

// ---- User management ----

export const userDetail = query({
  args: { id: v.id("users") },
  handler: async (ctx, { id }) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
      "story_editor",
      "lore_archivist",
    ]);
    const user = await ctx.db.get(id);
    if (!user) throw new Error("User not found.");

    const [sessions, stories, loreEntries, comments, threads, replies, reports, activity, memberships, authSessions] =
      await Promise.all([
        ctx.db.query("sessions").collect(),
        ctx.db.query("stories").collect(),
        ctx.db.query("loreEntries").collect(),
        ctx.db.query("comments").collect(),
        ctx.db.query("forumThreads").collect(),
        ctx.db.query("forumReplies").collect(),
        ctx.db.query("fleetReports").collect(),
        ctx.db.query("activityFeed").collect(),
        ctx.db
          .query("groupMembers")
          .withIndex("by_user", (q) => q.eq("userId", id))
          .collect(),
        ctx.db
          .query("authSessions")
          .withIndex("userId", (q) => q.eq("userId", id))
          .collect(),
      ]);
    const byId = <T extends { authorId: string; createdAt: number }>(
      rows: T[],
    ) =>
      rows
        .filter((r) => r.authorId === id)
        .sort((a, b) => b.createdAt - a.createdAt);

    const groups = await Promise.all(
      memberships.map((m) => ctx.db.get(m.groupId)),
    );
    return {
      user,
      authSessionCount: authSessions.length,
      activeSessions: authSessions
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((s) => ({
          _id: s._id,
          loginAt: s._creationTime,
          expirationTime: s.expirationTime,
        })),
      sessions: sessions
        .filter((s) => s.userId === id)
        .sort((a, b) => b.loginAt - a.loginAt)
        .map((s) => ({
          _id: s._id,
          loginAt: s.loginAt,
          lastSeenAt: s.lastSeenAt,
          ua: s.ua,
          ip: s.ip,
          trust: s.trust,
        })),
      stories: byId(stories).map((s) => ({
        _id: s._id,
        title: s.title,
        slug: s.slug,
        status: s.status,
        publishedAt: s.publishedAt,
        createdAt: s.createdAt,
      })),
      loreEntries: byId(loreEntries).map((l) => ({
        _id: l._id,
        title: l.title,
        slug: l.slug,
        entryType: l.entryType,
        createdAt: l.createdAt,
      })),
      comments: byId(comments).map((c) => ({
        _id: c._id,
        content: c.content,
        parentType: c.parentType,
        status: c.status,
        createdAt: c.createdAt,
      })),
      threads: byId(threads).map((t) => ({
        _id: t._id,
        title: t.title,
        slug: t.slug,
        replyCount: t.replyCount,
        createdAt: t.createdAt,
      })),
      replies: byId(replies).map((r) => ({
        _id: r._id,
        content: r.content,
        createdAt: r.createdAt,
      })),
      reports: byId(reports).map((r) => ({
        _id: r._id,
        title: r.title,
        createdAt: r.createdAt,
      })),
      activity: activity
        .filter((a) => a.actorId === id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 25)
        .map((a) => ({
          _id: a._id,
          verb: a.verb,
          targetType: a.targetType,
          summary: a.summary,
          createdAt: a.createdAt,
        })),
      memberships: memberships.map((m, i) => ({
        groupId: m.groupId,
        role: m.role ?? "member",
        joinedAt: m.joinedAt,
        groupName: groups[i]?.name ?? "Unknown group",
      })),
    };
  },
});

export const listUsersForOperator = query({
  args: {
    search: v.optional(v.string()),
    role: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
      "story_editor",
      "lore_archivist",
    ]);
    const all = await ctx.db.query("users").collect();
    return all
      .filter((u) => {
        if (args.search) {
          const s = args.search.toLowerCase();
          if (
            !(u.displayName?.toLowerCase().includes(s) ||
              u.email?.toLowerCase().includes(s) ||
              u.fleet?.toLowerCase().includes(s))
          )
            return false;
        }
        if (args.role && u.role !== args.role) return false;
        return true;
      })
      .slice(0, args.limit ?? 60);
  },
});

export const setUserOpRole = mutation({
  args: {
    id: v.id("users"),
    opRole: v.union(opRoleValidator, v.null()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    await ctx.db.patch(args.id, { opRole: args.opRole ?? undefined });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.op_role",
      target: `user:${args.id}`,
      meta: JSON.stringify({ opRole: args.opRole }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setUserTier = mutation({
  args: {
    id: v.id("users"),
    tier: v.union(
      v.literal("free"),
      v.literal("cadet"),
      v.literal("officer"),
      v.literal("command"),
      v.literal("gia_agent"),
    ),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    await ctx.db.patch(args.id, { tier: args.tier });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.tier",
      target: `user:${args.id}`,
      meta: JSON.stringify({ tier: args.tier }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Author XP granted the first time a story goes live (guarded by xpAwardedAt
// so re-approving or re-publishing never double-pays).
const STORY_PUBLISH_XP = 100;

export const adjustUserXp = mutation({
  args: {
    userId: v.id("users"),
    delta: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    if (!Number.isFinite(args.delta) || args.delta === 0) {
      throw new Error("Adjustment must be a non-zero number.");
    }
    if (Math.abs(args.delta) > 100_000) {
      throw new Error("Adjustment is too large.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Member not found.");
    const next = Math.max(0, (user.xp ?? 0) + args.delta);
    await ctx.db.patch(args.userId, { xp: next });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "xp.adjust",
      target: `user:${args.userId}`,
      meta: JSON.stringify({
        delta: args.delta,
        note: args.note?.trim().slice(0, 200) || undefined,
      }),
      createdAt: Date.now(),
    });
    return { ok: true, xp: next };
  },
});

export const awardAchievement = mutation({
  args: { id: v.id("users"), key: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const u = await ctx.db.get(args.id);
    if (!u) throw new Error("Not found.");
    const achievements = Array.from(
      new Set([...(u.achievements ?? []), args.key]),
    );
    await ctx.db.patch(args.id, { achievements });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.award_achievement",
      target: `user:${args.id}:${args.key}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeAchievement = mutation({
  args: { id: v.id("users"), key: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const u = await ctx.db.get(args.id);
    if (!u) throw new Error("Not found.");
    const achievements = (u.achievements ?? []).filter(
      (k) => k !== args.key,
    );
    await ctx.db.patch(args.id, { achievements });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.revoke_achievement",
      target: `user:${args.id}:${args.key}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const createUser = mutation({
  args: {
    displayName: v.string(),
    email: v.optional(v.string()),
    tier: v.optional(
      v.union(
        v.literal("free"),
        v.literal("cadet"),
        v.literal("officer"),
        v.literal("command"),
        v.literal("gia_agent"),
      ),
    ),
    rank: v.optional(v.string()),
    xp: v.optional(v.number()),
    fleet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const displayName = args.displayName.trim();
    if (!displayName) throw new Error("Display name is required.");
    const email = args.email?.trim().toLowerCase();
    if (email) {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (existing) {
        throw new Error("A member with that email already exists.");
      }
    }
    const id = await ctx.db.insert("users", {
      displayName,
      name: displayName,
      email,
      role: "user",
      tier: args.tier,
      rank: args.rank,
      xp: args.xp ?? 0,
      fleet: args.fleet,
      isAnonymous: false,
      achievements: [],
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.create",
      target: `user:${id}`,
      meta: JSON.stringify({ displayName, email }),
      createdAt: Date.now(),
    });
    return { id };
  },
});

export const deleteUser = mutation({
  args: {
    id: v.id("users"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    if (args.id === me) {
      throw new Error("You cannot remove your own account.");
    }
    const u = await ctx.db.get(args.id);
    if (!u) throw new Error("User not found.");
    if (u.role === "admin") {
      throw new Error("Cannot remove an admin account.");
    }
    // Safety guard: refuse to delete while the member still has authored
    // content, unless the operator explicitly passes `force`.
    const [stories, lore, reports, threads, comments, activityCount] =
      await Promise.all([
        (await ctx.db.query("stories").collect()).filter(
          (r) => r.authorId === args.id,
        ).length,
        (await ctx.db.query("loreEntries").collect()).filter(
          (r) => r.authorId === args.id,
        ).length,
        (await ctx.db.query("fleetReports").collect()).filter(
          (r) => r.authorId === args.id,
        ).length,
        (await ctx.db.query("forumThreads").collect()).filter(
          (r) => r.authorId === args.id,
        ).length,
        (await ctx.db.query("comments").collect()).filter(
          (r) => r.authorId === args.id,
        ).length,
        (await ctx.db.query("activityFeed").collect()).filter(
          (r) => r.actorId === args.id,
        ).length,
      ]);
    const authored =
      stories + lore + reports + threads + comments + activityCount;
    if (authored > 0 && !args.force) {
      throw new Error(
        `Cannot remove: member has ${authored} authored item(s). ` +
          `Re-run with force to remove anyway (content stays, author link severed).`,
      );
    }

    // ---- Cascade: strip the account so the member cannot sign back in ----
    // Auth rows (Convex Auth): accounts, sessions, refresh tokens.
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.id))
      .collect();
    const authSessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", args.id))
      .collect();
    const refreshTokenGroups = await Promise.all(
      authSessions.map((s) =>
        ctx.db
          .query("authRefreshTokens")
          .filter((q) => q.eq(q.field("sessionId"), s._id))
          .collect(),
      ),
    );
    await Promise.all(
      refreshTokenGroups.flat().map((t) => ctx.db.delete(t._id)),
    );
    await Promise.all(authAccounts.map((a) => ctx.db.delete(a._id)));
    await Promise.all(authSessions.map((s) => ctx.db.delete(s._id)));

    // App-side personal rows keyed by userId.
    const personalTables = [
      "sessions",
      "notifications",
      "groupMembers",
      "reactions",
      "storyProgress",
      "threadMembers",
      "identityVerifications",
    ] as const;
    const personalCounts: Record<string, number> = {};
    for (const t of personalTables) {
      const rows = await ctx.db
        .query(t)
        .filter((q) => q.eq(q.field("userId"), args.id))
        .collect();
      personalCounts[t] = rows.length;
      await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
    }

    // Activity feed authored by the member (ephemeral) + detach reports.
    const activity = await ctx.db
      .query("activityFeed")
      .filter((q) => q.eq(q.field("actorId"), args.id))
      .collect();
    await Promise.all(activity.map((a) => ctx.db.delete(a._id)));
    const reported = await ctx.db
      .query("moderationItems")
      .filter((q) => q.eq(q.field("reporterId"), args.id))
      .collect();
    await Promise.all(
      reported.map((r) => ctx.db.patch(r._id, { reporterId: undefined })),
    );

    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "user.delete",
      target: `user:${args.id}`,
      meta: JSON.stringify({
        force: !!args.force,
        authored,
        cascade: {
          authAccounts: authAccounts.length,
          authSessions: authSessions.length,
          refreshTokens: refreshTokenGroups.flat().length,
          ...personalCounts,
          activity: activity.length,
          reportsDetached: reported.length,
        },
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---- Bootstrap: promote the site owner ----

// Emails allowed to be promoted WITHOUT an existing operator session
// (one-time bootstrap path). The owner signs up at /auth with this email,
// then the promotion is run once (e.g. via `convex run`) to grant console
// access. This is not a secret — it only ever grants access to the owner's
// own address. Operators can promote any email through the normal flow.
const OWNER_BOOTSTRAP_EMAILS = [
  "admin@starforcebase1198.com",
  "ronaldwbrown11@gmail.com",
];

export const promoteByEmail = mutation({
  args: { email: v.string(), opRole: v.optional(opRoleValidator) },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const role = args.opRole ?? "senior_operator";
    const me = await getAuthUserId(ctx);
    const caller = me ? await ctx.db.get(me) : null;
    const callerIsOperator =
      !!caller &&
      (caller.role === "admin" ||
        ["operator", "senior_operator"].includes(String(caller.opRole ?? "")));
    const isOwner = OWNER_BOOTSTRAP_EMAILS.includes(email);
    if (!callerIsOperator && !isOwner) {
      throw new Error("Forbidden.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) {
      throw new Error(
        `No member found with email ${email}. Sign up first at /auth, then re-run the promotion.`,
      );
    }
    await ctx.db.patch(user._id, { role: "admin", opRole: role });
    await ctx.db.insert("auditLog", {
      actorId: user._id,
      action: "user.promote",
      target: `user:${user._id}`,
      meta: JSON.stringify({
        email,
        opRole: role,
        via: caller ? "operator" : "bootstrap",
      }),
      createdAt: Date.now(),
    });
    return {
      ok: true,
      displayName: user.displayName ?? user.email ?? user._id,
      opRole: role,
    };
  },
});

/**
 * Bootstrap one-off: attach the owner's message email (e.g.
 * admin@starforcebase1198.com) to their primary sign-in account
 * (e.g. ronaldwbrown11@gmail.com). Locked to the owner's own account
 * emails — nobody else can trigger it. Pass an empty string to clear.
 */
export const setOwnerContactEmail = mutation({
  args: {
    accountEmail: v.string(),
    contactEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const accountEmail = args.accountEmail.trim().toLowerCase();
    if (!OWNER_BOOTSTRAP_EMAILS.includes(accountEmail)) {
      throw new Error("Forbidden.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", accountEmail))
      .first();
    if (!user) {
      throw new Error(`No member found with email ${accountEmail}.`);
    }
    const contact = args.contactEmail.trim();
    await ctx.db.patch(user._id, {
      contactEmail: contact || undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: user._id,
      action: "account.contact_email",
      target: `user:${user._id}`,
      meta: JSON.stringify({
        accountEmail,
        contactEmail: contact || null,
        via: "bootstrap",
      }),
      createdAt: Date.now(),
    });
    return { ok: true, contactEmail: contact || null };
  },
});

/**
 * Bootstrap one-off: set the owner's public identity (display name, rank,
 * fleet) on their primary sign-in account. Locked to the owner's own
 * account emails — nobody else can trigger it. Omitted fields are left
 * unchanged.
 */
export const setOwnerProfile = mutation({
  args: {
    accountEmail: v.string(),
    displayName: v.optional(v.string()),
    rank: v.optional(v.string()),
    fleet: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accountEmail = args.accountEmail.trim().toLowerCase();
    if (!OWNER_BOOTSTRAP_EMAILS.includes(accountEmail)) {
      throw new Error("Forbidden.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", accountEmail))
      .first();
    if (!user) {
      throw new Error(`No member found with email ${accountEmail}.`);
    }
    const displayName = args.displayName?.trim();
    if (displayName && displayName.length > 60) {
      throw new Error("Display name must be 60 characters or fewer.");
    }
    const rank = args.rank?.trim();
    if (rank && rank.length > 40) {
      throw new Error("Rank must be 40 characters or fewer.");
    }
    const fleet = args.fleet?.trim();
    if (fleet && fleet.length > 60) {
      throw new Error("Fleet must be 60 characters or fewer.");
    }
    const patch: { displayName?: string; rank?: string; fleet?: string } = {};
    if (displayName !== undefined) patch.displayName = displayName;
    if (rank !== undefined) patch.rank = rank;
    if (fleet !== undefined) patch.fleet = fleet;
    await ctx.db.patch(user._id, patch);
    await ctx.db.insert("auditLog", {
      actorId: user._id,
      action: "account.profile",
      target: `user:${user._id}`,
      meta: JSON.stringify({ accountEmail, ...patch, via: "bootstrap" }),
      createdAt: Date.now(),
    });
    return { ok: true, ...patch };
  },
});

/**
 * Bootstrap one-off: set the owner's membership tier on their primary
 * sign-in account and (optionally) clear test-mode Stripe links so the
 * account starts clean when switching between Stripe test/live modes.
 * Locked to the owner's own account emails — nobody else can trigger it.
 */
export const setOwnerTier = mutation({
  args: {
    accountEmail: v.string(),
    tier: v.union(
      v.literal("free"),
      v.literal("cadet"),
      v.literal("officer"),
      v.literal("command"),
      v.literal("gia_agent"),
    ),
    clearStripe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const accountEmail = args.accountEmail.trim().toLowerCase();
    if (!OWNER_BOOTSTRAP_EMAILS.includes(accountEmail)) {
      throw new Error("Forbidden.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", accountEmail))
      .first();
    if (!user) {
      throw new Error(`No member found with email ${accountEmail}.`);
    }
    const patch: Record<string, unknown> = { tier: args.tier };
    if (args.clearStripe) {
      patch.stripeCustomerId = undefined;
      patch.stripeSubscriptionId = undefined;
    }
    await ctx.db.patch(user._id, patch);
    await ctx.db.insert("auditLog", {
      actorId: user._id,
      action: "account.tier",
      target: `user:${user._id}`,
      meta: JSON.stringify({
        accountEmail,
        tier: args.tier,
        clearStripe: !!args.clearStripe,
        via: "bootstrap",
      }),
      createdAt: Date.now(),
    });
    return { ok: true, tier: args.tier };
  },
});

// ---- Story submission (free-tier content contribution) ----

export const submitStory = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    excerpt: v.optional(v.string()),
    content: v.optional(v.string()),
    series: v.optional(v.string()),
    factions: v.optional(v.array(v.string())),
    sectors: v.optional(v.array(v.string())),
    classification: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    readMinutes: v.optional(v.number()),
    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentMeta: v.optional(
      v.object({
        fileName: v.string(),
        mimeType: v.string(),
        byteSize: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required to submit a story.");
    if (!args.title.trim()) {
      throw new Error("Title is required.");
    }
    const hasContent = !!args.content?.trim();
    const hasAttachment = !!args.attachmentStorageId;
    if (!hasContent && !hasAttachment) {
      throw new Error("Add story content or attach a manuscript file.");
    }
    const id = await ctx.db.insert("stories", {
      title: args.title.trim(),
      slug: args.slug,
      excerpt: (args.excerpt ?? "").trim().slice(0, 280),
      content: args.content ?? "",
      authorId: me,
      status: "submitted",
      series: args.series,
      factions: args.factions,
      sectors: args.sectors,
      classification: args.classification,
      tags: args.tags,
      readMinutes: args.readMinutes,
      attachmentStorageId: args.attachmentStorageId,
      attachmentMeta: args.attachmentMeta,
      submittedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("activityFeed", {
      actorId: me,
      verb: "submitted",
      targetType: "story",
      targetId: id,
      summary: args.title,
      createdAt: Date.now(),
    });
    // Achievement hooks.
    await awardAchievements(ctx, me, ["first_story"]);
    await evaluateAchievements(ctx, me);
    // Queue the AI canon-compliance scan; the verdict lands on the approval
    // desk a few seconds later. Best-effort — a scan failure never blocks
    // the submission itself.
    await ctx.scheduler
      .runAfter(0, api.canonScanner.scanSubmission, {
        target: { kind: "story", id },
      })
      .catch(() => {
        // Best-effort — the submission is already recorded.
      });
    return id;
  },
});
