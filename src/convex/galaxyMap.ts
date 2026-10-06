import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOperatorCapability } from "./admin";

// Operator capabilities allowed to edit the shared canon Star Atlas
// (same caps as the Canon Image Library workflow in visuals.ts).
const ATLAS_OPERATOR_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

const nameArgs = {
  name: v.string(),
  description: v.optional(v.string()),
  color: v.string(),
};

// Optional explicit galaxy-local placement (set when the user creates or
// moves an entity by clicking a spot on the map).
const positionArgs = {
  posX: v.optional(v.number()),
  posY: v.optional(v.number()),
  posZ: v.optional(v.number()),
};

const toPos = (doc: {
  posX?: number;
  posY?: number;
  posZ?: number;
}): [number, number, number] | undefined =>
  doc.posX !== undefined && doc.posY !== undefined && doc.posZ !== undefined
    ? [doc.posX, doc.posY, doc.posZ]
    : undefined;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Shared canon atlas — every visitor (signed in or not) sees the
    // transferred galaxy.
    const [quadrants, sectors, systems] = await Promise.all([
      ctx.db.query("quadrants").collect(),
      ctx.db.query("sectors").collect(),
      ctx.db.query("starSystems").collect(),
    ]);

    return {
      // True once the canon starter atlas exists. Console-mirrored quadrants
      // (sourceKey `console:`) don't count, so publishing console sectors
      // never suppresses the Milky Way seed.
      seeded: quadrants.some((q) => q.sourceKey === undefined),
      quadrants: quadrants
        .map((q) => ({
          id: q._id,
          name: q.name,
          description: q.description ?? "",
          color: q.color,
          order: q.order,
        }))
        .sort((a, b) => a.order - b.order),
      sectors: sectors
        .map((s) => ({
          id: s._id,
          quadrantId: s.quadrantId,
          name: s.name,
          description: s.description ?? "",
          color: s.color,
          order: s.order,
          pos: toPos(s),
        }))
        .sort((a, b) => a.order - b.order),
      systems: systems
        .map((s) => ({
          id: s._id,
          sectorId: s.sectorId,
          name: s.name,
          description: s.description ?? "",
          color: s.color,
          order: s.order,
          pos: toPos(s),
          starId: s.starId,
        }))
        .sort((a, b) => a.order - b.order),
    };
  },
});

// ---------------------------------------------------------------------------
// Quadrants
// ---------------------------------------------------------------------------

export const createQuadrant = mutation({
  args: nameArgs,
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const existing = await ctx.db.query("quadrants").collect();
    await ctx.db.insert("quadrants", {
      userId,
      ...args,
      order: existing.length,
    });
  },
});

export const updateQuadrant = mutation({
  args: { id: v.id("quadrants"), ...nameArgs },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    await ctx.db.patch(args.id, {
      name: args.name,
      description: args.description,
      color: args.color,
    });
  },
});

