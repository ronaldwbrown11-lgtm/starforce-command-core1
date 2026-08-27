"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { internal } from "./_generated/api";
import { TIERS, type TierId } from "../lib/tiers";

// ---------------------------------------------------------------------------
// R2 client — reads credentials from the platform's env vars.
// Environment variables to set in the Keys/API keys tab:
//   R2_ACCOUNT_ID      — visible in your Cloudflare R2 dashboard URL
//   R2_ACCESS_KEY_ID   — from R2 API Tokens (Object Read & Write)
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET_NAME     — the bucket you created for member files
// ---------------------------------------------------------------------------

function getR2(): { client: S3Client; bucket: string } {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 storage is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in the Keys/API keys tab.",
    );
  }

  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}

function getTierQuotaBytes(tier: string): number {
  const id = (TIERS[tier as TierId] ? tier : "free") as TierId;
  return (TIERS[id]?.storageGb ?? 0.5) * 1024 * 1024 * 1024;
}

function getTierMaxUploadMb(tier: string): number {
  const id = (TIERS[tier as TierId] ? tier : "free") as TierId;
  return TIERS[id]?.maxUploadMb ?? 5;
}

// ---------------------------------------------------------------------------
// Generate a pre-signed upload URL. The browser uploads directly to R2 —
// no file content ever touches Convex.
// ---------------------------------------------------------------------------

export const getUploadUrl = action({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  handler: async (ctx, { fileName, fileSize, fileType }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required to upload files.");

    // Fetch user tier from the database.
    const user = await ctx.runQuery(internal.storageHelper.getUser, { userId });
    const tier = user?.tier ?? "free";

    // Enforce per-file size limit.
    const maxUploadBytes = getTierMaxUploadMb(tier) * 1024 * 1024;
    if (fileSize > maxUploadBytes) {
      throw new Error(
        `File too large. Your ${tier} tier allows max ${getTierMaxUploadMb(tier)} MB per file.`,
      );
    }

    // Enforce quota.
    const usage = await ctx.runQuery(internal.storageHelper.getUsageInternal, { userId });
    const quota = getTierQuotaBytes(tier);
    if (usage.usedBytes + fileSize > quota) {
      throw new Error(
        `Storage quota exceeded. You've used ${formatBytes(usage.usedBytes)} of ${formatBytes(quota)}. Delete some files or upgrade your tier.`,
      );
    }

    // Generate unique R2 key.
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const r2Key = `member-files/${userId}/${timestamp}-${safeName}`;

    const { client, bucket } = getR2();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      ContentType: fileType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 }); // 5 min

    return { uploadUrl, r2Key, fileName, fileSize, fileType };
  },
});

// ---------------------------------------------------------------------------
// Confirm upload wrapper — callable from the frontend after a successful PUT.
// ---------------------------------------------------------------------------

export const confirmUploadFromClient = action({
  args: {
    r2Key: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    fileType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");
    await ctx.runMutation(internal.storageHelper.confirmUpload, {
      userId,
      ...args,
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Generate a pre-signed download URL for a member file.
// ---------------------------------------------------------------------------

export const getDownloadUrl = action({
  args: { r2Key: v.string() },
  handler: async (ctx, { r2Key }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");

    // Verify the file belongs to the user (or is public — for now, private only).
    const file = await ctx.runQuery(internal.storageHelper.getByR2Key, { r2Key });
    if (!file) throw new Error("File not found.");
    if (file.userId !== userId) throw new Error("Access denied.");

    const { client, bucket } = getR2();
    const command = new GetObjectCommand({ Bucket: bucket, Key: r2Key });
    const url = await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 hour
    return { url };
  },
});

// ---------------------------------------------------------------------------
// Delete a member file from R2 and the database.
// ---------------------------------------------------------------------------

export const deleteFile = action({
  args: { r2Key: v.string() },
  handler: async (ctx, { r2Key }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in required.");

    const file = await ctx.runQuery(internal.storageHelper.getByR2Key, { r2Key });
    if (!file) throw new Error("File not found.");
    if (file.userId !== userId) throw new Error("Access denied.");

    // Delete from R2.
    const { client, bucket } = getR2();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: r2Key }));

    // Delete from database.
    await ctx.runMutation(internal.storageHelper.deleteFile, { fileId: file._id });

    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// GetUsage lives in storage.ts.hooks (see storage.ts file - queries can't be
// in a "use node" file). Re-exported here as a convenience; the frontend
// references api.storage.getUsage which resolves to this module.
// ---------------------------------------------------------------------------
// NOTE: getUsage is defined in storageHelper.ts (a non-Node file) and is
// exported as a normal query. The frontend calls it via api.storage.getUsage.
// For it to resolve, we need a re-export in a non-Node module. Since we can't
// re-export from a use-node file, the frontend should import from
// api.storageHelper.getUsage instead.
//
// ACTUALLY — easier fix: rename this module to not be "use node" for queries,
// and keep actions in a separate file. We'll just keep all non-Node functions
// in storageHelper.ts and have storage.ts ONLY export actions.
//

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
