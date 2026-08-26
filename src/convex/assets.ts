import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, type Infer } from "convex/values";
import { requireOperatorCapability } from "./admin";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Assets — Convex file storage for cover plates on story / lore / transmission.
// Operator-gated uploads with size + MIME guards, audit logging, and orphan
// cleanup when a row's cover is replaced or removed.
// =========================================================================

export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const coverMetaValidator = v.object({
  mimeType: v.string(),
  byteSize: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  altText: v.optional(v.string()),
});
export type CoverMeta = Infer<typeof coverMetaValidator>;

function validateCoverMeta(meta: CoverMeta) {
  if (meta.byteSize > COVER_MAX_BYTES) {
    throw new Error(
      `Image too large (${(meta.byteSize / (1024 * 1024)).toFixed(1)} MB; max ${COVER_MAX_BYTES / (1024 * 1024)} MB).`,
    );
  }
  if (!(COVER_MIME_TYPES as readonly string[]).includes(meta.mimeType)) {
    throw new Error(
      `Unsupported image type (${meta.mimeType}). Allowed: ${COVER_MIME_TYPES.join(", ")}.`,
    );
  }
}

// ---- Upload URL generator ----

export const generateUploadUrl = mutation({
  args: { purpose: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
      "lore_archivist",
    ]);
    const url = await ctx.storage.generateUploadUrl();
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.purpose
        ? `assets.generate_url.${args.purpose}`
        : "assets.generate_url",
      target: "storage",
      createdAt: Date.now(),
    });
    return url;
  },
});

// ---- Standalone URL resolver ----

export const coverUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// ---- Shared attach + remove helpers (DRY across the 3 entities) ----

async function attachCoverInternal(
  ctx: MutationCtx,
  table: "stories" | "loreEntries" | "transmissions",
  id: Id<"stories"> | Id<"loreEntries"> | Id<"transmissions">,
  storageId: Id<"_storage">,
  meta: CoverMeta,
  auditActionBase: string,
) {
  const { me } = await requireOperatorCapability(ctx, [
    "operator",
    "senior_operator",
  ]);
  validateCoverMeta(meta);
  const existing = await ctx.db.get(id);
  if (!existing) throw new Error("Not found.");
  const priorStorageId = existing.coverStorageId;
  await ctx.db.patch(id, {
    coverStorageId: storageId,
    coverMeta: meta,
  });
  if (priorStorageId && priorStorageId !== storageId) {
    try {
      await ctx.storage.delete(priorStorageId);
    } catch {
      // Orphan deletion failures are non-fatal — the row update already landed.
    }
  }
  await ctx.db.insert("auditLog", {
    actorId: me,
    action: `${auditActionBase}.cover_attach`,
    target: `${table}:${id}`,
    meta: JSON.stringify({ mimeType: meta.mimeType, byteSize: meta.byteSize }),
    createdAt: Date.now(),
  });
  return { ok: true };
}

async function removeCoverInternal(
  ctx: MutationCtx,
  table: "stories" | "loreEntries" | "transmissions",
  id: Id<"stories"> | Id<"loreEntries"> | Id<"transmissions">,
  auditActionBase: string,
) {
  const { me } = await requireOperatorCapability(ctx, [
    "operator",
    "senior_operator",
  ]);
  const existing = await ctx.db.get(id);
  if (!existing) throw new Error("Not found.");
  const priorStorageId = existing.coverStorageId;
  await ctx.db.patch(id, {
    coverStorageId: undefined,
    coverMeta: undefined,
  });
  if (priorStorageId) {
    try {
      await ctx.storage.delete(priorStorageId);
    } catch {
      // ignore
    }
  }
  await ctx.db.insert("auditLog", {
    actorId: me,
    action: `${auditActionBase}.cover_remove`,
    target: `${table}:${id}`,
    createdAt: Date.now(),
  });
  return { ok: true };
}

// ---- Story covers (story_editor permitted) ----

