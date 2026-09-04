import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
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

export const setMyShip = mutation({
  args: {
    shipClass: v.string(),
    shipRole: v.string(),
    shipGroup: v.string(),
    shipName: v.optional(v.string()),
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

    const category = getShipCategory(args.shipClass);
    await ctx.db.patch(userId, {
      shipClass: args.shipClass,
      shipCategory: category ?? undefined,
      shipRole: args.shipRole,
      shipGroup: args.shipGroup,
      shipName: shipName || undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: userId,
      action: "ship.assign",
      target: `user:${userId}`,
      meta: JSON.stringify({
        shipClass: args.shipClass,
        shipRole: args.shipRole,
        shipGroup: args.shipGroup,
        shipName: shipName || null,
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