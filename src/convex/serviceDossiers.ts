import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Deep service records — member personnel data (ship assignment, tour
// history, narrative dossier).
//
// This data lives in its OWN database (`serviceDossiers`) and is deliberately
// separate from the lore personnel database: it keys to Convex user accounts,
// never merges with lore library / lore personnel tables, and is only exposed
// through these dedicated queries. `publicVisible` controls profile exposure;
// everything else is owner-only. All mutations are audit-logged.
// =========================================================================

const MAX = {
  shipDesignation: 40,
  shipName: 80,
  shipRole: 60,
  division: 60,
  tourVessel: 80,
  tourTitle: 80,
  tourSector: 80,
  tourSummary: 300,
  narrative: 1200,
};

const EMPTY_TOURS: Array<{
  id: string;
  vesselDesignation?: string;
  vesselName?: string;
  title?: string;
  sector?: string;
  startedAt: number;
  endedAt?: number;
  summary?: string;
}> = [];

// ---- Reads ---------------------------------------------------------------

// Owner view: the full dossier including private fields. Returns null when
// no dossier exists yet (callers should create one via the mutations).
export const myDossier = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const row = await ctx.db
      .query("serviceDossiers")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();
    if (!row) return null;
    return {
      _id: row._id,
      shipDesignation: row.shipDesignation ?? null,
      shipName: row.shipName ?? null,
      shipRole: row.shipRole ?? null,
      division: row.division ?? null,
      tours: row.tours ?? EMPTY_TOURS,
      narrative: row.narrative ?? null,
      publicVisible: row.publicVisible ?? true,
      updatedAt: row.updatedAt,
    };
  },
});

// Public view: profile-visible dossier for another member (or yourself when
// signed in). Honors `publicVisible`. Returns null when hidden or absent.
export const publicDossier = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("serviceDossiers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!row || row.publicVisible === false) return null;
    return {
      shipDesignation: row.shipDesignation ?? null,
      shipName: row.shipName ?? null,
      shipRole: row.shipRole ?? null,
      division: row.division ?? null,
      tours: (row.tours ?? EMPTY_TOURS).map((t) => ({
        id: t.id,
        vesselDesignation: t.vesselDesignation ?? null,
        vesselName: t.vesselName ?? null,
        title: t.title ?? null,
        sector: t.sector ?? null,
        startedAt: t.startedAt,
        endedAt: t.endedAt ?? null,
        summary: t.summary ?? null,
      })),
      narrative: row.narrative ?? null,
      updatedAt: row.updatedAt,
    };
  },
});

// ---- Owner mutations ------------------------------------------------------