export const attachStoryCover = mutation({
  args: {
    id: v.id("stories"),
    storageId: v.id("_storage"),
    meta: coverMetaValidator,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    validateCoverMeta(args.meta);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Story not found.");
    const priorStorageId = existing.coverStorageId;
    await ctx.db.patch(args.id, {
      coverStorageId: args.storageId,
      coverMeta: args.meta,
    });
    if (priorStorageId && priorStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(priorStorageId);
      } catch {
        // ignore
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "story.cover_attach",
      target: `story:${args.id}`,
      meta: JSON.stringify({
        mimeType: args.meta.mimeType,
        byteSize: args.meta.byteSize,
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeStoryCover = mutation({
  args: { id: v.id("stories") },
  handler: async (ctx, args) =>
    removeCoverInternal(ctx, "stories", args.id, "story"),
});

// ---- Lore covers (lore_archivist permitted) ----

export const attachLoreCover = mutation({
  args: {
    id: v.id("loreEntries"),
    storageId: v.id("_storage"),
    meta: coverMetaValidator,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "lore_archivist",
    ]);
    validateCoverMeta(args.meta);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Lore entry not found.");
    const priorStorageId = existing.coverStorageId;
    await ctx.db.patch(args.id, {
      coverStorageId: args.storageId,
      coverMeta: args.meta,
    });
    if (priorStorageId && priorStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(priorStorageId);
      } catch {
        // ignore
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "lore.cover_attach",
      target: `lore:${args.id}`,
      meta: JSON.stringify({
        mimeType: args.meta.mimeType,
        byteSize: args.meta.byteSize,
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeLoreCover = mutation({
  args: { id: v.id("loreEntries") },
  handler: async (ctx, args) =>
    removeCoverInternal(ctx, "loreEntries", args.id, "lore"),
});

// ---- Transmission covers (operator only) ----

export const attachTransmissionCover = mutation({
  args: {
    id: v.id("transmissions"),
    storageId: v.id("_storage"),
    meta: coverMetaValidator,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    validateCoverMeta(args.meta);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Transmission not found.");
    const priorStorageId = existing.coverStorageId;
    await ctx.db.patch(args.id, {
      coverStorageId: args.storageId,
      coverMeta: args.meta,
    });
    if (priorStorageId && priorStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(priorStorageId);
      } catch {
        // ignore
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "transmission.cover_attach",
      target: `transmission:${args.id}`,
      meta: JSON.stringify({
        mimeType: args.meta.mimeType,
        byteSize: args.meta.byteSize,
      }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeTransmissionCover = mutation({
  args: { id: v.id("transmissions") },
  handler: async (ctx, args) =>
    removeCoverInternal(ctx, "transmissions", args.id, "transmission"),
});

// =========================================================================
// Media files — video files on transmissions, documents on resources.
// Operator-gated uploads with size + MIME guards, audit logging, and orphan
// cleanup when a row's file is replaced or removed. Same pattern as covers.
// =========================================================================

export const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime", // .mov (served as mp4-compatible H.264 where possible)
] as const;

export const DOC_MAX_BYTES = 25 * 1024 * 1024;
export const DOC_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const fileMetaValidator = v.object({
  fileName: v.string(),
  mimeType: v.string(),
  byteSize: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});
export type FileMeta = Infer<typeof fileMetaValidator>;

async function attachFileInternal(
  ctx: MutationCtx,
  table: "transmissions" | "resources",
  id: Id<"transmissions"> | Id<"resources">,
  storageId: Id<"_storage">,
  meta: FileMeta,
  auditActionBase: string,
  allowedMime: readonly string[],
  maxBytes: number,
) {
  const { me } = await requireOperatorCapability(ctx, [
    "operator",
    "senior_operator",
  ]);
  if (meta.byteSize > maxBytes) {
    throw new Error(
      `File too large (${(meta.byteSize / (1024 * 1024)).toFixed(1)} MB; max ${(maxBytes / (1024 * 1024)).toFixed(0)} MB).`,
    );
  }
  if (!(allowedMime as readonly string[]).includes(meta.mimeType)) {
    throw new Error(
      `Unsupported file type (${meta.mimeType}). Allowed: ${allowedMime.join(", ")}.`,
    );
  }
  const existing = await ctx.db.get(id);
  if (!existing) throw new Error("Not found.");
  const priorStorageId = existing.fileStorageId;
  await ctx.db.patch(id, {
    fileStorageId: storageId,
    fileMeta: meta,
  });
  if (priorStorageId && priorStorageId !== storageId) {
    try {
      await ctx.storage.delete(priorStorageId);
    } catch {
      // Orphan deletion failures are non-fatal — the row update already landed.
    }
  }
  await ctx.db.insert("auditLog", {
    actorId: me,
    action: `${auditActionBase}.file_attach`,
    target: `${table}:${id}`,
    meta: JSON.stringify({
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      byteSize: meta.byteSize,
    }),
    createdAt: Date.now(),
  });
  return { ok: true };
}

async function removeFileInternal(
  ctx: MutationCtx,
  table: "transmissions" | "resources",
  id: Id<"transmissions"> | Id<"resources">,
  auditActionBase: string,
) {
  const { me } = await requireOperatorCapability(ctx, [
    "operator",
    "senior_operator",
  ]);
  const existing = await ctx.db.get(id);
  if (!existing) throw new Error("Not found.");
  const priorStorageId = existing.fileStorageId;
  await ctx.db.patch(id, {
    fileStorageId: undefined,
    fileMeta: undefined,
  });
  if (priorStorageId) {
    try {
      await ctx.storage.delete(priorStorageId);
    } catch {
      // ignore
    }
  }
  await ctx.db.insert("auditLog", {
    actorId: me,
    action: `${auditActionBase}.file_remove`,
    target: `${table}:${id}`,
    createdAt: Date.now(),
  });
  return { ok: true };
}

// ---- Transmission video files ----

export const attachTransmissionFile = mutation({
  args: {
    id: v.id("transmissions"),
    storageId: v.id("_storage"),
    meta: fileMetaValidator,
  },
  handler: async (ctx, args) =>
    attachFileInternal(
      ctx,
      "transmissions",
      args.id,
      args.storageId,
      args.meta,
      "transmission",
      VIDEO_MIME_TYPES,
      VIDEO_MAX_BYTES,
    ),
});

export const removeTransmissionFile = mutation({
  args: { id: v.id("transmissions") },
  handler: async (ctx, args) =>
    removeFileInternal(ctx, "transmissions", args.id, "transmission"),
});

// ---- Resource document files ----

export const attachResourceFile = mutation({
  args: {
    id: v.id("resources"),
    storageId: v.id("_storage"),
    meta: fileMetaValidator,
  },
  handler: async (ctx, args) =>
    attachFileInternal(
      ctx,
      "resources",
      args.id,
      args.storageId,
      args.meta,
      "resource",
      DOC_MIME_TYPES,
      DOC_MAX_BYTES,
    ),
});

export const removeResourceFile = mutation({
  args: { id: v.id("resources") },
  handler: async (ctx, args) =>
    removeFileInternal(ctx, "resources", args.id, "resource"),
});
