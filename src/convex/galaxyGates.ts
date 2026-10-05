import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOperatorCapability } from "./admin";

// Operator capabilities allowed to edit the shared canon Star Atlas
// (transferred from the Ultra Force project; writes are operator-gated,
// reads are public — see galaxyMap.ts).
const ATLAS_OPERATOR_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

// ---------------------------------------------------------------------------
// Warp gate nodes — quadrant hubs on the galaxy level (exactly one per
// quadrant, so four on the default atlas) plus unlimited gates at the
// quadrant, sector, and system levels. Lanes in galaxyLanes can attach to any
// gate id, so gates become the anchor points of the gate network.
// ---------------------------------------------------------------------------

const levelArg = v.union(
  v.literal("galaxy"),
  v.literal("quadrant"),
  v.literal("sector"),
  v.literal("system"),
);

const toPos = (doc: { posX: number; posY: number; posZ: number }): [number, number, number] => [
  doc.posX,
  doc.posY,
  doc.posZ,
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Shared canon atlas — every visitor sees the transferred gate network.
    const gates = await ctx.db.query("galaxyGates").collect();
    return gates
      .map((g) => ({
        id: g._id,
        name: g.name,
        description: g.description ?? "",
        color: g.color,
        level: g.level,
        quadrantId: g.quadrantId,
        sectorId: g.sectorId,
        systemId: g.systemId,
        pos: toPos(g),
        order: g.order,
      }))
      .sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    level: levelArg,
    quadrantId: v.optional(v.id("quadrants")),
    sectorId: v.optional(v.id("sectors")),
    systemId: v.optional(v.id("starSystems")),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    posX: v.number(),
    posY: v.number(),
    posZ: v.number(),
  },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    if (!args.name.trim() || args.name.length > 120)
      throw new Error("Gate name must be 1–120 characters");
    if (!/^#[0-9a-f]{6}$/i.test(args.color)) throw new Error("Use a six-digit hex color");
    if (![args.posX, args.posY, args.posZ].every(Number.isFinite))
      throw new Error("Gate values must be finite");
    if (Math.max(Math.abs(args.posX), Math.abs(args.posY), Math.abs(args.posZ)) > 100)
      throw new Error("Coordinates must be within ±100 map units");

    // The gate must live inside an existing atlas entity (shared canon map).
    let quadrantId = args.quadrantId;
    let sectorId = args.sectorId;
    let systemId = args.systemId;
    if (args.level === "galaxy" || args.level === "quadrant") {
      if (!quadrantId) throw new Error("This gate needs a quadrant");
      const quad = await ctx.db.get(quadrantId);
      if (!quad) throw new Error("Quadrant not found");
      sectorId = undefined;
      systemId = undefined;
    } else if (args.level === "sector") {
      if (!sectorId) throw new Error("This gate needs a sector");
      const sector = await ctx.db.get(sectorId);
      if (!sector) throw new Error("Sector not found");
      quadrantId = undefined;
      systemId = undefined;
    } else {
      if (!systemId) throw new Error("This gate needs a star system");
      const system = await ctx.db.get(systemId);
      if (!system) throw new Error("Star system not found");
      quadrantId = undefined;
      sectorId = undefined;
    }

    // Galaxy-level hubs are capped at exactly one per quadrant (four hubs on
    // the default atlas). Finer levels are unlimited.
    if (args.level === "galaxy") {
      const gates = await ctx.db.query("galaxyGates").collect();
      if (gates.some((g) => g.level === "galaxy" && g.quadrantId === quadrantId))
        throw new Error("That quadrant already has its hub");
    }

    const existing = await ctx.db.query("galaxyGates").collect();
    await ctx.db.insert("galaxyGates", {
      userId,
      level: args.level,
      quadrantId,
      sectorId,
      systemId,
      name: args.name.trim(),
      description: args.description,
      color: args.color,
      posX: args.posX,
      posY: args.posY,
      posZ: args.posZ,
      order: existing.length,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("galaxyGates"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_OPERATOR_CAPS);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    if (!args.name.trim() || args.name.length > 120)
      throw new Error("Gate name must be 1–120 characters");
    if (!/^#[0-9a-f]{6}$/i.test(args.color)) throw new Error("Use a six-digit hex color");
    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      description: args.description,
      color: args.color,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("galaxyGates") },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ATLAS_OPERATOR_CAPS);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