export const deleteQuadrant = mutation({
  args: { id: v.id("quadrants") },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");

    // Cascade: delete sectors, their star systems, and any warp gates that
    // hang off the quadrant, its sectors, or its systems.
    const sectors = await ctx.db
      .query("sectors")
      .filter((q) => q.eq(q.field("quadrantId"), args.id))
      .collect();
    const doomedSectorIds = new Set(sectors.map((s) => s._id));
    const doomedSystemIds = new Set<string>();
    for (const sector of sectors) {
      const systems = await ctx.db
        .query("starSystems")
        .filter((q) => q.eq(q.field("sectorId"), sector._id))
        .collect();
      for (const system of systems) {
        doomedSystemIds.add(system._id);
        await ctx.db.delete(system._id);
      }
      await ctx.db.delete(sector._id);
    }
    const quadGates = await ctx.db.query("galaxyGates").collect();
    for (const gate of quadGates) {
      if (
        gate.quadrantId === args.id ||
        (gate.sectorId !== undefined && doomedSectorIds.has(gate.sectorId)) ||
        (gate.systemId !== undefined && doomedSystemIds.has(gate.systemId))
      )
        await ctx.db.delete(gate._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ---------------------------------------------------------------------------
// Sectors
// ---------------------------------------------------------------------------

export const createSector = mutation({
  args: { quadrantId: v.id("quadrants"), ...nameArgs, ...positionArgs },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const quad = await ctx.db.get(args.quadrantId);
    if (!quad) throw new Error("Not found");
    const existing = await ctx.db
      .query("sectors")
      .filter((q) => q.eq(q.field("quadrantId"), args.quadrantId))
      .collect();
    await ctx.db.insert("sectors", {
      userId,
      quadrantId: args.quadrantId,
      name: args.name,
      description: args.description,
      color: args.color,
      order: existing.length,
      posX: args.posX,
      posY: args.posY,
      posZ: args.posZ,
    });
  },
});

export const updateSector = mutation({
  args: { id: v.id("sectors"), ...nameArgs, ...positionArgs },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    const patch: Record<string, unknown> = {
      name: args.name,
      description: args.description,
      color: args.color,
    };
    // Only touch the position when one is supplied — patching undefined
    // would delete a stored placement.
    if (args.posX !== undefined) patch.posX = args.posX;
    if (args.posY !== undefined) patch.posY = args.posY;
    if (args.posZ !== undefined) patch.posZ = args.posZ;
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteSector = mutation({
  args: { id: v.id("sectors") },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");

    const systems = await ctx.db
      .query("starSystems")
      .filter((q) => q.eq(q.field("sectorId"), args.id))
      .collect();
    const doomedSystems = new Set<string>(systems.map((s) => s._id));
    for (const system of systems) await ctx.db.delete(system._id);
    // Cascade: warp gates hanging off this sector or its systems.
    const gates = await ctx.db.query("galaxyGates").collect();
    for (const gate of gates) {
      if (
        gate.sectorId === args.id ||
        (gate.systemId !== undefined && doomedSystems.has(gate.systemId))
      )
        await ctx.db.delete(gate._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ---------------------------------------------------------------------------
// Star systems
// ---------------------------------------------------------------------------

export const createSystem = mutation({
  args: {
    sectorId: v.id("sectors"),
    ...nameArgs,
    ...positionArgs,
    /** Lore-list star this system stands for (set when auto-seeding a new
     *  lore star so the system sits on the star and links back to it). */
    starId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const sector = await ctx.db.get(args.sectorId);
    if (!sector) throw new Error("Not found");
    const existing = await ctx.db
      .query("starSystems")
      .filter((q) => q.eq(q.field("sectorId"), args.sectorId))
      .collect();
    await ctx.db.insert("starSystems", {
      userId,
      sectorId: args.sectorId,
      name: args.name,
      description: args.description,
      color: args.color,
      order: existing.length,
      posX: args.posX,
      posY: args.posY,
      posZ: args.posZ,
      starId: args.starId,
    });
  },
});

export const updateSystem = mutation({
  args: { id: v.id("starSystems"), ...nameArgs, ...positionArgs },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    const patch: Record<string, unknown> = {
      name: args.name,
      description: args.description,
      color: args.color,
    };
    // Only touch the position when one is supplied — patching undefined
    // would delete a stored placement (e.g. unpin the galactic throne).
    if (args.posX !== undefined) patch.posX = args.posX;
    if (args.posY !== undefined) patch.posY = args.posY;
    if (args.posZ !== undefined) patch.posZ = args.posZ;
    await ctx.db.patch(args.id, patch);
  },
});

export const deleteSystem = mutation({
  args: { id: v.id("starSystems") },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Not found");
    // Cascade: gates hanging off this system.
    const gates = await ctx.db.query("galaxyGates").collect();
    for (const gate of gates) {
      if (gate.systemId === args.id) await ctx.db.delete(gate._id);
    }
    await ctx.db.delete(args.id);
  },
});

// ---------------------------------------------------------------------------
// Seed — real Milky Way structure, only if the user has no quadrants yet
// ---------------------------------------------------------------------------

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );

    const user = await ctx.db.get(userId);
    if (user?.mapSeeded) return;

    // Only a canon (non-mirror) quadrant means the starter atlas exists;
    // console-mirrored sectors live in their own quadrant and must not stop
    // the Milky Way from seeding.
    const quadrants = await ctx.db.query("quadrants").collect();
    const existing = quadrants.find((q) => q.sourceKey === undefined);
    if (existing) {
      // Map exists from before the flag — mark it and don't re-seed.
      await ctx.db.patch(userId, { mapSeeded: true });
      return;
    }

    const seedData = [
      {
        name: "Sol Quadrant",
        description:
          "The home quadrant of humanity, spanned by the Orion Spur between the Sagittarius and Perseus arms.",
        color: "#38bdf8",
        sectors: [
          {
            name: "Orion Spur",
            description: "The local arm that carries Sol and its neighbors.",
            color: "#38bdf8",
            systems: [
              { name: "Sol System", description: "Earth — cradle of the Ultra Force archives.", color: "#facc15" },
              { name: "Alpha Centauri Gate", description: "Closest warp gate to Sol.", color: "#38bdf8" },
              { name: "Sirius Anchorage", description: "Brightest star in the night sky; a major relay.", color: "#7dd3fc" },
            ],
          },
          {
            name: "Sagittarius Arm",
            description: "The inner arm coiling toward the galactic heart.",
            color: "#2dd4bf",
            systems: [
              { name: "Sagittarius A* Throne", description: "The supermassive black hole at the galaxy's center.", color: "#facc15", pos: [0, 0, 0] as [number, number, number] },
              { name: "Antares Watch", description: "A red supergiant border outpost.", color: "#f87171" },
            ],
          },
        ],
      },
      {
        name: "Coreward Quadrant",
        description:
          "Ancient lanes spiral toward the galactic center, dense with old light and older secrets.",
        color: "#facc15",
        sectors: [
          {
            name: "Scutum-Centaurus Arm",
            description: "The galaxy's second major spiral arm.",
            color: "#facc15",
            systems: [
              { name: "Scutum Relay", description: "Fast-lane messenger station on the inner arm.", color: "#facc15" },
              { name: "Carina Gateway", description: "Hub of the coreward trade lanes.", color: "#fb923c" },
            ],
          },
          {
            name: "Galactic Bar",
            description: "The stellar bar feeding the core.",
            color: "#fb923c",
            systems: [
              { name: "Bar Crossing Hub", description: "Only safe crossing of the bar.", color: "#fb923c" },
              { name: "Bulge Citadel", description: "Oldest inhabited citadel in the galaxy.", color: "#facc15" },
            ],
          },
        ],
      },
      {
        name: "Rimward Quadrant",
        description:
          "The quiet outer reaches of the Milky Way, where the arms thin into the dark.",
        color: "#4ade80",
        sectors: [
          {
            name: "Perseus Arm",
            description: "The great outer arm, home of frontier colonies.",
            color: "#4ade80",
            systems: [
              { name: "Perseus Line", description: "The frontier defense line.", color: "#4ade80" },
              { name: "Vega Outpost", description: "Research outpost around a young bright star.", color: "#a7f3d0" },
            ],
          },
          {
            name: "Outer Arm",
            description: "The last sparse arm before intergalactic dark.",
            color: "#34d399",
            systems: [
              { name: "Far Rim Station", description: "Edge-of-galaxy listening post.", color: "#34d399" },
              { name: "Oort Sanctuary", description: "Frozen refuge at the sun's far doorstep.", color: "#7dd3fc" },
            ],
          },
        ],
      },
      {
        name: "Deep Field Quadrant",
        description:
          "Uncharted dark between the spiral arms — where the galaxy keeps its mysteries.",
        color: "#a78bfa",
        sectors: [
          {
            name: "Norma Arm",
            description: "A minor arm rich in nebulae and remnants.",
            color: "#a78bfa",
            systems: [
              { name: "Norma Deepgate", description: "Warp gate punching through the deep field.", color: "#a78bfa" },
              { name: "Beta Crucis Yard", description: "Shipyard in the cross of the southern sky.", color: "#c4b5fd" },
            ],
          },
          {
            name: "Halo Reach",
            description: "Ancient halo stars far above the galactic plane.",
            color: "#f472b6",
            systems: [
              { name: "Halo Beacon", description: "Navigation beacon among the oldest stars.", color: "#f472b6" },
              { name: "Omega Gate", description: "A gate to somewhere unnamed in the records.", color: "#f9a8d4" },
            ],
          },
        ],
      },
    ];

    let qOrder = 0;
    for (const q of seedData) {
      const quadrantId = await ctx.db.insert("quadrants", {
        userId,
        name: q.name,
        description: q.description,
        color: q.color,
        order: qOrder++,
      });
      let sOrder = 0;
      for (const s of q.sectors) {
        const sectorId = await ctx.db.insert("sectors", {
          userId,
          quadrantId,
          name: s.name,
          description: s.description,
          color: s.color,
          order: sOrder++,
        });
        let yOrder = 0;
        for (const sys of s.systems) {
          await ctx.db.insert("starSystems", {
            userId,
            sectorId,
            name: sys.name,
            description: sys.description,
            color: sys.color,
            order: yOrder++,
            posX: sys.pos?.[0],
            posY: sys.pos?.[1],
            posZ: sys.pos?.[2],
          });
        }
      }
    }

    // One-time tombstone: a user who later deletes every quadrant keeps a
    // clean slate instead of getting the starter map back on reload.
    await ctx.db.patch(userId, { mapSeeded: true });
  },
});

// Idempotent repair for maps seeded before explicit positions existed: pin
// Sagittarius A* Throne to the exact galactic center. Runs cheaply on load.
export const pinThroneToCenter = mutation({
  args: {},
  handler: async (ctx) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );
    const systems = await ctx.db.query("starSystems").collect();
    for (const sys of systems) {
      if (sys.name === "Sagittarius A* Throne" && sys.posX === undefined) {
        await ctx.db.patch(sys._id, { posX: 0, posY: 0, posZ: 0 });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Star systems for the star lore list — one-time seeding.
//
// Every star in the star lore list (catalog + saved lore stars) gets a map
// system sitting exactly on the star, and any sector left without systems is
// backfilled so no quadrant is empty. Tombstoned like `seed`, so later
// deletions stay deleted.
// ---------------------------------------------------------------------------

export const seedStars = mutation({
  args: {
    stars: v.array(
      v.object({
        starId: v.string(),
        name: v.string(),
        color: v.string(),
        posX: v.number(),
        posY: v.number(),
        posZ: v.number(),
        sectorId: v.id("sectors"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { me: userId } = await requireOperatorCapability(
      ctx,
      ATLAS_OPERATOR_CAPS,
    );

    const user = await ctx.db.get(userId);
    if (user?.starsSeeded) return;

    // 1. Backfill structure: every quadrant needs sectors, every sector needs
    //    systems — so the other quadrants are never left empty.
    const quadrants = await ctx.db.query("quadrants").collect();
    for (const quad of quadrants) {
      const sectors = (
        await ctx.db
          .query("sectors")
          .filter((q) => q.eq(q.field("quadrantId"), quad._id))
          .collect()
      ).map((s) => ({ id: s._id, name: s.name, color: s.color }));
      if (sectors.length === 0) {
        for (const label of ["Inner Reach", "Outer Reach"]) {
          const name = `${quad.name} ${label}`;
          const id = await ctx.db.insert("sectors", {
            userId,
            quadrantId: quad._id,
            name,
            color: quad.color,
            order: sectors.length,
          });
          sectors.push({ id, name, color: quad.color });
        }
      }
      const fillNames = ["Hub", "Reach", "Relay", "Anchorage", "Beacon", "Gate"];
      for (const sector of sectors) {
        const existing = await ctx.db
          .query("starSystems")
          .filter((q) => q.eq(q.field("sectorId"), sector.id))
          .collect();
        for (let i = existing.length; i < 2; i++) {
          await ctx.db.insert("starSystems", {
            userId,
            sectorId: sector.id,
            name: `${sector.name} ${fillNames[i]}`,
            color: sector.color,
            order: i,
          });
        }
      }
    }

    // 2. A map system for every star in the star lore list, at the star's
    //    exact position so zooming into the system lands on the star.
    for (const star of args.stars) {
      const sector = await ctx.db.get(star.sectorId);
      if (!sector) continue;
      const existing = await ctx.db
        .query("starSystems")
        .filter((q) => q.eq(q.field("sectorId"), star.sectorId))
        .collect();
      if (existing.some((s) => s.starId === star.starId)) continue;
      await ctx.db.insert("starSystems", {
        userId,
        sectorId: star.sectorId,
        name: star.name,
        color: star.color,
        order: existing.length,
        posX: star.posX,
        posY: star.posY,
        posZ: star.posZ,
        starId: star.starId,
      });
    }

    // One-time tombstone: later deletions stay deleted.
    await ctx.db.patch(userId, { starsSeeded: true });
  },
});