async function ensureDossier(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await ctx.db
    .query("serviceDossiers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (existing) return existing;
  const id = await ctx.db.insert("serviceDossiers", {
    userId,
    tours: [],
    publicVisible: true,
    updatedAt: Date.now(),
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("Dossier could not be created.");
  return row;
}

export const updateShipAssignment = mutation({
  args: {
    shipDesignation: v.optional(v.string()),
    shipName: v.optional(v.string()),
    shipRole: v.optional(v.string()),
    division: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const existing = await ensureDossier(ctx, me);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const clean = (value: string | undefined, max: number) =>
      value !== undefined ? value.trim().slice(0, max) || undefined : undefined;
    if (args.shipDesignation !== undefined)
      patch.shipDesignation = clean(args.shipDesignation, MAX.shipDesignation);
    if (args.shipName !== undefined)
      patch.shipName = clean(args.shipName, MAX.shipName);
    if (args.shipRole !== undefined)
      patch.shipRole = clean(args.shipRole, MAX.shipRole);
    if (args.division !== undefined)
      patch.division = clean(args.division, MAX.division);
    await ctx.db.patch(existing._id, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "dossier.ship_assignment",
      target: `user:${me}`,
      meta: JSON.stringify(patch),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const addTour = mutation({
  args: {
    vesselDesignation: v.optional(v.string()),
    vesselName: v.optional(v.string()),
    title: v.optional(v.string()),
    sector: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    if (!Number.isFinite(args.startedAt)) throw new Error("Pick a tour start date.");
    if (args.endedAt !== undefined && args.endedAt < args.startedAt) {
      throw new Error("Tour end must be after its start.");
    }
    const row = await ensureDossier(ctx, me);
    const clean = (value: string | undefined, max: number) =>
      value ? value.trim().slice(0, max) : undefined;
    const tour = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      vesselDesignation: clean(args.vesselDesignation, MAX.tourVessel),
      vesselName: clean(args.vesselName, MAX.tourVessel),
      title: clean(args.title, MAX.tourTitle),
      sector: clean(args.sector, MAX.tourSector),
      startedAt: args.startedAt,
      endedAt: args.endedAt ?? undefined,
      summary: clean(args.summary, MAX.tourSummary),
    };
    await ctx.db.patch(row._id, {
      tours: [...(row.tours ?? []), tour],
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "dossier.tour.add",
      target: `user:${me}`,
      meta: JSON.stringify({ id: tour.id, title: tour.title ?? "" }),
      createdAt: Date.now(),
    });
    return { ok: true, id: tour.id };
  },
});

export const updateTour = mutation({
  args: {
    tourId: v.string(),
    vesselDesignation: v.optional(v.string()),
    vesselName: v.optional(v.string()),
    title: v.optional(v.string()),
    sector: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ensureDossier(ctx, me);
    const tours = row.tours ?? [];
    const idx = tours.findIndex((t) => t.id === args.tourId);
    if (idx === -1) throw new Error("Tour not found.");
    const next = [...tours];
    const clean = (value: string | undefined, max: number) =>
      value !== undefined ? value.trim().slice(0, max) || undefined : undefined;
    const start = args.startedAt ?? next[idx].startedAt;
    const end = args.endedAt !== undefined ? args.endedAt : next[idx].endedAt;
    if (end !== undefined && end < start) throw new Error("Tour end must be after its start.");
    next[idx] = {
      ...next[idx],
      vesselDesignation: clean(args.vesselDesignation, MAX.tourVessel) ?? next[idx].vesselDesignation,
      vesselName: clean(args.vesselName, MAX.tourVessel) ?? next[idx].vesselName,
      title: clean(args.title, MAX.tourTitle) ?? next[idx].title,
      sector: clean(args.sector, MAX.tourSector) ?? next[idx].sector,
      startedAt: start,
      endedAt: end,
      summary: clean(args.summary, MAX.tourSummary) ?? next[idx].summary,
    };
    await ctx.db.patch(row._id, { tours: next, updatedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "dossier.tour.update",
      target: `user:${me}`,
      meta: JSON.stringify({ id: args.tourId }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeTour = mutation({
  args: { tourId: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const row = await ensureDossier(ctx, me);
    const tours = (row.tours ?? []).filter((t) => t.id !== args.tourId);
    if (tours.length === (row.tours ?? []).length) throw new Error("Tour not found.");
    await ctx.db.patch(row._id, { tours, updatedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "dossier.tour.remove",
      target: `user:${me}`,
      meta: JSON.stringify({ id: args.tourId }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const updateNarrative = mutation({
  args: { narrative: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const existing = await ensureDossier(ctx, me);
    const narrative = args.narrative.trim().slice(0, MAX.narrative);
    await ctx.db.patch(existing._id, {
      narrative: narrative || undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "dossier.narrative",
      target: `user:${me}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const setDossierVisibility = mutation({
  args: { publicVisible: v.boolean() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const existing = await ensureDossier(ctx, me);
    await ctx.db.patch(existing._id, {
      publicVisible: args.publicVisible,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "dossier.visibility",
      target: `user:${me}`,
      meta: JSON.stringify({ publicVisible: args.publicVisible }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});