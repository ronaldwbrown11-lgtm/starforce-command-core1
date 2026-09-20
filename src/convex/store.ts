import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import { grantCreditsExact } from "./economy";

// =========================================================================
// Requisition Depot — the base store.
//
// Digital products (lore bibles, atlases, dossiers) and physical merch
// (tees, artifacts). The base's download rule is enforced here, at the
// only place a file URL can ever be minted:
//
//   A member may download a store file only if an ENTITLEMENT exists for
//   (member, product). Entitlements are created exclusively by Stripe
//   webhook fulfillment (storeFulfillOrder) — never by client action.
//
// Digital files never leave Convex storage and never appear in public/,
// on Hostinger, or behind a guessable URL. `store getFileUrl` returns a
// short-lived storage URL only after the entitlement (or operator-admin,
// or product-author-of-record) check passes.
//
// Physical orders surface in the operator Orders screen for manual
// fulfillment (mark shipped + tracking note).
// =========================================================================

const STORE_ADMIN_CAPS = ["operator", "senior_operator"] as const;

const MAX_TITLE = 140;
const MAX_DESC = 2000;
const MAX_PRICE_CENTS = 500_000; // $5,000 sanity ceiling
const DOWNLOAD_TTL_SECONDS = 15 * 60; // minted URLs live 15 minutes

const FILE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB — lore bibles are big
const FILE_MIME_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/epub+zip",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

function validateFileMeta(meta: { mimeType: string; byteSize: number }) {
  if (meta.byteSize > FILE_MAX_BYTES) {
    throw new Error(
      `File too large (${(meta.byteSize / (1024 * 1024)).toFixed(1)} MB; max 100 MB).`,
    );
  }
  if (!(FILE_MIME_TYPES as readonly string[]).includes(meta.mimeType)) {
    throw new Error(
      `Unsupported file type (${meta.mimeType}). Allowed: PDF, ZIP, EPUB, TXT, MD, JPEG, PNG, WebP.`,
    );
  }
}

function validateCoverMeta(meta: { mimeType: string; byteSize: number }) {
  if (meta.byteSize > COVER_MAX_BYTES) {
    throw new Error(
      `Image too large (${(meta.byteSize / (1024 * 1024)).toFixed(1)} MB; max 5 MB).`,
    );
  }
  if (!(COVER_MIME_TYPES as readonly string[]).includes(meta.mimeType)) {
    throw new Error(
      `Unsupported image type (${meta.mimeType}). Allowed: JPEG, PNG, WebP, AVIF.`,
    );
  }
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 64) || "requisition"
  );
}

async function requireStoreAdmin(ctx: MutationCtx) {
  return await requireOperatorCapability(ctx, [...STORE_ADMIN_CAPS]);
}

/** Query-side admin gate (no return value needed). */
async function requireStoreAdminQuery(ctx: QueryCtx) {
  await requireOperatorCapability(ctx, [...STORE_ADMIN_CAPS]);
}

// =========================================================================
// Operator product management
// =========================================================================

export const createProduct = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    kind: v.union(
      v.literal("digital"),
      v.literal("physical"),
      v.literal("credits"),
    ),
    category: v.string(),
    priceCents: v.number(),
    /** For kind === "credits": exact Star Credits granted at fulfillment. */
    creditAmount: v.optional(v.number()),
    variants: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const title = args.title.trim().slice(0, MAX_TITLE);
    const description = args.description.trim().slice(0, MAX_DESC);
    const category = args.category.trim().slice(0, 60);
    if (!title || !description || !category) {
      throw new Error("Title, description, and category are required.");
    }
    if (!Number.isFinite(args.priceCents) || args.priceCents < 0 || args.priceCents > MAX_PRICE_CENTS) {
      throw new Error("Price must be between $0.00 and $5,000.00.");
    }
    if (args.kind === "credits") {
      if (
        !Number.isFinite(args.creditAmount) ||
        (args.creditAmount as number) < 100 ||
        (args.creditAmount as number) > 100_000 ||
        (args.creditAmount as number) % 100 !== 0
      ) {
        throw new Error(
          "Credit caches must be a whole multiple of 100 between 100 and 100,000.",
        );
      }
    } else if (args.creditAmount !== undefined) {
      throw new Error("creditAmount is only valid for credit-cache products.");
    }
    if (args.kind === "digital" && args.variants?.length) {
      throw new Error("Digital products do not take size/variant options.");
    }
    if (args.kind !== "physical" && args.variants?.length) {
      throw new Error("Only physical products take size/variant options.");
    }
    const variants = (args.variants ?? [])
      .map((v) => v.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 24);

    let slug = slugify(title);
    const existing = await ctx.db
      .query("storeProducts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const now = Date.now();
    const id = await ctx.db.insert("storeProducts", {
      slug,
      title,
      description,
      kind: args.kind,
      category,
      priceCents: Math.round(args.priceCents),
      currency: "usd",
      creditAmount:
        args.kind === "credits" ? (args.creditAmount as number) : undefined,
      variants: variants.length ? variants : undefined,
      status: "active",
      createdBy: me,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.createProduct",
      target: id,
      meta: JSON.stringify({
        kind: args.kind,
        creditAmount: args.kind === "credits" ? args.creditAmount : undefined,
        priceCents: Math.round(args.priceCents),
      }),
      createdAt: now,
    });
    return { id, slug };
  },
});

