import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Discoveries — member-charted star systems on the galaxy map.
//
// Members click an empty region of the SVG map to propose a system. The
// proposal sits in "pending" until an operator approves or rejects it in the
// Discoveries desk. Approved systems render as distinct nodes on the public
// map and award the discoverer XP (once, guarded by xpAwardedAt).
// =========================================================================

const DISCOVERY_CAPS = ["operator", "senior_operator", "lore_archivist"];

// Author XP granted the first time a proposed system is approved.
const DISCOVERY_APPROVED_XP = 25;

// Generous but sane bounds for the SVG map space (viewBox is computed from
// sector positions, so proposals can sit anywhere in that plane).
const X_MIN = -400;
const X_MAX = 1400;
const Y_MIN = -400;
const Y_MAX = 1000;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

// Public: approved systems only, newest first, with the discoverer's name.
export const listDiscoveries = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("discoveries")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(200);
    return Promise.all(
      rows.map(async (d) => {
        const author = d.authorId ? await ctx.db.get(d.authorId) : null;
        return {
          _id: d._id,
          title: d.title,
          description: d.description,
          x: d.x,
          y: d.y,
          sector: d.sector ?? null,
          faction: d.faction ?? null,
          createdAt: d.createdAt,
          author: author
            ? {
                displayName: author.displayName ?? author.name ?? "Anonymous",
                rank: author.rank ?? "Recruit",
              }
            : null,
        };
      }),
    );
  },
});

// Operator: every proposal (pending / approved / rejected), newest first.
export const listDiscoveriesForOperator = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, DISCOVERY_CAPS);
    const rows = await ctx.db
      .query("discoveries")
      .withIndex("by_created")
      .order("desc")
      .take(200);
    return Promise.all(
      rows.map(async (d) => {
        const author = d.authorId ? await ctx.db.get(d.authorId) : null;
        const mission = d.missionId ? await ctx.db.get(d.missionId) : null;
        return {
          _id: d._id,
          title: d.title,
          description: d.description,
          x: d.x,
          y: d.y,
          sector: d.sector ?? null,
          faction: d.faction ?? null,
          status: d.status,
          reviewNote: d.reviewNote ?? null,
          createdAt: d.createdAt,
          author: author
            ? {
                displayName: author.displayName ?? author.name ?? "Anonymous",
                email: author.email ?? null,
              }
            : null,
          mission: mission ? { title: mission.title, slug: mission.slug } : null,
        };
      }),
    );
  },
});

// Operator: how many proposals are waiting for review (desk badge).
export const pendingDiscoveryCount = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, DISCOVERY_CAPS);
    const rows = await ctx.db
      .query("discoveries")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return rows.length;
  },
});

// Member: propose a new system by clicking an empty region of the map.
export const proposeDiscovery = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    sector: v.optional(v.string()),
    faction: v.optional(v.string()),
    missionId: v.optional(v.id("missions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to chart a system.");

    const title = args.title.trim();
    if (title.length < 2) throw new Error("Give the system a name (at least 2 characters).");
    if (title.length > 60) throw new Error("System names are limited to 60 characters.");

    const description = (args.description ?? "").trim().slice(0, 400);
    if (description && description.length < 10) {
      throw new Error("Description is too short — tell us what you found.");
    }

    if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
      throw new Error("Invalid map position.");
    }
    const x = clamp(args.x, X_MIN, X_MAX);
    const y = clamp(args.y, Y_MIN, Y_MAX);

    const sector = (args.sector ?? "").trim().slice(0, 80) || undefined;
    const faction = (args.faction ?? "").trim().slice(0, 60) || undefined;

    let missionId: typeof args.missionId;
    if (args.missionId) {
      const mission = await ctx.db.get(args.missionId);
      if (!mission) throw new Error("That operation doesn't exist.");
      if (mission.missionStatus !== "active") {
        throw new Error("That operation isn't open to new surveys.");
      }
      missionId = args.missionId;
    }

    const now = Date.now();
    const id = await ctx.db.insert("discoveries", {
      title,
      description,
      x,
      y,
      sector,
      faction,
      missionId,
      authorId: userId,
      status: "pending",
      createdAt: now,
    });

    await ctx.db.insert("activityFeed", {
      actorId: userId,
      verb: "proposed_discovery",
      targetType: "discovery",
      targetId: id,
      url: "/map",
      summary: `Proposed a system: ${title}`,
      createdAt: now,
    });

    return { ok: true, id };
  },
});

// Operator: approve (canonize + award XP) or reject a proposed system.
export const discoveryApprovalAction = mutation({
  args: {
    id: v.id("discoveries"),
    action: v.string(), // "approve" | "reject"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, DISCOVERY_CAPS);
    if (!["approve", "reject"].includes(args.action)) {
      throw new Error("Invalid action.");
    }
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Not found.");
    const status = args.action === "approve" ? "approved" : "rejected";
    const note = (args.note ?? "").trim().slice(0, 400) || undefined;

    await ctx.db.patch(args.id, {
      status,
      reviewedAt: Date.now(),
      reviewerId: me,
      reviewNote: note,
    });

    // Notify the discoverer of the outcome (skip when an operator reviewed
    // their own proposal).
    if (item.authorId !== me) {
      await ctx.db.insert("notifications", {
        userId: item.authorId,
        kind: args.action === "approve" ? "discovery_approved" : "discovery_rejected",
        title:
          args.action === "approve"
            ? "Your system was charted"
            : "Your system proposal was not charted",
        body: item.title.slice(0, 140),
        url: "/map",
        createdAt: Date.now(),
      });
    }

    // Award discoverer XP the first time a proposal is approved. Guarded by
    // xpAwardedAt; skipped on self-review.
    if (args.action === "approve" && !item.xpAwardedAt && item.authorId !== me) {
      const author = await ctx.db.get(item.authorId);
      if (author) {
        await ctx.db.patch(item.authorId, {
          xp: (author.xp ?? 0) + DISCOVERY_APPROVED_XP,
        });
        await ctx.db.patch(args.id, { xpAwardedAt: Date.now() });
        await ctx.db.insert("auditLog", {
          actorId: me,
          action: "xp.grant",
          target: `user:${item.authorId}`,
          meta: JSON.stringify({
            source: "discovery.approved",
            amount: DISCOVERY_APPROVED_XP,
            discovery: args.id,
          }),
          createdAt: Date.now(),
        });
      }
    }

    if (args.action === "approve") {
      await ctx.db.insert("activityFeed", {
        actorId: me,
        verb: "published",
        targetType: "discovery",
        targetId: args.id,
        url: "/map",
        summary: `Charted a new system: ${item.title}`,
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `discovery.${args.action}`,
      target: `discovery:${args.id}`,
      meta: note ? JSON.stringify({ note }) : undefined,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

// Operator: remove a proposal entirely (spam / duplicates).
export const deleteDiscovery = mutation({
  args: { id: v.id("discoveries") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, DISCOVERY_CAPS);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "discovery.delete",
      target: `discovery:${args.id}`,
      meta: JSON.stringify({ title: existing.title }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
