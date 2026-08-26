import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Site appearance — operator-controlled background imagery.
//
// Page backgrounds: one uploaded image per public route path (e.g. "/stories"),
// rendered behind the page content in SiteShell. Detail pages (e.g.
// "/stories/my-story") inherit the background of their section ("/stories").
// Feature card art: per-item covers for the featured content shown on the
// home page, managed from the Appearance desk.
//
// Images are stored in Convex file storage. The public query resolves
// storage ids to signed URLs so the frontend only ever renders URLs.
// =========================================================================

export const BACKGROUND_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — wallpapers run large
export const BACKGROUND_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

type BackgroundMeta = {
  storageId: Id<"_storage">;
  mimeType: string;
  byteSize: number;
  altText?: string;
};

const backgroundMetaValidator = v.object({
  storageId: v.id("_storage"),
  mimeType: v.string(),
  byteSize: v.number(),
  altText: v.optional(v.string()),
});

function validateBackgroundMeta(meta: BackgroundMeta) {
  if (meta.byteSize > BACKGROUND_MAX_BYTES) {
    throw new Error(
      `Image too large (${(meta.byteSize / (1024 * 1024)).toFixed(1)} MB; max ${BACKGROUND_MAX_BYTES / (1024 * 1024)} MB).`,
    );
  }
  if (!(BACKGROUND_MIME_TYPES as readonly string[]).includes(meta.mimeType)) {
    throw new Error(
      `Unsupported image type (${meta.mimeType}). Allowed: ${BACKGROUND_MIME_TYPES.join(", ")}.`,
    );
  }
}

const SINGLETON_KEY = "main";

async function getSingletonId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"siteAppearance"> | null> {
  return (
    (await ctx.db
      .query("siteAppearance")
      .withIndex("by_key", (q) => q.eq("key", SINGLETON_KEY))
      .first())?._id ?? null
  );
}

async function ensureSingletonId(ctx: MutationCtx): Promise<Id<"siteAppearance">> {
  const existing = await getSingletonId(ctx);
  if (existing) return existing;
  return await ctx.db.insert("siteAppearance", {
    key: SINGLETON_KEY,
    updatedAt: Date.now(),
  });
}

export type BackgroundInfo = {
  storageId: string;
  url: string | null;
  mimeType: string;
  byteSize: number;
  altText?: string;
};

async function resolveBackground(
  ctx: QueryCtx,
  meta: BackgroundMeta | undefined,
): Promise<BackgroundInfo | null> {
  if (!meta) return null;
  let url: string | null = null;
  try {
    url = await ctx.storage.getUrl(meta.storageId);
  } catch {
    url = null;
  }
  return {
    storageId: String(meta.storageId),
    url,
    mimeType: meta.mimeType,
    byteSize: meta.byteSize,
    altText: meta.altText,
  };
}

// ---- Public read ----

export const getAppearance = query({
  args: {},
  handler: async (ctx) => {
    const id = await getSingletonId(ctx);
    const row = id ? await ctx.db.get(id) : null;
    const pageBackgrounds: Record<string, BackgroundInfo> = {};
    if (row?.pageBackgrounds) {
      for (const [path, meta] of Object.entries(row.pageBackgrounds)) {
        const resolved = await resolveBackground(ctx, meta);
        if (resolved) pageBackgrounds[path] = resolved;
      }
    }
    const cardBackground = await resolveBackground(ctx, row?.cardBackground);
    return { pageBackgrounds, cardBackground };
  },
});

// ---- Page backgrounds ----

