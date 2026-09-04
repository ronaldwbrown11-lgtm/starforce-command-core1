import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";

// ---- Armament Sheets ----

export const listArmamentSheets = query({
  args: {},
  handler: async (ctx) => {
    const sheets = await ctx.db.query("armamentSheets").collect();
    return Promise.all(
      sheets.map(async (s) => {
        const vessel = await ctx.db.get(s.vesselId);
        return { ...s, vessel };
      }),
    );
  },
});

export const getArmamentSheet = query({
  args: { id: v.id("armamentSheets") },
  handler: async (ctx, args) => {
    const sheet = await ctx.db.get(args.id);
    if (!sheet) return null;
    const vessel = await ctx.db.get(sheet.vesselId);
    return { ...sheet, vessel };
  },
});

export const upsertArmamentSheet = mutation({
  args: {
    id: v.optional(v.id("armamentSheets")),
    vesselId: v.id("vessels"),
    title: v.string(),
    primaryArmament: v.optional(v.string()),
    secondaryArmament: v.optional(v.string()),
    defensiveSystems: v.optional(v.string()),
    ammunitionNotes: v.optional(v.string()),
    classification: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const now = Date.now();
    const data = {
      vesselId: args.vesselId,
      title: args.title.trim(),
      primaryArmament: args.primaryArmament?.trim() || undefined,
      secondaryArmament: args.secondaryArmament?.trim() || undefined,
      defensiveSystems: args.defensiveSystems?.trim() || undefined,
      ammunitionNotes: args.ammunitionNotes?.trim() || undefined,
      classification: args.classification.trim(),
    };
    if (args.id) {
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return await ctx.db.insert("armamentSheets", { ...data, createdAt: now });
  },
});

// ---- Service Histories ----

export const listServiceHistories = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("serviceHistories").collect();
    return Promise.all(
      records.map(async (r) => {
        const vessel = await ctx.db.get(r.vesselId);
        return { ...r, vessel };
      }),
    );
  },
});

export const getServiceHistory = query({
  args: { id: v.id("serviceHistories") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) return null;
    const vessel = await ctx.db.get(record.vesselId);
    return { ...record, vessel };
  },
});

export const upsertServiceHistory = mutation({
  args: {
    id: v.optional(v.id("serviceHistories")),
    vesselId: v.id("vessels"),
    eventType: v.string(),
    title: v.string(),
    details: v.optional(v.string()),
    eventDate: v.optional(v.string()),
    location: v.optional(v.string()),
    sourceReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const now = Date.now();
    const data = {
      vesselId: args.vesselId,
      eventType: args.eventType.trim(),
      title: args.title.trim(),
      details: args.details?.trim() || undefined,
      eventDate: args.eventDate?.trim() || undefined,
      location: args.location?.trim() || undefined,
      sourceReference: args.sourceReference?.trim() || undefined,
    };
    if (args.id) {
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return await ctx.db.insert("serviceHistories", { ...data, createdAt: now });
  },
});

// ---- Black-box Files ----

export const listBlackBoxFiles = query({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("blackBoxFiles").collect();
    return Promise.all(
      files.map(async (f) => {
        const vessel = await ctx.db.get(f.vesselId);
        return { ...f, vessel };
      }),
    );
  },
});

export const getBlackBoxFile = query({
  args: { id: v.id("blackBoxFiles") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file) return null;
    const vessel = await ctx.db.get(file.vesselId);
    return { ...file, vessel };
  },
});

export const upsertBlackBoxFile = mutation({
  args: {
    id: v.optional(v.id("blackBoxFiles")),
    vesselId: v.id("vessels"),
    fileCode: v.string(),
    title: v.string(),
    incidentDate: v.optional(v.string()),
    classification: v.string(),
    summary: v.optional(v.string()),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const now = Date.now();
    const data = {
      vesselId: args.vesselId,
      fileCode: args.fileCode.trim(),
      title: args.title.trim(),
      incidentDate: args.incidentDate?.trim() || undefined,
      classification: args.classification.trim(),
      summary: args.summary?.trim() || undefined,
      payload: args.payload?.trim() || undefined,
    };
    if (args.id) {
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return await ctx.db.insert("blackBoxFiles", { ...data, createdAt: now });
  },
});

// ---- Aggregate stats for Fleet Registry landing page ----

export const fleetStats = query({
  args: {},
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vessels").collect();
    const sheets = await ctx.db.query("armamentSheets").collect();
    const histories = await ctx.db.query("serviceHistories").collect();
    const boxes = await ctx.db.query("blackBoxFiles").collect();
    return {
      vesselCount: vessels.length,
      sheetCount: sheets.length,
      historyCount: histories.length,
      blackBoxCount: boxes.length,
    };
  },
});
