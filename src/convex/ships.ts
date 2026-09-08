import { mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  ALL_SHIP_GROUPS,
  getShipCategory,
  getShipMissionsForClass,
  SHIP_CLASSES,
  SHIP_ROLES,
} from "../lib/ships";
import { applyXpGain, grantCredits } from "./economy";

// =============================================================================
// Ship assignment — cosmetic + identity only. Never affects gameplay
// mechanics. Writes are validated against the canonical catalog in
// src/lib/ships.ts so no freeform garbage can land on the user record.
// =============================================================================

// ---------------------------------------------------------------------------
// Barracks auto-join (affiliation groups)
// ---------------------------------------------------------------------------
// When a pilot confirms a ship assignment with the barracks checkbox enabled,
// we enroll them in the public community group whose name matches their chosen
// formation (e.g. ship group "G.I.A." → community group "G.I.A."). If no such
// group exists, the auto-join skips silently — the affiliation label on their
// profile still works either way. Auto-joined memberships carry the
// `autoJoined` flag so a later formation change can clean-swap them out;
// manual joins and groups the pilot has posted in are never touched.

/**
 * Find the public community group whose name matches a ship-group catalog
 * name (case-insensitive). Returns null when there's no match or the group
 * isn't public — the caller skips silently in that case.
 */
async function findBarracksGroup(
  ctx: MutationCtx,
  shipGroup: string,
) {
  const target = shipGroup.trim().toLowerCase();
  if (!target) return null;
  const groups = await ctx.db.query("groups").collect();
  return (
    groups.find(
      (g) => g.privacy === "public" && g.name.trim().toLowerCase() === target,
    ) ?? null
  );
}

/** True when the pilot has authored posts or chat in the group (active). */
async function hasAuthoredInGroup(
  ctx: MutationCtx,
  userId: Id<"users">,
  groupId: Id<"groups">,
): Promise<boolean> {
  const posts = await ctx.db
    .query("groupPosts")
    .withIndex("by_group_created", (q) => q.eq("groupId", groupId))
    .collect();
  if (posts.some((p) => p.authorId === userId)) return true;
  const messages = await ctx.db
    .query("groupMessages")
    .withIndex("by_group_created", (q) => q.eq("groupId", groupId))
    .collect();
  return messages.some((m) => m.authorId === userId);
}

/**
 * Enroll the pilot in the barracks group for `shipGroup`. No-ops when the
 * group doesn't exist, isn't public, or the pilot is already a member.
 */
async function joinBarracksGroup(
  ctx: MutationCtx,
  userId: Id<"users">,
  shipGroup: string,
): Promise<boolean> {
  const group = await findBarracksGroup(ctx, shipGroup);
  if (!group) return false;
  const existing = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .filter((q) => q.eq(q.field("userId"), userId))
    .first();
  if (existing) return false;
  await ctx.db.insert("groupMembers", {
    groupId: group._id,
    userId,
    joinedAt: Date.now(),
    role: "member",
    autoJoined: true,
  });
  await ctx.db.patch(group._id, {
    memberCount: (group.memberCount ?? 0) + 1,
    latestActivityAt: Date.now(),
  });
  return true;
}

/**
 * Clean-swap: leave the barracks group for a previous formation, but only if
 * the membership was auto-joined AND the pilot hasn't been active there.
 * Manual joins are never touched.
 */
async function leaveBarracksGroup(
  ctx: MutationCtx,
  userId: Id<"users">,
  shipGroup: string,
): Promise<boolean> {
  const group = await findBarracksGroup(ctx, shipGroup);
  if (!group) return false;
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .filter((q) => q.eq(q.field("userId"), userId))
    .first();
  if (!membership) return false;
  if (!membership.autoJoined) return false; // manual join — never touched
  if (await hasAuthoredInGroup(ctx, userId, group._id)) return false;
  await ctx.db.delete(membership._id);
  await ctx.db.patch(group._id, {
    memberCount: Math.max(0, (group.memberCount ?? 0) - 1),
  });
  return true;
}

