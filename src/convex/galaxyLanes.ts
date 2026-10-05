import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
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

// Endpoints are plain strings so warp gates can connect every level of
// the atlas — quadrant / sector / star system doc ids — as well as stars (catalog
// ids `hyg-*` and saved lore star ids).
const endpoint = v.string();

// A MutationCtx db is structurally a superset of QueryCtx db.
type Db = QueryCtx["db"];

/** Structural view of an atlas endpoint document (quadrant / sector / system). */
interface EndpointDoc {
  sectorId?: Id<"sectors">;
  quadrantId?: Id<"quadrants">;
}

/** A gate endpoint is valid when it is a catalog star, an existing atlas
 *  entity (quadrant / sector / star system), or a saved lore star. */
async function resolveEndpoint(db: Db, ref: string): Promise<boolean> {
  if (ref.startsWith("hyg-")) return true; // fixed catalog star
  let doc: EndpointDoc | null = null;
  try {
    doc = ((await db.get(ref as Id<"quadrants">)) ?? null) as EndpointDoc | null;
  } catch {
    doc = null; // not a document id — treat as a star id
  }
  if (doc) {
    // Parent deletions can leave grandchildren temporarily inaccessible.
    if (doc.sectorId && !(await db.get(doc.sectorId))) return false;
    if (doc.quadrantId && !(await db.get(doc.quadrantId))) return false;
    return true;
  }
  const lore = await db
    .query("starLore")
    .filter((q) => q.eq(q.field("starId"), ref))
    .first();
  return lore !== null;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Shared canon atlas — every visitor sees the transferred lanes.
    const lanes = await ctx.db.query("galaxyLanes").collect();
    const valid = await Promise.all(
      lanes.map(async (lane) => {
        const ok =
          (await resolveEndpoint(ctx.db, lane.fromId)) &&
          (await resolveEndpoint(ctx.db, lane.toId));
        if (!ok) return null;
        return {
          id: lane._id,
          name: lane.name,
          color: lane.color,
          fromId: lane.fromId,
          toId: lane.toId,
          customColor: lane.customColor,
        };
      }),
    );
    return valid.filter((lane) => lane !== null);
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("galaxyLanes")),
    name: v.string(),
    color: v.string(),
    fromId: endpoint,
    toId: endpoint,
    customColor: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    if (!args.name.trim() || args.name.length > 120)
      throw new Error("Lane name must be 1–120 characters");
    if (!/^#[0-9a-f]{6}$/i.test(args.color)) throw new Error("Invalid color");
    if (args.fromId === args.toId) throw new Error("Choose different endpoints");
    const ok =
      (await resolveEndpoint(ctx.db, args.fromId)) &&
      (await resolveEndpoint(ctx.db, args.toId));
    if (!ok) throw new Error("Endpoint not found");
    const { id, ...draft } = args;
    if (id) {
      const lane = await ctx.db.get(id);
      if (!lane) throw new Error("Lane not found");
      await ctx.db.patch(id, { ...draft, name: draft.name.trim() });
      return id;
    }
    return ctx.db.insert("galaxyLanes", { userId, ...draft, name: draft.name.trim() });
  },
});

export const remove = mutation({
  args: { id: v.id("galaxyLanes") },
  handler: async (ctx, { id }) => {
    await requireOperatorCapability(ctx, ATLAS_OPERATOR_CAPS);
    const lane = await ctx.db.get(id);
    if (!lane) throw new Error("Lane not found");
    await ctx.db.delete(id);
  },
});
