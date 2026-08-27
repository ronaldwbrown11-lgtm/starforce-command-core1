import { internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { TIERS, type TierId } from "../lib/tiers";

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { tier: user.tier ?? "free" };
  },
});

export const getUsageInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const files = await ctx.db
      .query("memberFiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const usedBytes = files.reduce((sum, f) => sum + f.fileSize, 0);
    return { usedBytes, fileCount: files.length };
  },
});

export const getByR2Key = internalQuery({
  args: { r2Key: v.string() },
  handler: async (ctx, { r2Key }) => {
    return await ctx.db
      .query("memberFiles")
      .withIndex("by_r2key", (q) => q.eq("r2Key", r2Key))
      .first();
  },
});

export const deleteFile = internalMutation({
  args: { fileId: v.id("memberFiles") },
  handler: async (ctx, { fileId }) => {
    await ctx.db.delete(fileId);
  },
});

export const getUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { usedBytes: 0, quotaBytes: 0, fileCount: 0, files: [] };

    const user = await ctx.db.get(userId);
    const tier = user?.tier ?? "free";
    const tierDef = TIERS[(tier as TierId) in TIERS ? (tier as TierId) : "free"];
    const quotaBytes = (tierDef?.storageGb ?? 0.5) * 1024 * 1024 * 1024;

    const files = await ctx.db
      .query("memberFiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);

    const usedBytes = files.reduce((sum, f) => sum + f.fileSize, 0);

    return {
      usedBytes,
      quotaBytes,
      fileCount: files.length,
      files: files.map((f) => ({
        _id: f._id,
        fileName: f.fileName,
        fileSize: f.fileSize,
        fileType: f.fileType,
        r2Key: f.r2Key,
        uploadedAt: f.uploadedAt,
      })),
    };
  },
});

export const confirmUpload = internalMutation({
  args: {
    userId: v.id("users"),
    r2Key: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("memberFiles", {
      userId: args.userId,
      r2Key: args.r2Key,
      fileName: args.fileName,
      fileSize: args.fileSize,
      fileType: args.fileType,
      uploadedAt: Date.now(),
    });
  },
});
