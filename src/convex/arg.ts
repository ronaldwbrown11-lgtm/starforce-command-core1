import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Seasonal ARG campaigns — the Signal Vault as a compounding campaign.
//
// Each season ("Season 2: The Nine-Minute Signal") has named phases that
// unlock on a schedule; active signals belong to a campaign via
// `signals.campaignId`. The Vault page renders the active campaign header,
// a phase timeline with countdowns, and only that season's signals — so lore
// compounds instead of drifting.
// =========================================================================

const ARG_CAPS = ["operator", "senior_operator", "lore_archivist"] as const;

const MAX = { title: 120, tagline: 240, phaseTitle: 120, phaseBlurb: 600 };

function phaseStatus(phase: { unlockAt: number }, now: number) {
  return phase.unlockAt <= now ? "unlocked" : "locked";
}

export const listArgCampaigns = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("argCampaigns").order("desc").take(25);
    const now = Date.now();
    return rows.map((c) => ({
      _id: c._id,
      season: c.season,
      title: c.title,
      tagline: c.tagline,
      status: c.status,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      phases: c.phases.map((p) => ({
        ...p,
        status: phaseStatus(p, now),
      })),
      createdAt: c.createdAt,
    }));
  },
});

// The campaign currently driving the Vault: an explicitly "active" campaign,
// or the newest one whose time window has opened (fallback for operators who
// forget to flip status).
export const activeArgCampaign = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("argCampaigns").order("desc").take(25);
    const now = Date.now();
    const active =
      all.find((c) => c.status === "active") ??
      all.find((c) => c.startsAt <= now && now <= c.endsAt && c.status !== "concluded");
    if (!active) return null;
    return {
      _id: active._id,
      season: active.season,
      title: active.title,
      tagline: active.tagline,
      status: active.status,
      startsAt: active.startsAt,
      endsAt: active.endsAt,
      phases: active.phases.map((p) => ({
        key: p.key,
        title: p.title,
        unlockAt: p.unlockAt,
        blurb: p.blurb,
        status: phaseStatus(p, now),
      })),
    };
  },
});

// Operator: create a season. Phases unlock on their `unlockAt` schedule and
// must be strictly increasing.
export const createArgCampaign = mutation({
  args: {
    season: v.number(),
    title: v.string(),
    tagline: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    phases: v.array(
      v.object({
        title: v.string(),
        unlockAt: v.number(),
        blurb: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [...ARG_CAPS]);
    const title = args.title.trim();
    const tagline = args.tagline.trim();
    if (!title || !tagline) throw new Error("Season title and tagline are required.");
    if (!Number.isFinite(args.season) || args.season < 1) {
      throw new Error("Season number must be a positive integer.");
    }
    if (!Number.isFinite(args.startsAt) || !Number.isFinite(args.endsAt)) {
      throw new Error("Pick valid campaign dates.");
    }
    if (args.endsAt <= args.startsAt) {
      throw new Error("The campaign end must be after its start.");
    }
    const phases = args.phases.map((p) => ({
      key: `${args.season}-${p.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40)}`,
      title: p.title.trim().slice(0, MAX.phaseTitle),
      unlockAt: p.unlockAt,
      blurb: p.blurb.trim().slice(0, MAX.phaseBlurb),
    }));
    if (phases.length === 0) throw new Error("Add at least one phase.");
    if (phases.some((p) => !p.title || !p.blurb || !Number.isFinite(p.unlockAt))) {
      throw new Error("Every phase needs a title, blurb, and unlock time.");
    }
    for (let i = 1; i < phases.length; i++) {
      if (phases[i].unlockAt <= phases[i - 1].unlockAt) {
        throw new Error("Phase unlock times must be strictly increasing.");
      }
    }

    const now = Date.now();
    const id = await ctx.db.insert("argCampaigns", {
      season: args.season,
      title: title.slice(0, MAX.title),
      tagline: tagline.slice(0, MAX.tagline),
      status: args.startsAt > now ? "upcoming" : "active",
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      phases,
      createdBy: me,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "arg.create",
      target: `argCampaign:${id}`,
      meta: JSON.stringify({ season: args.season, title }),
      createdAt: now,
    });
    return { ok: true, id };
  },
});

export const setArgCampaignStatus = mutation({
  args: {
    id: v.id("argCampaigns"),
    status: v.union(
      v.literal("upcoming"),
      v.literal("active"),
      v.literal("concluded"),
    ),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [...ARG_CAPS]);
    const campaign = await ctx.db.get(args.id);
    if (!campaign) throw new Error("Campaign not found.");
    await ctx.db.patch(args.id, { status: args.status });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "arg.status",
      target: `argCampaign:${args.id}`,
      meta: JSON.stringify({ status: args.status }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});