export const updateProduct = mutation({
  args: {
    id: v.id("storeProducts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    priceCents: v.optional(v.number()),
    /** For kind === "credits": exact Star Credits granted at fulfillment. */
    creditAmount: v.optional(v.number()),
    variants: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("retired"))),
  },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Product not found.");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim().slice(0, MAX_TITLE);
      if (!t) throw new Error("Title cannot be empty.");
      patch.title = t;
    }
    if (args.description !== undefined) {
      const d = args.description.trim().slice(0, MAX_DESC);
      if (!d) throw new Error("Description cannot be empty.");
      patch.description = d;
    }
    if (args.category !== undefined) {
      const c = args.category.trim().slice(0, 60);
      if (!c) throw new Error("Category cannot be empty.");
      patch.category = c;
    }
    if (args.priceCents !== undefined) {
      if (
        !Number.isFinite(args.priceCents) ||
        args.priceCents < 0 ||
        args.priceCents > MAX_PRICE_CENTS
      ) {
        throw new Error("Price must be between $0.00 and $5,000.00.");
      }
      patch.priceCents = Math.round(args.priceCents);
    }
    if (args.creditAmount !== undefined) {
      if (row.kind !== "credits") {
        throw new Error("creditAmount is only valid for credit-cache products.");
      }
      if (
        !Number.isFinite(args.creditAmount) ||
        args.creditAmount < 100 ||
        args.creditAmount > 100_000 ||
        args.creditAmount % 100 !== 0
      ) {
        throw new Error(
          "Credit caches must be a whole multiple of 100 between 100 and 100,000.",
        );
      }
      patch.creditAmount = args.creditAmount;
    }
    if (args.variants !== undefined) {
      if (row.kind !== "physical" && args.variants.length) {
        throw new Error("Only physical products take size/variant options.");
      }
      const variants = args.variants
        .map((v) => v.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 24);
      patch.variants = variants.length ? variants : undefined;
    }
    if (args.status !== undefined) patch.status = args.status;

    await ctx.db.patch(args.id, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.updateProduct",
      target: args.id,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const removeProduct = mutation({
  args: { id: v.id("storeProducts") },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Product not found.");

    // Retire instead of hard-delete when orders exist — purchase history
    // must survive. Hard-delete only never-sold products and GC assets.
    const anyOrder = await ctx.db
      .query("storeOrders")
      .withIndex("by_product", (q) => q.eq("productId", args.id))
      .first();

    if (anyOrder) {
      await ctx.db.patch(args.id, { status: "retired", updatedAt: Date.now() });
      await ctx.db.insert("auditLog", {
        actorId: me,
        action: "store.retireProduct",
        target: args.id,
        createdAt: Date.now(),
      });
      return { retired: true as const };
    }

    for (const storageId of [row.fileStorageId, row.coverStorageId]) {
      if (storageId) {
        try {
          await ctx.storage.delete(storageId);
        } catch {
          // already gone
        }
      }
    }
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.deleteProduct",
      target: args.id,
      createdAt: Date.now(),
    });
    return { retired: false as const };
  },
});

// ---- File + cover attachment (operator, same upload flow as covers) ----

