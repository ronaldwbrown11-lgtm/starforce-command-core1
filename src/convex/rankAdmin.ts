import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";
import {
  ADMIRAL_SEAT_CAP,
  FLAG_OFFICER_MIN_XP,
  RANK_LADDER,
  isRankKey,
  rankForXp,
  rankSpec,
} from "../lib/ranks";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Rank Ladder console (operator backend)
//
//   - Inspect the ladder with live holder counts and seat stats
//   - Attach an insignia IMAGE to any rank (canonical or operator-created)
//   - Create new rank records for future commissions
//   - PROMOTE/MOVE members manually — members can never set their own rank
//
// All mutations are capability-gated (operator / senior_operator) and
// audit-logged. Canonical ladder thresholds are doctrine enforced by the
// progression engine (src/lib/ranks.ts) — label, blurb, and image are the
// operator-editable presentation layer; custom ranks are manual-assignment
// only (the XP evaluator never awards them).
// =========================================================================

const MANAGE_CAPS = ["operator", "senior_operator"];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// All row helpers here run inside mutations (queries only read).
type Ctx = MutationCtx;

async function rankRowFor(ctx: Ctx, key: string) {
  return await ctx.db
    .query("ranks")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** Return the row id for a canonical rank, seeding the catalog row on demand. */
async function ensureCanonicalRow(ctx: Ctx, key: string): Promise<Id<"ranks">> {
  const existing = await rankRowFor(ctx, key);
  if (existing) return existing._id;
  if (!isRankKey(key)) throw new Error("Unknown rank — create it first.");
  const spec = rankSpec(key);
  return await ctx.db.insert("ranks", {
    key: spec.key,
    label: spec.label,
    tier: spec.tier,
    order: RANK_LADDER.findIndex((r) => r.key === spec.key),
    minXp: spec.minXp,
    flagOfficer: spec.flagOfficer,
    maxActiveSeats: spec.flagOfficer ? ADMIRAL_SEAT_CAP : undefined,
    blurb: spec.blurb,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Overview — the ladder with holder counts, images, and seat stats
// ---------------------------------------------------------------------------

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, MANAGE_CAPS);
    const [rows, users, queueRows] = await Promise.all([
      ctx.db.query("ranks").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("admiralQueue").collect(),
    ]);

    const counts: Record<string, number> = {};
    let totalMembers = 0;
    for (const u of users) {
      if (u.isAnonymous) continue;
      totalMembers++;
      const key = u.rankKey ?? rankForXp(u.xp ?? 0);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const rowByKey = new Map(rows.map((r) => [r.key, r]));

    const canonical = RANK_LADDER.map((r, i) => {
      const row = rowByKey.get(r.key);
      return {
        key: r.key,
        label: row?.label ?? r.label,
        tier: row?.tier ?? r.tier,
        order: i,
        minXp: r.minXp,
        flagOfficer: r.flagOfficer,
        blurb: row?.blurb ?? r.blurb,
        imageStorageId: (row?.imageStorageId ?? null) as Id<"_storage"> | null,
        canonical: true as const,
        holderCount: counts[r.key] ?? 0,
      };
    });
    const custom = rows
      .filter((r) => !isRankKey(r.key))
      .sort((a, b) => a.tier - b.tier || a.order - b.order)
      .map((row) => ({
        key: row.key,
        label: row.label,
        tier: row.tier,
        order: row.order,
        minXp: row.minXp,
        flagOfficer: row.flagOfficer,
        blurb: row.blurb,
        imageStorageId: (row.imageStorageId ?? null) as Id<"_storage"> | null,
        canonical: false as const,
        holderCount: counts[row.key] ?? 0,
      }));

    return {
      ranks: [...canonical, ...custom],
      activeSeats: queueRows.filter((r) => r.status === "active").length,
      seatCap: ADMIRAL_SEAT_CAP,
      waiting: queueRows.filter((r) => r.status === "waiting").length,
      inactiveFlagOfficers: queueRows.filter(
        (r) => r.status === "inactive_flag_officer",
      ).length,
      totalMembers,
    };
  },
});

// ---------------------------------------------------------------------------
// Member search — powers the manual promotion picker
// ---------------------------------------------------------------------------

export const searchMembers = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, MANAGE_CAPS);
    const needle = args.q.trim().toLowerCase();
    if (!needle) return [];
    const users = await ctx.db.query("users").collect();
    const hits: Array<{
      id: Id<"users">;
      name: string;
      email: string | null;
      xp: number;
      rankKey: string | null;
      rankLabel: string;
      tier: string;
    }> = [];
    for (const u of users) {
      if (u.isAnonymous) continue;
      const name = (u.displayName ?? u.name ?? "").toLowerCase();
      const email = (u.email ?? "").toLowerCase();
      if (!name.includes(needle) && !email.includes(needle)) continue;
      const key = u.rankKey ?? rankForXp(u.xp ?? 0);
      const label = isRankKey(key)
        ? rankSpec(key).label
        : (u.rank ?? key);
      hits.push({
        id: u._id,
        name: u.displayName ?? u.name ?? u.email ?? "Unknown",
        email: u.email ?? null,
        xp: u.xp ?? 0,
        rankKey: u.rankKey ?? null,
        rankLabel: label,
        tier: u.tier ?? "free",
      });
      if (hits.length >= 15) break;
    }
    return hits;
  },
});

