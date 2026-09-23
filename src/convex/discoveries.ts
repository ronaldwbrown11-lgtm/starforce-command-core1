import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import {
  awardAchievements,
  bumpContribution,
  evaluateAchievements,
} from "./achievements";
import { CREDIT_RATES, grantCredits } from "./economy";

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

// Public: approved systems only, newest first, with the discoverer's name,
// endorsement count, and whether the viewer already endorsed it (#30).
export const listDiscoveries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("discoveries")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(200);
    return Promise.all(
      rows.map(async (d) => {
        const author = d.authorId ? await ctx.db.get(d.authorId) : null;
        const votes = await ctx.db
          .query("discoveryVotes")
          .withIndex("by_discovery", (q) => q.eq("discoveryId", d._id))
          .collect();
        const myVote = userId
          ? votes.some((v) => v.userId === userId)
          : false;
        return {
          _id: d._id,
          title: d.title,
          description: d.description,
          x: d.x,
          y: d.y,
          sector: d.sector ?? null,
          faction: d.faction ?? null,
          createdAt: d.createdAt,
          voteCount: votes.length,
          myVote,
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

// Member: endorse (or withdraw endorsement from) a charted system (#30).
// Toggling is idempotent — voting twice removes the vote.
export const voteDiscovery = mutation({
  args: { id: v.id("discoveries") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to endorse a system.");
    const discovery = await ctx.db.get(args.id);
    if (!discovery || discovery.status !== "approved") {
      throw new Error("That system isn't charted.");
    }
    const existing = await ctx.db
      .query("discoveryVotes")
      .withIndex("by_user_discovery", (q) =>
        q.eq("userId", userId).eq("discoveryId", args.id),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { ok: true, voted: false };
    }
    await ctx.db.insert("discoveryVotes", {
      discoveryId: args.id,
      userId,
      createdAt: Date.now(),
    });
    return { ok: true, voted: true };
  },
});

// Public: current faction claims on the Star Atlas sectors (#30).
export const listSectorClaims = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("sectorClaims").collect();
    return Promise.all(
      rows.map(async (r) => {
        const claimant = r.claimedBy ? await ctx.db.get(r.claimedBy) : null;
        return {
          sector: r.sector,
          faction: r.faction,
          createdAt: r.createdAt,
          groupId: r.groupId ?? null,
          groupName: r.groupName ?? null,
          claimant: claimant
            ? {
                displayName: claimant.displayName ?? claimant.name ?? "Anonymous",
                rank: claimant.rank ?? "Recruit",
              }
            : null,
        };
      }),
    );
  },
});

// Member: claim a sector of the chart for a faction (#30). A later claim by
// a different faction replaces the previous holder; same-faction re-claims
// are a no-op. Claims are public and listed on the Star Atlas page, and can
// be made personally or on behalf of a group the claimant belongs to
// (groupId → group ownership).
export const claimSector = mutation({
  args: {
    sector: v.string(),
    faction: v.string(),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to claim a sector.");
    const sector = args.sector.trim().slice(0, 80);
    const faction = args.faction.trim().slice(0, 60);
    if (!sector) throw new Error("Pick a sector to claim.");
    if (!faction) throw new Error("Pick the faction making the claim.");

    // Group ownership: when claiming for a group, the claimant must be a
    // member of that group, and the group name is stamped on the claim.
    const gid = args.groupId;
    let groupName: string | undefined;
    if (gid) {
      const group = await ctx.db.get(gid);
      if (!group) throw new Error("Group not found.");
      const membership = await ctx.db
        .query("groupMembers")
        .withIndex("by_group", (q) => q.eq("groupId", gid))
        .filter((q) => q.eq(q.field("userId"), userId))
        .first();
      if (!membership) {
        throw new Error("You must be a member of the group to claim on its behalf.");
      }
      groupName = group.name;
    }

    const existing = await ctx.db
      .query("sectorClaims")
      .withIndex("by_sector", (q) => q.eq("sector", sector))
      .first();
    const now = Date.now();
    const holderLabel = groupName ?? faction;
    if (existing) {
      if (existing.faction === faction && (existing.groupId ?? null) === (args.groupId ?? null)) {
        return { ok: true, replaced: false, groupName: groupName ?? null };
      }
      await ctx.db.patch(existing._id, {
        faction,
        claimedBy: userId,
        groupId: gid ?? undefined,
        groupName,
        createdAt: now,
      });
      await ctx.db.insert("activityFeed", {
        actorId: userId,
        verb: "claimed",
        targetType: "sector",
        targetId: sector,
        url: "/maps",
        summary: `${holderLabel} claimed ${sector}`, // trusted display labels
        createdAt: now,
      });
      return { ok: true, replaced: true, groupName: groupName ?? null };
    }
    await ctx.db.insert("sectorClaims", {
      sector,
      faction,
      claimedBy: userId,
      groupId: gid ?? undefined,
      groupName,
      createdAt: now,
    });
    await ctx.db.insert("activityFeed", {
      actorId: userId,
      verb: "claimed",
      targetType: "sector",
      targetId: sector,
      url: "/maps",
      summary: `${holderLabel} claimed ${sector}`,
      createdAt: now,
    });
    return { ok: true, replaced: false, groupName: groupName ?? null };
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
          kind: d.kind ?? "system",
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
    // "system" (default) charts a star system; "sector" proposes a new
    // sector region for the galaxy map.
    kind: v.optional(v.string()),
    sector: v.optional(v.string()),
    sectorSlug: v.optional(v.string()),
    faction: v.optional(v.string()),
    missionId: v.optional(v.id("missions")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to chart a system.");

    const kind = args.kind === "sector" ? "sector" : "system";

    const title = args.title.trim();
    if (title.length < 2) throw new Error("Give it a name (at least 2 characters).");
    if (title.length > 60) throw new Error("Names are limited to 60 characters.");

    const description = (args.description ?? "").trim().slice(0, 400);
    if (description && description.length < 10) {
      throw new Error("Description is too short — tell us what you found.");
    }

    if (!Number.isFinite(args.x) || !Number.isFinite(args.y)) {
      throw new Error("Invalid map position.");
    }
    const x = clamp(args.x, X_MIN, X_MAX);
    const y = clamp(args.y, Y_MIN, Y_MAX);

    let sector = (args.sector ?? "").trim().slice(0, 80) || undefined;
    let sectorSlug = (args.sectorSlug ?? "").trim().slice(0, 80) || undefined;
    const faction = (args.faction ?? "").trim().slice(0, 60) || undefined;

    // Sector proposals become galaxy regions — resolve the slug and refuse
    // duplicates against canon sectors and other pending sector proposals.
    if (kind === "sector") {
      if (sector) {
        throw new Error("A sector proposal doesn't live inside another sector.");
      }
      sectorSlug = undefined;
      const slug =
        title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "new-sector";
      const existingCanon = await ctx.db
        .query("sectorMap")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (existingCanon) {
        throw new Error("A sector with that name is already on the chart.");
      }
      const pendingSectors = await ctx.db
        .query("discoveries")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
      if (
        pendingSectors.some(
          (d) =>
            d.kind === "sector" &&
            d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") ===
              title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        )
      ) {
        throw new Error("A sector proposal with that name is already awaiting review.");
      }
    }

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
      kind,
      sector,
      sectorSlug,
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
      summary: kind === "sector" ? `Proposed a new sector: ${title}` : `Proposed a system: ${title}`,
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

    // Sector proposals canonize into the galaxy map on approval: a new
    // sectorMap row (unless an operator already created it by that slug).
    if (args.action === "approve" && item.kind === "sector") {
      const slug =
        item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
        `sector-${args.id.slice(-6)}`;
      const existing = await ctx.db
        .query("sectorMap")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!existing) {
        await ctx.db.insert("sectorMap", {
          name: item.title,
          slug,
          description: item.description || undefined,
          x: item.x,
          y: item.y,
          r: 70, // default influence radius; operators can resize in console
          loreCount: 0,
        });
        await ctx.db.insert("auditLog", {
          actorId: me,
          action: "sector.canonize",
          target: `sectorMap:${slug}`,
          meta: JSON.stringify({ from: `discovery:${args.id}`, name: item.title }),
          createdAt: Date.now(),
        });
      }
    }

    // Notify the discoverer of the outcome (skip when an operator reviewed
    // their own proposal).
    if (item.authorId !== me) {
      await ctx.db.insert("notifications", {
        userId: item.authorId,
        kind: args.action === "approve" ? "discovery_approved" : "discovery_rejected",
        title:
          args.action === "approve"
            ? item.kind === "sector"
              ? "Your sector joined the chart"
              : "Your system was charted"
            : item.kind === "sector"
              ? "Your sector proposal was not charted"
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
        // Achievement + economy hooks — only on the first approval.
        await awardAchievements(ctx, item.authorId, ["temporal_investigator"]);
        await bumpContribution(ctx, item.authorId);
        await evaluateAchievements(ctx, item.authorId);
        await grantCredits(
          ctx,
          item.authorId,
          CREDIT_RATES.discoveryApproved,
          "discovery.approved",
        );
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