export const generateProductUploadUrl = mutation({
  args: { purpose: v.union(v.literal("digital_file"), v.literal("cover")) },
  handler: async (ctx, args) => {
    await requireStoreAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachProductFile = mutation({
  args: {
    productId: v.id("storeProducts"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
  },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.productId);
    if (!row) throw new Error("Product not found.");
    if (row.kind !== "digital") {
      throw new Error("Only digital products take a downloadable file.");
    }
    validateFileMeta({ mimeType: args.mimeType, byteSize: args.byteSize });
    const old = row.fileStorageId;
    await ctx.db.patch(args.productId, {
      fileStorageId: args.storageId,
      fileMeta: {
        fileName: args.fileName.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "download",
        mimeType: args.mimeType,
        byteSize: args.byteSize,
      },
      updatedAt: Date.now(),
    });
    if (old && old !== args.storageId) {
      try {
        await ctx.storage.delete(old);
      } catch {
        // already gone
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.attachFile",
      target: args.productId,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const removeProductFile = mutation({
  args: { productId: v.id("storeProducts") },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.productId);
    if (!row) throw new Error("Product not found.");
    if (row.fileStorageId) {
      try {
        await ctx.storage.delete(row.fileStorageId);
      } catch {
        // already gone
      }
    }
    await ctx.db.patch(args.productId, {
      fileStorageId: undefined,
      fileMeta: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.removeFile",
      target: args.productId,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const attachProductCover = mutation({
  args: {
    productId: v.id("storeProducts"),
    storageId: v.id("_storage"),
    meta: v.object({
      mimeType: v.string(),
      byteSize: v.number(),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      altText: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.productId);
    if (!row) throw new Error("Product not found.");
    validateCoverMeta({ mimeType: args.meta.mimeType, byteSize: args.meta.byteSize });
    const old = row.coverStorageId;
    await ctx.db.patch(args.productId, {
      coverStorageId: args.storageId,
      coverMeta: args.meta,
      updatedAt: Date.now(),
    });
    if (old && old !== args.storageId) {
      try {
        await ctx.storage.delete(old);
      } catch {
        // already gone
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.attachCover",
      target: args.productId,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const removeProductCover = mutation({
  args: { productId: v.id("storeProducts") },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.productId);
    if (!row) throw new Error("Product not found.");
    if (row.coverStorageId) {
      try {
        await ctx.storage.delete(row.coverStorageId);
      } catch {
        // already gone
      }
    }
    await ctx.db.patch(args.productId, {
      coverStorageId: undefined,
      coverMeta: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.removeCover",
      target: args.productId,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

// =========================================================================
// Public catalog
// =========================================================================

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("storeProducts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const withCovers = await Promise.all(
      rows.map(async (row) => ({
        _id: row._id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        kind: row.kind,
        category: row.category,
        priceCents: row.priceCents,
        currency: row.currency ?? "usd",
        creditAmount: row.creditAmount ?? null,
        variants: row.variants ?? [],
        hasFile: row.kind === "digital" ? Boolean(row.fileStorageId) : false,
        fileMeta: row.fileMeta ?? null,
        coverUrl: row.coverStorageId ? await ctx.storage.getUrl(row.coverStorageId) : null,
        createdAt: row.createdAt,
      })),
    );
    withCovers.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.title.localeCompare(b.title);
    });
    return withCovers;
  },
});

// =========================================================================
// Entitlement-gated downloads
// =========================================================================

export const getFileDownloadUrl = query({
  args: { productId: v.id("storeProducts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Sign in required.");
    const row = await ctx.db.get(args.productId);
    if (!row) throw new Error("Product not found.");
    if (row.kind !== "digital" || !row.fileStorageId) {
      throw new Error("This product has no downloadable file.");
    }

    // The download rule, enforced at the only URL-minting point:
    // creator-of-record, paid entitlement, or store admin — nothing else.
    const viewer = await ctx.db.get(userId);
    const isAdmin =
      viewer?.role === "admin" ||
      (STORE_ADMIN_CAPS as readonly string[]).includes(String(viewer?.opRole ?? ""));
    const entitlement = await ctx.db
      .query("storeEntitlements")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .first();
    const isCreator = row.createdBy === userId;

    if (!entitlement && !isAdmin && !isCreator) {
      throw new Error("No requisition on file — purchase required to download.");
    }

    const url = await ctx.storage.getUrl(row.fileStorageId);
    if (!url) throw new Error("The file asset is unavailable — contact the operators.");
    // Convex storage URLs are unguessable and revocable by asset deletion;
    // we re-mint per request so a shared link dies with the entitlement.
    void DOWNLOAD_TTL_SECONDS;
    return { url, fileName: row.fileMeta?.fileName ?? row.title };
  },
});

// =========================================================================
// Member purchase surface
// =========================================================================

export const myEntitlements = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const ents = await ctx.db
      .query("storeEntitlements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return await Promise.all(
      ents.map(async (ent) => {
        const product = await ctx.db.get(ent.productId);
        return {
          _id: ent._id,
          productId: ent.productId,
          grantedAt: ent.grantedAt,
          product: product
            ? {
                slug: product.slug,
                title: product.title,
                kind: product.kind,
                category: product.category,
                hasFile: Boolean(product.fileStorageId),
                fileMeta: product.fileMeta ?? null,
              }
            : null,
        };
      }),
    );
  },
});

export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const rows = await ctx.db
      .query("storeOrders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.map((row) => ({
      _id: row._id,
      productTitle: row.productTitle,
      variant: row.variant ?? null,
      amountCents: row.amountCents,
      currency: row.currency,
      kind: row.kind,
      status: row.status,
      trackingNote: row.trackingNote ?? null,
      createdAt: row.createdAt,
    }));
  },
});

// =========================================================================
// Internal — Stripe webhook checkout + fulfillment
// =========================================================================

/** Product snapshot used by the checkout action in stripe.ts. */
export const getProductForCheckout = internalQuery({
  args: { productId: v.id("storeProducts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.productId);
  },
});

/**
 * Create the order + download entitlement. Called ONLY from the Stripe
 * webhook (checkout.session.completed, mode=payment) — this is the single
 * writer of storeEntitlements, which is what makes the download rule real.
 * Idempotent on stripeSessionId so webhook retries never double-fulfill.
 */
export const fulfillStoreOrder = internalMutation({
  args: {
    userId: v.id("users"),
    productId: v.id("storeProducts"),
    variant: v.optional(v.string()),
    kind: v.union(
      v.literal("digital"),
      v.literal("physical"),
      v.literal("credits"),
    ),
    stripeSessionId: v.string(),
    amountCents: v.number(),
    currency: v.string(),
    shippingName: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("storeOrders")
      .withIndex("by_session", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();
    if (existing) return { orderId: existing._id, duplicate: true as const };

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product missing at fulfillment time.");

    const now = Date.now();
    const orderId = await ctx.db.insert("storeOrders", {
      userId: args.userId,
      productId: args.productId,
      productTitle: product.title,
      variant: args.variant,
      amountCents: args.amountCents,
      currency: args.currency,
      kind: product.kind,
      status: product.kind === "physical" ? "paid" : "fulfilled",
      stripeSessionId: args.stripeSessionId,
      shippingName: args.shippingName,
      shippingAddress: args.shippingAddress,
      createdAt: now,
      updatedAt: now,
    });

    // Star Credit caches: the purchase IS the credits. Granted exactly (no
    // surge) and audit-logged; the order record is the receipt.
    if (product.kind === "credits" && (product.creditAmount ?? 0) > 0) {
      await grantCreditsExact(
        ctx,
        args.userId,
        product.creditAmount as number,
        `store:${product.slug}`,
      );
    }

    if (product.kind === "digital") {
      await ctx.db.insert("storeEntitlements", {
        userId: args.userId,
        productId: args.productId,
        orderId,
        grantedAt: now,
      });
    }

    return { orderId, duplicate: false as const };
  },
});

/** Admin catalog view: every product including retired ones. */
export const listAllProductsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireStoreAdminQuery(ctx);
    const rows = await ctx.db.query("storeProducts").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      rows.map(async (row) => ({
        _id: row._id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        kind: row.kind as "digital" | "physical" | "credits",
        category: row.category,
        priceCents: row.priceCents,
        creditAmount: row.creditAmount ?? null,
        variants: row.variants ?? [],
        hasFile: Boolean(row.fileStorageId),
        fileMeta: row.fileMeta ?? null,
        coverUrl: row.coverStorageId ? await ctx.storage.getUrl(row.coverStorageId) : null,
        status: row.status,
        createdAt: row.createdAt,
      })),
    );
  },
});

// =========================================================================
// Operator orders queue
// =========================================================================

export const listAllOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireStoreAdminQuery(ctx);
    const rows = await ctx.db.query("storeOrders").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      rows.map(async (row) => {
        const buyer = await ctx.db.get(row.userId);
        return {
          _id: row._id,
          productTitle: row.productTitle,
          variant: row.variant ?? null,
          amountCents: row.amountCents,
          currency: row.currency,
          kind: row.kind,
          status: row.status,
          shippingName: row.shippingName ?? null,
          shippingAddress: row.shippingAddress ?? null,
          trackingNote: row.trackingNote ?? null,
          createdAt: row.createdAt,
          buyerName: buyer?.displayName ?? buyer?.name ?? "Unknown pilot",
        };
      }),
    );
  },
});

export const updateOrderStatus = mutation({
  args: {
    id: v.id("storeOrders"),
    status: v.union(
      v.literal("paid"),
      v.literal("fulfilled"),
      v.literal("shipped"),
      v.literal("cancelled"),
    ),
    trackingNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireStoreAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Order not found.");
    const patch: Record<string, unknown> = { status: args.status, updatedAt: Date.now() };
    if (args.trackingNote !== undefined) {
      patch.trackingNote = args.trackingNote.trim().slice(0, 300) || undefined;
    }
    await ctx.db.patch(args.id, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "store.updateOrderStatus",
      target: args.id,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});
