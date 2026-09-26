import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import { enforceRateLimit } from "./rateLimit";
import type { Id } from "./_generated/dataModel";

const HULL_PREFIX = "SFB-1198-";
const CALLSIGN_MAX = 32;

// =========================================================================
// Personal StarCraft fighters — the Wings honor itself.
//
// Earning wings allocates a member their OWN fighter: a type from the Fleet
// Registry, an AUTO-SEQUENTIAL hull number (SFB-1198-001, 002, …), and a
// callsign the pilot chooses (e.g. "DARKSTAR"). Distinct from the free
// onboarding crew posting. Rendered on the Wall of Honor (/honor) and the
// member dossier with the operator per-type image (fallback: registry art).
// =========================================================================

function normalizeCallsign(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, " ").slice(0, CALLSIGN_MAX);
}

/** Next auto-sequential hull number: max existing suffix + 1, zero-padded 3. */
async function nextHullNumber(ctx: QueryCtx | MutationCtx): Promise<string> {
  const rows = await ctx.db.query("starfighters").collect();
  let max = 0;
  for (const r of rows) {
    const m = /^SFB-1198-(\d+)$/.exec(r.hullNumber ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${HULL_PREFIX}${String(max + 1).padStart(3, "0")}`;
}

async function hasFighter(
  ctx: QueryCtx | MutationCtx,
  memberId: Id<"users">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("starfighters")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .first();
  return Boolean(existing);
}

// ---------------------------------------------------------------------------
// Claim — the Wings ceremony's final step. Eligibility is enforced by the
// wings flow (the claim token burn); this records the fighter afterward.
// Callsign is member-chosen; hull number is auto-sequential server-side.
// ---------------------------------------------------------------------------

export const claimMyFighter = mutation({
  args: {
    vesselKey: v.string(),
    designation: v.string(),
    shipClass: v.optional(v.string()),
    callsign: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    await enforceRateLimit(
      ctx,
      "fighter_claim",
      me,
      10,
      60 * 60 * 1000,
      "Too many attempts — try again later.",
    );

    const callsign = normalizeCallsign(args.callsign);
    if (callsign.length < 2) {
      throw new Error("Choose a callsign of at least 2 characters.");
    }
    const designation = args.designation.trim().slice(0, 120);
    if (!args.vesselKey.trim() || !designation) {
      throw new Error("Fighter type is required.");
    }
    if (await hasFighter(ctx, me)) {
      throw new Error(
        "You already hold a fighter. The honor is permanent — contact the Bridge for corrections.",
      );
    }

    const hullNumber = await nextHullNumber(ctx);
    const awardedAt = Date.now();
    const id = await ctx.db.insert("starfighters", {
      memberId: me,
      vesselKey: args.vesselKey.trim().slice(0, 64),
      designation,
      shipClass: args.shipClass?.trim().slice(0, 120) || undefined,
      callsign,
      hullNumber,
      imageUrl: args.imageUrl?.trim().slice(0, 500) || undefined,
      awardedAt,
      awardedBy: me,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "fighter.claim",
      target: `starfighter:${id}`,
      meta: JSON.stringify({ hullNumber, callsign, vesselKey: args.vesselKey }),
      createdAt: awardedAt,
    });
    return { id, hullNumber, callsign };
  },
});

// ---------------------------------------------------------------------------
// Operator grant — mint a fighter directly for a member (replaces the
// registry-assign ceremony step when the Bridge awards wings its own way).
// ---------------------------------------------------------------------------

export const grantFighter = mutation({
  args: {
    memberId: v.id("users"),
    vesselKey: v.string(),
    designation: v.string(),
    shipClass: v.optional(v.string()),
    callsign: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const user = await ctx.db.get(args.memberId);
    if (!user) throw new Error("Member not found.");
    const callsign = normalizeCallsign(args.callsign);
    if (callsign.length < 2) throw new Error("Callsign must be at least 2 characters.");
    if (await hasFighter(ctx, args.memberId)) {
      throw new Error("That member already holds a fighter.");
    }
    const hullNumber = await nextHullNumber(ctx);
    const id = await ctx.db.insert("starfighters", {
      memberId: args.memberId,
      vesselKey: args.vesselKey.trim().slice(0, 64),
      designation: args.designation.trim().slice(0, 120),
      shipClass: args.shipClass?.trim().slice(0, 120) || undefined,
      callsign,
      hullNumber,
      imageUrl: args.imageUrl?.trim().slice(0, 500) || undefined,
      awardedAt: Date.now(),
      awardedBy: me,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "fighter.grant",
      target: `starfighter:${id}`,
      meta: JSON.stringify({ member: args.memberId, hullNumber, callsign }),
      createdAt: Date.now(),
    });
    return { id, hullNumber, callsign };
  },
});

// ---------------------------------------------------------------------------
// Wall of Honor — flat, text-focused. No avatars.
// ---------------------------------------------------------------------------

export const honorWall = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("starfighters")
      .withIndex("by_awarded")
      .order("desc")
      .take(500);
    const users = await Promise.all(rows.map((r) => ctx.db.get(r.memberId)));
    const byId = new Map(users.filter(Boolean).map((u) => [u!._id, u!]));
    return rows.map((r) => {
      const u = byId.get(r.memberId);
      return {
        _id: r._id,
        memberName: u?.displayName ?? u?.name ?? "Pilot",
        memberRank: u?.rank ?? null,
        memberId: r.memberId,
        vesselKey: r.vesselKey,
        designation: r.designation,
        shipClass: r.shipClass ?? null,
        callsign: r.callsign,
        hullNumber: r.hullNumber,
        awardedAt: r.awardedAt,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// My fighter — dossier surface.
// ---------------------------------------------------------------------------

export const getMyFighter = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const row = await ctx.db
      .query("starfighters")
      .withIndex("by_member", (q) => q.eq("memberId", me))
      .first();
    if (!row) return null;
    return { ...row, memberName: null as string | null };
  },
});

export const getMemberFighter = query({
  args: { memberId: v.id("users") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("starfighters")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .first();
    if (!row) return null;
    const u = await ctx.db.get(args.memberId);
    return {
      ...row,
      memberName: u?.displayName ?? u?.name ?? "Pilot",
      pilotRank: u?.rank ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Per-type dossier images (operator). One row per registry vessel key; the
// public read resolves the storage URL.
// ---------------------------------------------------------------------------

export const setTypeImage = mutation({
  args: {
    vesselKey: v.string(),
    imageStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const vesselKey = args.vesselKey.trim().slice(0, 64);
    if (!vesselKey) throw new Error("Vessel key required.");
    const existing = await ctx.db
      .query("fighterTypes")
      .withIndex("by_vessel", (q) => q.eq("vesselKey", vesselKey))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        imageStorageId: args.imageStorageId,
        updatedAt: Date.now(),
        updatedBy: me,
      });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("fighterTypes", {
      vesselKey,
      imageStorageId: args.imageStorageId,
      updatedAt: Date.now(),
      updatedBy: me,
    });
    return { id };
  },
});

export const getTypeImageUrls = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("fighterTypes").collect();
    const out: Record<string, string | null> = {};
    await Promise.all(
      rows.map(async (r) => {
        out[r.vesselKey] = r.imageStorageId
          ? await ctx.storage.getUrl(r.imageStorageId)
          : null;
      }),
    );
    return out;
  },
});