/** Normalize a route path so lookups always use the canonical leading slash. */
function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) throw new Error("Path is required.");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const setPageBackground = mutation({
  args: {
    path: v.string(),
    meta: backgroundMetaValidator,
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const path = normalizePath(args.path);
    validateBackgroundMeta(args.meta);
    const id = await ensureSingletonId(ctx);
    const row = await ctx.db.get(id);
    const prior = row?.pageBackgrounds?.[path];
    await ctx.db.patch(id, {
      pageBackgrounds: {
        ...(row?.pageBackgrounds ?? {}),
        [path]: args.meta,
      },
      updatedAt: Date.now(),
    });
    if (prior && prior.storageId !== args.meta.storageId) {
      try {
        await ctx.storage.delete(prior.storageId);
      } catch {
        // non-fatal — the new value already landed.
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "appearance.page_bg_set",
      target: `page:${path}`,
      meta: JSON.stringify({ mimeType: args.meta.mimeType, byteSize: args.meta.byteSize }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const clearPageBackground = mutation({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const path = normalizePath(args.path);
    const id = await getSingletonId(ctx);
    if (!id) return { ok: true };
    const row = await ctx.db.get(id);
    const prior = row?.pageBackgrounds?.[path];
    const next = { ...(row?.pageBackgrounds ?? {}) };
    delete next[path];
    await ctx.db.patch(id, {
      pageBackgrounds: next,
      updatedAt: Date.now(),
    });
    if (prior) {
      try {
        await ctx.storage.delete(prior.storageId);
      } catch {
        // non-fatal
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "appearance.page_bg_clear",
      target: `page:${path}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---- Card background ----

export const setCardBackground = mutation({
  args: { meta: backgroundMetaValidator },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    validateBackgroundMeta(args.meta);
    const id = await ensureSingletonId(ctx);
    const row = await ctx.db.get(id);
    const prior = row?.cardBackground;
    await ctx.db.patch(id, {
      cardBackground: args.meta,
      updatedAt: Date.now(),
    });
    if (prior && prior.storageId !== args.meta.storageId) {
      try {
        await ctx.storage.delete(prior.storageId);
      } catch {
        // non-fatal
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "appearance.card_bg_set",
      target: "card:global",
      meta: JSON.stringify({ mimeType: args.meta.mimeType, byteSize: args.meta.byteSize }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const clearCardBackground = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const id = await getSingletonId(ctx);
    if (!id) return { ok: true };
    const row = await ctx.db.get(id);
    const prior = row?.cardBackground;
    await ctx.db.patch(id, {
      cardBackground: undefined,
      updatedAt: Date.now(),
    });
    if (prior) {
      try {
        await ctx.storage.delete(prior.storageId);
      } catch {
        // non-fatal
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "appearance.card_bg_clear",
      target: "card:global",
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---- Home-page featured card art catalog ----
//
// Only the content actually featured on the home page (featured stories,
// the lore spotlight, featured transmissions) — each with its current cover
// resolved to a public URL so the operator Appearance desk can manage that
// card's top image individually.

export type CardCatalogEntry = {
  _id: string;
  title: string;
  slug: string;
  kind: "story" | "lore" | "transmission";
  coverStorageId: string | null;
  coverUrl: string | null;
  status?: string;
};

function byFeaturedOrder<T extends { featuredOrder?: number }>(rows: T[]) {
  return [...rows]
    .filter((r) => r.featuredOrder != null)
    .sort((a, b) => (a.featuredOrder ?? 0) - (b.featuredOrder ?? 0));
}

export const listCardCatalog = query({
  args: { version: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // args.version is a cache-busting key so the operator desk can refetch
    // after a per-card upload without waiting for a server push.
    void args;
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
      "lore_archivist",
    ]);
    const [stories, lore, transmissions] = await Promise.all([
      ctx.db
        .query("stories")
        .withIndex("by_featured", (q) => q.eq("featured", true))
        .take(50),
      ctx.db
        .query("loreEntries")
        .withIndex("by_featured", (q) => q.eq("featured", true))
        .take(50),
      ctx.db
        .query("transmissions")
        .withIndex("by_featured", (q) => q.eq("featured", true))
        .take(50),
    ]);
    const toEntry = async (
      row: {
        _id: string;
        title: string;
        slug: string;
        coverStorageId?: string;
        status?: string;
      },
      kind: CardCatalogEntry["kind"],
    ): Promise<CardCatalogEntry> => {
      let coverUrl: string | null = null;
      if (row.coverStorageId) {
        try {
          coverUrl = await ctx.storage.getUrl(
            row.coverStorageId as any,
          );
        } catch {
          coverUrl = null;
        }
      }
      return {
        _id: String(row._id),
        title: row.title,
        slug: row.slug,
        kind,
        coverStorageId: row.coverStorageId ? String(row.coverStorageId) : null,
        coverUrl,
        status: row.status,
      };
    };

    return {
      stories: await Promise.all(
        byFeaturedOrder(stories).map((s) => toEntry(s, "story")),
      ),
      lore: await Promise.all(
        byFeaturedOrder(lore).map((l) => toEntry(l, "lore")),
      ),
      transmissions: await Promise.all(
        byFeaturedOrder(transmissions).map((t) => toEntry(t, "transmission")),
      ),
    };
  },
});
