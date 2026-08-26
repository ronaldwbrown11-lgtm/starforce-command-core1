import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";

// ---- Public queries -------------------------------------------------------

/** List all vessels, grouped by badge/category. */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vessels").order("asc").collect();
  },
});

/** Vessel stats for the registry landing page. */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("vessels").collect();
    return {
      total: all.length,
      byBadge: all.reduce((acc, v) => {
        const b = v.badge ?? "Unknown";
        acc[b] = (acc[b] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
});

/** Search vessels by designation, name, role, or class. */
export const search = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("vessels").collect();
    const q = args.q.toLowerCase();
    return all.filter(
      (v) =>
        v.designation.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.role.toLowerCase().includes(q) ||
        (v.shipClass ?? "").toLowerCase().includes(q) ||
        (v.badge ?? "").toLowerCase().includes(q) ||
        (v.registry ?? "").toLowerCase().includes(q),
    );
  },
});

// ---- Operator mutations ---------------------------------------------------

/** Vessel field schema for upsert/seed — all new rich fields included. */
const vesselFields = {
  designation: v.string(),
  name: v.string(),
  badge: v.string(),
  shipClass: v.optional(v.string()),
  registry: v.optional(v.string()),
  role: v.string(),
  crew: v.optional(v.string()),
  armament: v.optional(v.string()),
  notes: v.optional(v.string()),
  hullLength: v.optional(v.string()),
  hullWidth: v.optional(v.string()),
  decks: v.optional(v.string()),
  weight: v.optional(v.string()),
  acceleration: v.optional(v.string()),
  status: v.optional(v.string()),
  builder: v.optional(v.string()),
  fleet: v.optional(v.string()),
  commissionDate: v.optional(v.string()),
  armor: v.optional(v.string()),
  propulsion: v.optional(v.string()),
  capabilities: v.optional(v.string()),
  maneuverability: v.optional(v.string()),
  computer: v.optional(v.string()),
  primaryArmament: v.optional(v.string()),
  secondaryArmament: v.optional(v.string()),
  defensiveSystems: v.optional(v.string()),
  variants: v.optional(v.string()),
  classified: v.optional(v.boolean()),
  topDownImg: v.optional(v.string()),
  sideProfileImg: v.optional(v.string()),
};

/** Create or update a vessel (operator only). */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("vessels")),
    ...vesselFields,
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    const now = Date.now();
    const data: Record<string, unknown> = {
      designation: args.designation.trim(),
      name: args.name.trim(),
      badge: args.badge.trim(),
      shipClass: args.shipClass?.trim() || undefined,
      registry: args.registry?.trim() || undefined,
      role: args.role.trim(),
      crew: args.crew?.trim() || undefined,
      armament: args.armament?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      hullLength: args.hullLength?.trim() || undefined,
      hullWidth: args.hullWidth?.trim() || undefined,
      decks: args.decks?.trim() || undefined,
      weight: args.weight?.trim() || undefined,
      acceleration: args.acceleration?.trim() || undefined,
      status: args.status || "active",
      builder: args.builder?.trim() || undefined,
      fleet: args.fleet?.trim() || undefined,
      commissionDate: args.commissionDate?.trim() || undefined,
      armor: args.armor?.trim() || undefined,
      propulsion: args.propulsion?.trim() || undefined,
      capabilities: args.capabilities?.trim() || undefined,
      maneuverability: args.maneuverability?.trim() || undefined,
      computer: args.computer?.trim() || undefined,
      primaryArmament: args.primaryArmament?.trim() || undefined,
      secondaryArmament: args.secondaryArmament?.trim() || undefined,
      defensiveSystems: args.defensiveSystems?.trim() || undefined,
      variants: args.variants?.trim() || undefined,
      classified: args.classified ?? false,
      topDownImg: args.topDownImg?.trim() || undefined,
      sideProfileImg: args.sideProfileImg?.trim() || undefined,
      updatedAt: now,
    };
    if (args.id) {
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return await ctx.db.insert("vessels", { ...data, createdAt: now } as any);
  },
});

/** Delete a vessel (operator only). */
export const remove = mutation({
  args: { id: v.id("vessels") },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    await ctx.db.delete(args.id);
  },
});

/** Bulk seed vessels (operator only, idempotent on designation). */
export const seed = mutation({
  args: {
    vessels: v.array(v.object(vesselFields)),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    const now = Date.now();
    let created = 0;
    let skipped = 0;
    for (const v of args.vessels) {
      const existing = await ctx.db
        .query("vessels")
        .withIndex("by_designation", (q) => q.eq("designation", v.designation))
        .first();
      if (existing) { skipped++; continue; }
      await ctx.db.insert("vessels", {
        ...v,
        status: v.status || "active",
        classified: v.classified ?? false,
        createdAt: now,
        updatedAt: now,
      } as any);
      created++;
    }
    return { created, skipped };
  },
});