export const setMyShip = mutation({
  args: {
    shipClass: v.string(),
    shipRole: v.string(),
    shipGroup: v.string(),
    shipName: v.optional(v.string()),
    // Wizard consent: enroll in the formation's barracks community group
    // when a matching public group exists (checked by default).
    enrollBarracks: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to assign a ship.");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Account not found.");

    if (!SHIP_CLASSES.includes(args.shipClass)) {
      throw new Error("That hull isn't in the fleet registry.");
    }
    if (!SHIP_ROLES.includes(args.shipRole as (typeof SHIP_ROLES)[number])) {
      throw new Error("That role isn't a recognized ship role.");
    }
    if (!ALL_SHIP_GROUPS.includes(args.shipGroup)) {
      throw new Error("That ship group isn't a recognized formation.");
    }
    const shipName = (args.shipName ?? "").trim().slice(0, 60);
    if (shipName && shipName.length > 60) {
      throw new Error("Ship name must be 60 characters or fewer.");
    }

    const oldGroup = me.shipGroup ?? null;
    const category = getShipCategory(args.shipClass);
    await ctx.db.patch(userId, {
      shipClass: args.shipClass,
      shipCategory: category ?? undefined,
      shipRole: args.shipRole,
      shipGroup: args.shipGroup,
      shipName: shipName || undefined,
    });

    // Smart switching: leaving the previous formation's barracks only when
    // the membership was auto-joined and the pilot hasn't been active there.
    let leftBarracks = false;
    if (oldGroup && oldGroup !== args.shipGroup) {
      leftBarracks = await leaveBarracksGroup(ctx, userId, oldGroup);
    }
    // Consent-gated enrollment in the new formation's barracks group.
    const joinedBarracks =
      args.enrollBarracks === true
        ? await joinBarracksGroup(ctx, userId, args.shipGroup)
        : false;

    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "ship.assign",
      target: `user:${userId}`,
      meta: JSON.stringify({
        shipClass: args.shipClass,
        shipRole: args.shipRole,
        shipGroup: args.shipGroup,
        shipName: shipName || null,
        enrollBarracks: args.enrollBarracks === true,
        joinedBarracks,
        leftBarracks,
      }),
      createdAt: Date.now(),
    });
    return { ok: true, shipClass: args.shipClass };
  },
});

export const clearMyShip = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Account not found.");
    await ctx.db.patch(userId, {
      shipCategory: undefined,
      shipClass: undefined,
      shipRole: undefined,
      shipGroup: undefined,
      shipName: undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "ship.clear",
      target: `user:${userId}`,
      meta: JSON.stringify({}),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Complete a mission themed to the pilot's ship class. Ids are keyed by class
// (ship:<Class>:<n>), so switching ships never resets another class's progress.
export const completeShipMission = mutation({
  args: { missionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to run ship missions.");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("Account not found.");
    if (!me.shipClass) throw new Error("Assign a ship before running ship missions.");

    const [className, idxStr] = args.missionId.replace(/^ship:/, "").split(":");
    if (!className || idxStr === undefined) {
      throw new Error("Unknown ship mission.");
    }
    const missions = getShipMissionsForClass(className);
    const mission = missions[Number(idxStr)];
    if (!mission) throw new Error("Unknown ship mission.");

    const completed = me.shipCompletedMissions ?? [];
    if (completed.includes(args.missionId)) {
      throw new Error("Mission already logged in your ship record.");
    }
    const next = [...completed, args.missionId];
    const now = Date.now();
    await ctx.db.patch(userId, { shipCompletedMissions: next });
    await applyXpGain(ctx, userId, mission.xp);
    await grantCredits(ctx, userId, mission.credits, "ship_mission");
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "ship.mission",
      target: `user:${userId}`,
      meta: JSON.stringify({ missionId: args.missionId, xp: mission.xp }),
      createdAt: now,
    });
    return { ok: true, xp: mission.xp, credits: mission.credits };
  },
});

// Fleet registry — pilots grouped by their assigned hull class. Public read.
export const listShipRegistry = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 60, 1), 200);
    const users = await ctx.db.query("users").collect();
    const rows = users
      .filter((u) => !!u.shipClass && !!u.displayName)
      .map((u) => ({
        userId: u._id,
        displayName: u.displayName as string,
        shipCategory: u.shipCategory ?? null,
        shipClass: u.shipClass as string,
        shipRole: u.shipRole ?? null,
        shipGroup: u.shipGroup ?? null,
        shipName: u.shipName ?? null,
        rank: u.rank ?? null,
        tier: u.tier ?? null,
        xp: u.xp ?? 0,
        flair: u.flair ?? null,
      }))
      .sort((a, b) =>
        a.shipClass === b.shipClass
          ? a.displayName.localeCompare(b.displayName)
          : a.shipClass.localeCompare(b.shipClass),
      )
      .slice(0, limit);
    return { count: rows.length, rows };
  },
});