// ---------------------------------------------------------------------------
// Rank imagery + creation/updates
// ---------------------------------------------------------------------------

/**
 * Attach (or clear) the insignia image for a rank. The image is uploaded
 * through assets.generateUploadUrl first; pass `null` to remove it.
 */
export const setRankImage = mutation({
  args: {
    rankKey: v.string(),
    imageStorageId: v.union(v.id("_storage"), v.null()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, MANAGE_CAPS);
    const rowId = await ensureCanonicalRow(ctx, args.rankKey);
    const row = await ctx.db.get(rowId);
    if (!row) throw new Error("Rank not found.");

    const previous = row.imageStorageId;
    await ctx.db.patch(rowId, {
      imageStorageId: args.imageStorageId ?? undefined,
    });
    if (previous && previous !== args.imageStorageId) {
      try {
        await ctx.storage.delete(previous);
      } catch {
        // Best-effort: the row no longer references the old asset.
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "rank.image_set",
      target: `rank:${args.rankKey}`,
      meta: JSON.stringify({ removed: args.imageStorageId === null }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Create a NEW rank record — for future commissions (custom tiers, brevet
 * ranks, ceremonial awards). Attach an image at creation by uploading it
 * through assets.generateUploadUrl and passing the storage id. Custom ranks
 * are assigned manually (setMemberRank); the XP ladder never awards them.
 */
export const createRank = mutation({
  args: {
    label: v.string(),
    tier: v.number(),
    minXp: v.number(),
    blurb: v.optional(v.string()),
    key: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, MANAGE_CAPS);
    const label = args.label.trim();
    if (!label) throw new Error("Rank label required.");
    if (label.length > 40) throw new Error("Label must be 40 characters or fewer.");
    if (!Number.isFinite(args.tier) || args.tier < 1 || args.tier > 99) {
      throw new Error("Tier must be between 1 and 99.");
    }
    if (!Number.isFinite(args.minXp) || args.minXp < 0) {
      throw new Error("Minimum XP must be zero or more.");
    }
    const key = slugify(args.key ?? label);
    if (!key) throw new Error("Could not derive a rank key from that label.");
    if (isRankKey(key)) {
      throw new Error(
        "That key belongs to the canonical ladder — edit the rank row instead.",
      );
    }
    if (await rankRowFor(ctx, key)) {
      throw new Error("A rank with that key already exists.");
    }

    const existing = await ctx.db.query("ranks").collect();
    const maxOrder = existing.reduce((m, r) => Math.max(m, r.order), -1);
    await ctx.db.insert("ranks", {
      key,
      label,
      tier: args.tier,
      order: maxOrder + 1,
      minXp: args.minXp,
      flagOfficer: false,
      blurb: (args.blurb ?? "").trim().slice(0, 200),
      imageStorageId: args.imageStorageId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "rank.create",
      target: `rank:${key}`,
      meta: JSON.stringify({ label, tier: args.tier, minXp: args.minXp }),
      createdAt: Date.now(),
    });
    return { ok: true, key };
  },
});

/**
 * Update a rank's presentation (label / blurb). Canonical ladder thresholds
 * (tier, min XP) are doctrine enforced by the progression engine, so they
 * are not editable here — custom ranks can be fully re-tuned.
 */
export const updateRank = mutation({
  args: {
    key: v.string(),
    label: v.optional(v.string()),
    blurb: v.optional(v.string()),
    tier: v.optional(v.number()),
    minXp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, MANAGE_CAPS);
    const rowId = await ensureCanonicalRow(ctx, args.key);
    const row = await ctx.db.get(rowId);
    if (!row) throw new Error("Rank not found.");

    const patch: {
      label?: string;
      blurb?: string;
      tier?: number;
      minXp?: number;
    } = {};
    if (args.label !== undefined) {
      const label = args.label.trim();
      if (!label) throw new Error("Label cannot be empty.");
      if (label.length > 40) throw new Error("Label must be 40 characters or fewer.");
      patch.label = label;
    }
    if (args.blurb !== undefined) patch.blurb = args.blurb.trim().slice(0, 200);

    if (!isRankKey(args.key)) {
      // Custom ranks are fully editable.
      if (args.tier !== undefined) {
        if (args.tier < 1 || args.tier > 99) throw new Error("Tier must be 1–99.");
        patch.tier = args.tier;
      }
      if (args.minXp !== undefined) {
        if (args.minXp < 0) throw new Error("Minimum XP must be zero or more.");
        patch.minXp = args.minXp;
      }
    } else if (args.tier !== undefined || args.minXp !== undefined) {
      throw new Error(
        "Canonical ladder thresholds are doctrine — enforced by the progression engine and not editable.",
      );
    }

    if (Object.keys(patch).length) await ctx.db.patch(rowId, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "rank.update",
      target: `rank:${args.key}`,
      meta: JSON.stringify(patch),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Manual promotion — set any member's commission (members can't do this)
// ---------------------------------------------------------------------------

export const setMemberRank = mutation({
  args: {
    userId: v.id("users"),
    rankKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, MANAGE_CAPS);
    const targetRow = await rankRowFor(ctx, args.rankKey);
    if (!targetRow && !isRankKey(args.rankKey)) {
      throw new Error("Unknown rank — create it in the Rank Ladder first.");
    }
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Member not found.");

    const label =
      targetRow?.label ??
      (isRankKey(args.rankKey) ? rankSpec(args.rankKey).label : args.rankKey);
    const currentKey = user.rankKey ?? null;
    if (currentKey === args.rankKey) {
      return { ok: true, unchanged: true, rankKey: args.rankKey, label };
    }

    const now = Date.now();
    const totalXp = user.xp ?? 0;
    const patch: { rankKey: string; rank: string; prestigeXp?: number } = {
      rankKey: args.rankKey,
      rank: label,
    };
    if (totalXp > FLAG_OFFICER_MIN_XP) {
      patch.prestigeXp = totalXp - FLAG_OFFICER_MIN_XP;
    }
    await ctx.db.patch(args.userId, patch);

    // Seat bookkeeping -------------------------------------------------------
    const queueRow = await ctx.db
      .query("admiralQueue")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (args.rankKey === "rear_admiral") {
      if (queueRow?.status !== "active") {
        const activeRows = await ctx.db
          .query("admiralQueue")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .collect();
        const others = activeRows.filter((r) => r.userId !== args.userId).length;
        if (others >= ADMIRAL_SEAT_CAP) {
          throw new Error(
            `All ${ADMIRAL_SEAT_CAP} active Rear Admiral seats are occupied — demote one first to free a seat.`,
          );
        }
        if (queueRow) {
          await ctx.db.patch(queueRow._id, {
            status: "active",
            totalXp,
            seatGrantedAt: queueRow.seatGrantedAt ?? now,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("admiralQueue", {
            userId: args.userId,
            status: "active",
            totalXp,
            joinedAt: now,
            seatGrantedAt: now,
            lastXpAt: user.lastXpAt ?? now,
            updatedAt: now,
          });
        }
      }
    } else if (queueRow) {
      // Leaving the flag seat (or moving off the ladder entirely).
      if (queueRow.status === "active" || totalXp < FLAG_OFFICER_MIN_XP) {
        if (totalXp >= FLAG_OFFICER_MIN_XP) {
          await ctx.db.patch(queueRow._id, {
            status: "waiting",
            seatRevokedAt: now,
            updatedAt: now,
          });
        } else {
          await ctx.db.delete(queueRow._id);
        }
      }
    }

    // Notification + feed + audit ------------------------------------------
    const currentLabel = isRankKey(currentKey ?? "")
      ? rankSpec(currentKey!).label
      : (user.rank ?? "Unassigned");
    await ctx.db.insert("notifications", {
      userId: args.userId,
      kind: "rank",
      title: `Commission updated — ${label}`,
      body: `High Command set your rank from ${currentLabel} to ${label}.`,
      url: "/high-command",
      createdAt: now,
    });
    await ctx.db.insert("activityFeed", {
      actorId: args.userId,
      verb: "completed",
      targetType: "rank",
      targetId: args.rankKey,
      url: "/high-command",
      summary: `commissioned as ${label} by High Command`,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "rank.manual_set",
      target: `user:${args.userId}`,
      meta: JSON.stringify({ from: currentKey, to: args.rankKey, by: me }),
      createdAt: now,
    });

    return { ok: true, rankKey: args.rankKey, label };
  },
});
