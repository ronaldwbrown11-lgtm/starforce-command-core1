import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
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

/**
 * The shared write shape for `upsert` and `syncFromRegistry`. Fields are
 * normalized (trimmed, cleared when absent) so a reseed mirrors the fleet
 * database instead of leaving stale values behind on the patched row.
 */
type VesselPayload = Pick<
  Doc<"vessels">,
  "designation" | "name" | "badge" | "role"
> &
  Partial<
    Omit<
      Doc<"vessels">,
      "_id" | "_creationTime" | "createdAt" | "updatedAt" | "designation" | "name" | "badge" | "role"
    >
  >;

function buildVesselData(args: VesselPayload): VesselPayload {
  return {
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
  };
}

/** Create or update a vessel (operator only). */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("vessels")),
    ...vesselFields,
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator", "story_editor"]);
    const now = Date.now();
    const data = buildVesselData(args);
    if (args.id) {
      await ctx.db.patch(args.id, { ...data, updatedAt: now });
      return args.id;
    }
    return await ctx.db.insert("vessels", { ...data, createdAt: now, updatedAt: now });
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
        ...buildVesselData(v),
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
    return { created, skipped };
  },
});

/**
 * Reseed the console's vessel list from the live fleet database.
 *
 * The browser pulls `GET https://fleetregistry.starforcebase1198.com/api/vessels`
 * (open CORS — same direct-read pattern as src/lib/fleetRegistry.ts) and posts
 * the normalized rows here. Rows are matched by **registry number** first, so a
 * hull renamed in the database updates in place, then by designation; rows the
 * database no longer carries are removed. That is what makes the console's
 * "Seed vessels" button a true reseed instead of an insert-only first-run
 * import of a hard-coded list.
 */
async function applySync(ctx: MutationCtx, args: { vessels: VesselPayload[] }) {
  if (args.vessels.length === 0) {
    // Fail closed: an empty payload would otherwise wipe the registry.
    throw new Error("The fleet database returned no vessels — nothing was reseeded.");
  }
  const now = Date.now();
  const existing = await ctx.db.query("vessels").collect();

  const byRegistry = new Map<string, Doc<"vessels">[]>();
  const byDesignation = new Map<string, Doc<"vessels">[]>();
  const addTo = (map: Map<string, Doc<"vessels">[]>, key: string, row: Doc<"vessels">) => {
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  };
  for (const row of existing) {
    const reg = (row.registry ?? "").trim().toLowerCase();
    if (reg) addTo(byRegistry, reg, row);
    const des = (row.designation ?? "").trim().toLowerCase();
    if (des) addTo(byDesignation, des, row);
  }

  // Each existing row can be claimed at most once, so two incoming rows can
  // never patch the same document.
  const claimed = new Set<Doc<"vessels">["_id"]>();
  const take = (registry?: string, designation?: string) => {
    const reg = registry?.trim().toLowerCase();
    if (reg) {
      const hit = byRegistry.get(reg)?.find((row) => !claimed.has(row._id));
      if (hit) {
        claimed.add(hit._id);
        return hit;
      }
    }
    const des = designation?.trim().toLowerCase();
    if (des) {
      const hit = byDesignation.get(des)?.find((row) => !claimed.has(row._id));
      if (hit) {
        claimed.add(hit._id);
        return hit;
      }
    }
    return null;
  };

  let updated = 0;
  let created = 0;
  const seen = new Set<string>();
  for (const incoming of args.vessels) {
    const key = incoming.designation.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const data = buildVesselData(incoming);
    const match = take(incoming.registry, incoming.designation);
    if (match) {
      await ctx.db.patch(match._id, { ...data, updatedAt: now });
      updated++;
    } else {
      await ctx.db.insert("vessels", { ...data, createdAt: now, updatedAt: now });
      created++;
    }
  }

  let removed = 0;
  for (const row of existing) {
    if (claimed.has(row._id)) continue;
    await ctx.db.delete(row._id);
    removed++;
  }

  return { updated, created, removed };
}

export const syncFromRegistry = mutation({
  args: {
    vessels: v.array(v.object(vesselFields)),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    return await applySync(ctx, args);
  },
});
