import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";
import { enforceRateLimit } from "./rateLimit";
import { mutation, query } from "./_generated/server";
import {
  awardAchievements,
  bumpContribution,
  evaluateAchievements,
} from "./achievements";
import { CREDIT_RATES, applyXpGain, grantCredits } from "./economy";

const OPERATOR_CAPS = ["operator", "senior_operator", "story_editor", "lore_archivist"];
// Author XP granted the first time a chart discovery is published. Mirrors
// the certified-discovery award in discoveries.ts.
const GALAXY_APPROVED_XP = 25;
const sources = ["freehand", "mission", "contest"] as const;
const categories = ["hero", "villain", "neutral", "ancient", "guardian", "mystery"] as const;

export const submit = mutation({
  args: {
    sectorId: v.id("sectors"),
    name: v.string(),
    description: v.string(),
    color: v.string(),
    posX: v.number(),
    posY: v.number(),
    posZ: v.number(),
    category: v.optional(v.string()),
    faction: v.optional(v.string()),
    source: v.union(v.literal("freehand"), v.literal("mission"), v.literal("contest")),
    contextSlug: v.optional(v.string()),
    contextTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authorId = await getAuthUserId(ctx);
    if (!authorId) throw new Error("Sign in to submit a chart discovery.");
    const name = args.name.trim();
    const description = args.description.trim();
    if (name.length < 2 || name.length > 80) throw new Error("Names must be 2–80 characters.");
    if (description.length < 40 || description.length > 1800) throw new Error("Lore notes must be 40–1,800 characters.");
    if (!/^#[0-9a-f]{6}$/i.test(args.color)) throw new Error("Choose a valid six-digit star color.");
    if (![args.posX, args.posY, args.posZ].every(Number.isFinite) || Math.max(Math.abs(args.posX), Math.abs(args.posY), Math.abs(args.posZ)) > 100) {
      throw new Error("Coordinates must be finite and within ±100 map units.");
    }
    if (args.category && !(categories as readonly string[]).includes(args.category)) throw new Error("Choose a valid lore category.");
    if (args.contextSlug && !/^[a-z0-9-]{1,100}$/i.test(args.contextSlug)) throw new Error("Invalid mission or contest reference.");
    if ((args.source === "mission" || args.source === "contest") && (!args.contextSlug || !args.contextTitle)) {
      throw new Error("This contextual submission needs its mission or contest reference.");
    }
    const sector = await ctx.db.get(args.sectorId);
    if (!sector) throw new Error("That sector no longer exists.");
    const systems = await ctx.db.query("starSystems").collect();
    if (systems.some((system) => system.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("A system with that name is already charted.");
    }
    const pending = await ctx.db.query("galaxyProposals").withIndex("by_author", (q) => q.eq("authorId", authorId)).collect();
    if (pending.some((proposal) => proposal.status === "pending" && proposal.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("You already have a chart proposal with that name awaiting review.");
    }
    await enforceRateLimit(ctx, "galaxy_proposal", authorId, 8, 60 * 60 * 1000, "You have sent several chart proposals recently. Try again later.");
    const now = Date.now();
    const id = await ctx.db.insert("galaxyProposals", {
      authorId,
      sectorId: args.sectorId,
      name,
      description,
      color: args.color,
      posX: args.posX,
      posY: args.posY,
      posZ: args.posZ,
      category: args.category,
      faction: args.faction?.trim().slice(0, 80) || undefined,
      source: args.source,
      contextSlug: args.contextSlug,
      contextTitle: args.contextTitle?.trim().slice(0, 140) || undefined,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.insert("activityFeed", {
      actorId: authorId,
      verb: "proposed",
      targetType: "galaxyProposal",
      targetId: id,
      url: "/map#builder",
      summary: `Charted a discovery proposal: ${name}`,
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const myProposals = query({
  args: {},
  handler: async (ctx) => {
    const authorId = await getAuthUserId(ctx);
    if (!authorId) return [];
    return await ctx.db.query("galaxyProposals").withIndex("by_author", (q) => q.eq("authorId", authorId)).order("desc").take(50);
  },
});

// Public: chart discoveries attached to a mission or contest, newest first.
// Powers the reverse cross-link from a mission / contest page back into the
// builder, so a filed discovery is visible where it was pitched.
export const byContext = query({
  args: { source: v.string(), contextSlug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("galaxyProposals")
      .withIndex("by_context", (q) =>
        q.eq("source", args.source).eq("contextSlug", args.contextSlug),
      )
      .order("desc")
      .take(12);
  },
});

export const reviewQueue = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const rows = args.status
      ? await ctx.db.query("galaxyProposals").withIndex("by_status", (q) => q.eq("status", args.status!)).order("desc").take(150)
      : await ctx.db.query("galaxyProposals").order("desc").take(150);
    return await Promise.all(rows.map(async (proposal) => {
      const [author, sector] = await Promise.all([ctx.db.get(proposal.authorId), ctx.db.get(proposal.sectorId)]);
      return { ...proposal, authorName: author?.displayName ?? author?.name ?? author?.email?.split("@")[0] ?? "Unknown pilot", sectorName: sector?.name ?? "Sector removed" };
    }));
  },
});

export const review = mutation({
  args: {
    id: v.id("galaxyProposals"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me: reviewerId } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Chart proposal not found.");
    if (proposal.status !== "pending") throw new Error("This proposal has already been reviewed.");
    const now = Date.now();
    const note = args.note?.trim().slice(0, 500) || undefined;
    if (args.action === "approve") {
      const sector = await ctx.db.get(proposal.sectorId);
      if (!sector) throw new Error("The selected sector no longer exists.");
      const systems = await ctx.db.query("starSystems").collect();
      if (systems.some((system) => system.name.toLowerCase() === proposal.name.toLowerCase())) {
        throw new Error("A charted system now uses this name. Resolve that conflict before approval.");
      }
      const inSector = systems.filter((system) => system.sectorId === proposal.sectorId);
      const systemId = await ctx.db.insert("starSystems", {
        userId: reviewerId,
        sectorId: proposal.sectorId,
        name: proposal.name,
        description: proposal.description,
        color: proposal.color,
        order: inSector.length,
        posX: proposal.posX,
        posY: proposal.posY,
        posZ: proposal.posZ,
      });
      const starId = `builder-${String(systemId)}`;
      await ctx.db.insert("starLore", {
        userId: reviewerId,
        starId,
        name: proposal.name,
        defaultName: proposal.name,
        posX: proposal.posX,
        posY: proposal.posY,
        posZ: proposal.posZ,
        color: proposal.color,
        size: 1,
        temperature: 5800,
        magnitude: 1,
        loreNotes: proposal.description,
        isCustom: true,
        category: proposal.category as (typeof categories)[number] | undefined,
      });
      await ctx.db.patch(args.id, { status: "approved", reviewNote: note, reviewedAt: now, reviewerId, publishedSystemId: systemId });
      await ctx.db.insert("activityFeed", {
        actorId: reviewerId,
        verb: "published_lore",
        targetType: "galaxySystem",
        targetId: String(systemId),
        url: "/map",
        summary: `Added ${proposal.name} to the shared Star Atlas`,
        createdAt: now,
      });
      // Notify the author of publication — skipped when an operator reviewed
      // their own chart proposal.
      if (proposal.authorId !== reviewerId) {
        await ctx.db.insert("notifications", {
          userId: proposal.authorId,
          kind: "galaxy_proposal_approved",
          title: "Your chart discovery is now canon",
          body: `${proposal.name}${note ? ` — ${note}` : " is now part of the shared Star Atlas."}`.slice(0, 300),
          url: "/map",
          createdAt: now,
        });
      }
      // Reward the author the first time a proposal is published (guarded by
      // xpAwardedAt; never on self-review) — the same canon-discovery recipe
      // used by discoveries.ts: XP, badge, contribution count, credits, audit.
      if (proposal.authorId !== reviewerId && !proposal.xpAwardedAt) {
        const amount = await applyXpGain(ctx, proposal.authorId, GALAXY_APPROVED_XP, {
          source: "galaxyProposal.approved",
        });
        await ctx.db.patch(args.id, { xpAwardedAt: now });
        await ctx.db.insert("auditLog", {
          actorId: reviewerId,
          action: "xp.grant",
          target: `user:${proposal.authorId}`,
          meta: JSON.stringify({
            source: "galaxyProposal.approved",
            amount,
            proposal: args.id,
          }),
          createdAt: now,
        });
        await awardAchievements(ctx, proposal.authorId, ["temporal_investigator"]);
        await bumpContribution(ctx, proposal.authorId);
        await evaluateAchievements(ctx, proposal.authorId);
        await grantCredits(
          ctx,
          proposal.authorId,
          CREDIT_RATES.discoveryApproved,
          "galaxyProposal.approved",
        );
      }
      await ctx.db.insert("auditLog", {
        actorId: reviewerId,
        action: "galaxyProposal.approve",
        target: `galaxyProposal:${args.id}`,
        meta: JSON.stringify({ systemId: String(systemId), name: proposal.name }),
        createdAt: now,
      });
      return { ok: true, systemId };
    }
    await ctx.db.patch(args.id, { status: "rejected", reviewNote: note, reviewedAt: now, reviewerId });
    await ctx.db.insert("notifications", {
      userId: proposal.authorId,
      kind: "galaxy_proposal_rejected",
      title: "Your chart proposal was not approved",
      body: note ? `${proposal.name} — ${note}`.slice(0, 300) : proposal.name,
      url: "/map#builder",
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: reviewerId,
      action: "galaxyProposal.reject",
      target: `galaxyProposal:${args.id}`,
      meta: note ? JSON.stringify({ note }) : undefined,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    return (await ctx.db.query("galaxyProposals").withIndex("by_status", (q) => q.eq("status", "pending")).take(200)).length;
  },
});
