import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Honors & Quartermaster's Locker
//
// Honors: operator-managed service ribbons, badges, and medals with uploaded
// imagery, awarded to members with optional citations. Rendered as a ribbon
// rack on profiles and member pages.
//
// Locker: collectible digital assets (blueprints, insignia patches, manuals,
// artifacts) minted by operators and granted to members. Traded items are
// operator-brokered: a transfer moves the single grant from one member to
// another, so items can never be duplicated from the client.
//
// Every write is capability-gated and audit-logged.
// =========================================================================

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/svg+xml",
];
const FILE_MAX_BYTES = 25 * 1024 * 1024;

const HONOR_CATEGORIES = ["ribbon", "badge", "medal"] as const;
const VAULT_KINDS = ["blueprint", "insignia", "manual", "artifact"] as const;

async function requireAdmin(ctx: { db: any; auth: any }) {
  const me = await getAuthUserId(ctx as any);
  if (!me) throw new Error("Sign in required.");
  const user = await ctx.db.get(me);
  if (!user) throw new Error("User not found.");
  if (user.role !== "admin" && !user.opRole) throw new Error("Forbidden.");
  return me as Id<"users">;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

// ---------------------------------------------------------------------------
// Honors catalog (operator)
// ---------------------------------------------------------------------------

export const listHonorsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin" && !user?.opRole) return null;
    const rows = await ctx.db.query("honors").collect();
    rows.sort(
      (a, b) =>
        (a.precedence ?? 999) - (b.precedence ?? 999) ||
        a.createdAt - b.createdAt,
    );
    // Holder counts for the manage table.
    return await Promise.all(
      rows.map(async (h) => {
        const holders = await ctx.db
          .query("memberAwards")
          .withIndex("by_award", (q) => q.eq("awardId", h.awardId))
          .collect();
        return {
          _id: h._id,
          awardId: h.awardId,
          name: h.name,
          category: h.category,
          description: h.description,
          precedence: h.precedence ?? null,
          active: h.active !== false,
          hasImage: !!h.imageStorageId,
          imageMeta: h.imageMeta ?? null,
          holders: holders.length,
        };
      }),
    );
  },
});

export const createHonor = mutation({
  args: {
    name: v.string(),
    category: v.union(
      v.literal("ribbon"),
      v.literal("badge"),
      v.literal("medal"),
    ),
    description: v.string(),
    precedence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const name = args.name.trim().slice(0, 120);
    const description = args.description.trim().slice(0, 1000);
    if (!name || !description) {
      throw new Error("Name and description are required.");
    }
    const base = slugify(name);
    let awardId = base;
    for (let i = 2; i < 30; i++) {
      const existing = await ctx.db
        .query("honors")
        .withIndex("by_award_id", (q) => q.eq("awardId", awardId))
        .first();
      if (!existing) break;
      awardId = `${base}_${i}`;
    }
    const now = Date.now();
    const id = await ctx.db.insert("honors", {
      awardId,
      name,
      category: args.category,
      description,
      precedence: args.precedence,
      active: true,
      createdBy: me,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.create",
      target: `honors:${awardId}`,
      meta: JSON.stringify({ name, category: args.category }),
      createdAt: now,
    });
    return { id, awardId };
  },
});

export const updateHonor = mutation({
  args: {
    id: v.id("honors"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    precedence: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const honor = await ctx.db.get(args.id);
    if (!honor) throw new Error("Honor not found.");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const n = args.name.trim().slice(0, 120);
      if (n) patch.name = n;
    }
    if (args.description !== undefined) {
      const d = args.description.trim().slice(0, 1000);
      if (d) patch.description = d;
    }
    if (args.precedence !== undefined) patch.precedence = args.precedence;
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.update",
      target: `honors:${honor.awardId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteHonor = mutation({
  args: { id: v.id("honors") },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const honor = await ctx.db.get(args.id);
    if (!honor) throw new Error("Honor not found.");
    // Cascade: revoke every member award for this honor.
    const held = await ctx.db
      .query("memberAwards")
      .withIndex("by_award", (q) => q.eq("awardId", honor.awardId))
      .collect();
    for (const row of held) await ctx.db.delete(row._id);
    if (honor.imageStorageId) {
      try {
        await ctx.storage.delete(honor.imageStorageId);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.delete",
      target: `honors:${honor.awardId}`,
      meta: JSON.stringify({ name: honor.name, revoked: held.length }),
      createdAt: Date.now(),
    });
    return { ok: true, revoked: held.length };
  },
});

/** Attach the uploaded honor image (badge art / ribbon bar / medal render). */
export const attachHonorImage = mutation({
  args: {
    id: v.id("honors"),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    byteSize: v.number(),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const honor = await ctx.db.get(args.id);
    if (!honor) throw new Error("Honor not found.");
    if (!IMAGE_MIMES.includes(args.mimeType)) {
      throw new Error(`Unsupported image type: ${args.mimeType}`);
    }
    if (args.byteSize > IMAGE_MAX_BYTES) {
      throw new Error("Image exceeds the 5 MB limit.");
    }
    const old = honor.imageStorageId;
    await ctx.db.patch(args.id, {
      imageStorageId: args.storageId,
      imageMeta: {
        mimeType: args.mimeType,
        byteSize: args.byteSize,
        altText: args.altText?.slice(0, 200),
      },
      updatedAt: Date.now(),
    });
    if (old && old !== args.storageId) {
      try {
        await ctx.storage.delete(old);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.attach_image",
      target: `honors:${honor.awardId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeHonorImage = mutation({
  args: { id: v.id("honors") },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const honor = await ctx.db.get(args.id);
    if (!honor) throw new Error("Honor not found.");
    if (honor.imageStorageId) {
      try {
        await ctx.storage.delete(honor.imageStorageId);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.patch(args.id, {
      imageStorageId: undefined,
      imageMeta: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.remove_image",
      target: `honors:${honor.awardId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const honorImageUrl = query({
  args: { id: v.id("honors") },
  handler: async (ctx, args) => {
    const honor = await ctx.db.get(args.id);
    if (!honor?.imageStorageId) return null;
    return await ctx.storage.getUrl(honor.imageStorageId);
  },
});

/** Cover-art URL for a vault item (operator console preview). */
export const vaultCoverUrl = query({
  args: { id: v.id("vaultItems") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin" && !user?.opRole) return null;
    const item = await ctx.db.get(args.id);
    if (!item?.coverStorageId) return null;
    return await ctx.storage.getUrl(item.coverStorageId);
  },
});

// ---------------------------------------------------------------------------
// Awarding & revoking honors
// ---------------------------------------------------------------------------

export const listMembersForAward = query({
  args: { q: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin" && !user?.opRole) return null;
    const q = (args.q ?? "").trim().toLowerCase();
    const rows = await ctx.db.query("users").take(300);
    return rows
      .filter((u) => {
        const name = (u.displayName ?? u.name ?? u.email ?? "").toLowerCase();
        return !q || name.includes(q);
      })
      .slice(0, 25)
      .map((u) => ({
        _id: u._id,
        displayName: u.displayName ?? u.name ?? u.email ?? "Unknown",
      }));
  },
});

export const listMemberAwards = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin" && !user?.opRole) return null;
    const rows = await ctx.db
      .query("memberAwards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    rows.sort((a, b) => b.awardedAt - a.awardedAt);
    return rows;
  },
});

export const grantHonor = mutation({
  args: {
    userId: v.id("users"),
    awardId: v.string(),
    citation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const honor = await ctx.db
      .query("honors")
      .withIndex("by_award_id", (q) => q.eq("awardId", args.awardId))
      .first();
    if (!honor) throw new Error("Unknown honor.");
    if (honor.active === false) {
      throw new Error("This honor is retired and can no longer be awarded.");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Member not found.");

    const existing = await ctx.db
      .query("memberAwards")
      .withIndex("by_user_award", (q) =>
        q.eq("userId", args.userId).eq("awardId", args.awardId),
      )
      .first();
    if (existing) throw new Error("Member already holds this honor.");

    const now = Date.now();
    await ctx.db.insert("memberAwards", {
      userId: args.userId,
      awardId: args.awardId,
      awardedAt: now,
      awardedBy: me,
      citation: args.citation?.trim().slice(0, 500) || undefined,
    });
    await ctx.db.insert("notifications", {
      userId: args.userId,
      kind: "honor",
      title: "Honor conferred",
      body: `You have been awarded the ${honor.name}.${args.citation ? ` "${args.citation.slice(0, 200)}"` : ""}`,
      url: "/profile",
      createdAt: now,
    });
    await ctx.db.insert("activityFeed", {
      actorId: args.userId,
      verb: "honored",
      targetType: "honor",
      targetId: honor.awardId,
      summary: `was awarded the ${honor.name}`,
      url: "/profile",
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.grant",
      target: `memberAwards:${args.awardId}:${args.userId}`,
      meta: args.citation ? JSON.stringify({ citation: args.citation.slice(0, 200) }) : undefined,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const revokeHonor = mutation({
  args: { userId: v.id("users"), awardId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const row = await ctx.db
      .query("memberAwards")
      .withIndex("by_user_award", (q) =>
        q.eq("userId", args.userId).eq("awardId", args.awardId),
      )
      .first();
    if (!row) throw new Error("Member does not hold this honor.");
    await ctx.db.delete(row._id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "honors.revoke",
      target: `memberAwards:${args.awardId}:${args.userId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Public honor surfaces
// ---------------------------------------------------------------------------

/** Full catalog for the awards page / displays. */
export const listHonorsPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("honors").collect();
    rows.sort(
      (a, b) =>
        (a.precedence ?? 999) - (b.precedence ?? 999) ||
        a.createdAt - b.createdAt,
    );
    const counts = await Promise.all(
      rows.map(async (h) => {
        const holders = await ctx.db
          .query("memberAwards")
          .withIndex("by_award", (q) => q.eq("awardId", h.awardId))
          .collect();
        return holders.length;
      }),
    );
    return rows.map((h, i) => ({
      _id: h._id,
      awardId: h.awardId,
      name: h.name,
      category: h.category,
      description: h.description,
      precedence: h.precedence ?? null,
      active: h.active !== false,
      hasImage: !!h.imageStorageId,
      holders: counts[i],
    }));
  },
});

/**
 * A member's ribbon rack: held honors with catalog data joined, ordered by
 * precedence. Public — rendered on profiles and member dossiers.
 */
export const memberRibbonRack = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const held = await ctx.db
      .query("memberAwards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const enriched = await Promise.all(
      held.map(async (row) => {
        const honor = await ctx.db
          .query("honors")
          .withIndex("by_award_id", (q) => q.eq("awardId", row.awardId))
          .first();
        if (!honor) return null;
        let imageUrl: string | null = null;
        if (honor.imageStorageId) {
          imageUrl = await ctx.storage.getUrl(honor.imageStorageId);
        }
        return {
          awardId: row.awardId,
          name: honor.name,
          category: honor.category,
          description: honor.description,
          citation: row.citation ?? null,
          awardedAt: row.awardedAt,
          precedence: honor.precedence ?? 999,
          imageUrl,
        };
      }),
    );
    return enriched
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.precedence - b.precedence || b.awardedAt - a.awardedAt);
  },
});

// ---------------------------------------------------------------------------
// Quartermaster's Locker — vault items
// ---------------------------------------------------------------------------

export const listVaultAdmin = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin" && !user?.opRole) return null;
    const rows = await ctx.db.query("vaultItems").collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return await Promise.all(
      rows.map(async (item) => {
        const grants = await ctx.db
          .query("vaultGrants")
          .withIndex("by_item", (q) => q.eq("itemId", item.itemId))
          .collect();
        return {
          _id: item._id,
          itemId: item.itemId,
          name: item.name,
          kind: item.kind,
          description: item.description,
          classification: item.classification ?? null,
          active: item.active !== false,
          hasCover: !!item.coverStorageId,
          hasFile: !!item.fileStorageId,
          fileMeta: item.fileMeta ?? null,
          holders: grants.length,
        };
      }),
    );
  },
});

export const createVaultItem = mutation({
  args: {
    name: v.string(),
    kind: v.union(
      v.literal("blueprint"),
      v.literal("insignia"),
      v.literal("manual"),
      v.literal("artifact"),
    ),
    description: v.string(),
    classification: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const name = args.name.trim().slice(0, 160);
    const description = args.description.trim().slice(0, 2000);
    if (!name || !description) {
      throw new Error("Name and description are required.");
    }
    const base = slugify(name);
    let itemId = base;
    for (let i = 2; i < 30; i++) {
      const existing = await ctx.db
        .query("vaultItems")
        .withIndex("by_item_id", (q) => q.eq("itemId", itemId))
        .first();
      if (!existing) break;
      itemId = `${base}_${i}`;
    }
    const now = Date.now();
    const id = await ctx.db.insert("vaultItems", {
      itemId,
      name,
      kind: args.kind,
      description,
      classification: args.classification?.trim().slice(0, 60) || undefined,
      active: true,
      createdBy: me,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.create",
      target: `vaultItems:${itemId}`,
      meta: JSON.stringify({ name, kind: args.kind }),
      createdAt: now,
    });
    return { id, itemId };
  },
});

export const updateVaultItem = mutation({
  args: {
    id: v.id("vaultItems"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    classification: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found.");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const n = args.name.trim().slice(0, 160);
      if (n) patch.name = n;
    }
    if (args.description !== undefined) {
      const d = args.description.trim().slice(0, 2000);
      if (d) patch.description = d;
    }
    if (args.classification !== undefined) {
      patch.classification = args.classification.trim().slice(0, 60) || undefined;
    }
    if (args.active !== undefined) patch.active = args.active;
    await ctx.db.patch(args.id, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.update",
      target: `vaultItems:${item.itemId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteVaultItem = mutation({
  args: { id: v.id("vaultItems") },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found.");
    const grants = await ctx.db
      .query("vaultGrants")
      .withIndex("by_item", (q) => q.eq("itemId", item.itemId))
      .collect();
    for (const g of grants) await ctx.db.delete(g._id);
    for (const sid of [item.coverStorageId, item.fileStorageId]) {
      if (sid) {
        try {
          await ctx.storage.delete(sid);
        } catch {
          /* already gone */
        }
      }
    }
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.delete",
      target: `vaultItems:${item.itemId}`,
      meta: JSON.stringify({ name: item.name, revoked: grants.length }),
      createdAt: Date.now(),
    });
    return { ok: true, revoked: grants.length };
  },
});

export const attachVaultCover = mutation({
  args: {
    id: v.id("vaultItems"),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    byteSize: v.number(),
    altText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found.");
    if (!IMAGE_MIMES.includes(args.mimeType)) {
      throw new Error(`Unsupported image type: ${args.mimeType}`);
    }
    if (args.byteSize > IMAGE_MAX_BYTES) {
      throw new Error("Cover exceeds the 5 MB limit.");
    }
    const old = item.coverStorageId;
    await ctx.db.patch(args.id, {
      coverStorageId: args.storageId,
      coverMeta: {
        mimeType: args.mimeType,
        byteSize: args.byteSize,
        altText: args.altText?.slice(0, 200),
      },
      updatedAt: Date.now(),
    });
    if (old && old !== args.storageId) {
      try {
        await ctx.storage.delete(old);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.attach_cover",
      target: `vaultItems:${item.itemId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const attachVaultFile = mutation({
  args: {
    id: v.id("vaultItems"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    byteSize: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found.");
    if (args.byteSize > FILE_MAX_BYTES) {
      throw new Error("File exceeds the 25 MB limit.");
    }
    const old = item.fileStorageId;
    await ctx.db.patch(args.id, {
      fileStorageId: args.storageId,
      fileMeta: {
        fileName: args.fileName.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "payload",
        mimeType: args.mimeType,
        byteSize: args.byteSize,
      },
      updatedAt: Date.now(),
    });
    if (old && old !== args.storageId) {
      try {
        await ctx.storage.delete(old);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.attach_file",
      target: `vaultItems:${item.itemId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeVaultCover = mutation({
  args: { id: v.id("vaultItems") },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found.");
    if (item.coverStorageId) {
      try {
        await ctx.storage.delete(item.coverStorageId);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.patch(args.id, {
      coverStorageId: undefined,
      coverMeta: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeVaultFile = mutation({
  args: { id: v.id("vaultItems") },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found.");
    if (item.fileStorageId) {
      try {
        await ctx.storage.delete(item.fileStorageId);
      } catch {
        /* already gone */
      }
    }
    await ctx.db.patch(args.id, {
      fileStorageId: undefined,
      fileMeta: undefined,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Vault grants
// ---------------------------------------------------------------------------

export const grantVaultItem = mutation({
  args: {
    userId: v.id("users"),
    itemId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const item = await ctx.db
      .query("vaultItems")
      .withIndex("by_item_id", (q) => q.eq("itemId", args.itemId))
      .first();
    if (!item) throw new Error("Unknown vault item.");
    if (item.active === false) throw new Error("This item is retired.");
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Member not found.");
    const existing = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", args.userId).eq("itemId", args.itemId),
      )
      .first();
    if (existing) throw new Error("Member already holds this item.");
    const now = Date.now();
    await ctx.db.insert("vaultGrants", {
      userId: args.userId,
      itemId: args.itemId,
      grantedAt: now,
      grantedBy: me,
      note: args.note?.trim().slice(0, 300) || undefined,
    });
    await ctx.db.insert("notifications", {
      userId: args.userId,
      kind: "vault",
      title: "Asset delivered to your Locker",
      body: `${item.name} is now in your Quartermaster's Locker.`,
      url: "/collection",
      createdAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.grant",
      target: `vaultGrants:${args.itemId}:${args.userId}`,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const revokeVaultItem = mutation({
  args: { userId: v.id("users"), itemId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    const row = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", args.userId).eq("itemId", args.itemId),
      )
      .first();
    if (!row) throw new Error("Member does not hold this item.");
    await ctx.db.delete(row._id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.revoke",
      target: `vaultGrants:${args.itemId}:${args.userId}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Operator-brokered trade: moves a member's single grant of an item to
 * another member. The item is never duplicated — the row is reassigned.
 */
export const transferVaultItem = mutation({
  args: {
    itemId: v.string(),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireAdmin(ctx);
    if (args.fromUserId === args.toUserId) {
      throw new Error("Source and destination are the same member.");
    }
    const row = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", args.fromUserId).eq("itemId", args.itemId),
      )
      .first();
    if (!row) throw new Error("Source member does not hold this item.");
    const dest = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", args.toUserId).eq("itemId", args.itemId),
      )
      .first();
    if (dest) throw new Error("Destination member already holds this item.");
    const item = await ctx.db
      .query("vaultItems")
      .withIndex("by_item_id", (q) => q.eq("itemId", args.itemId))
      .first();
    const now = Date.now();
    await ctx.db.patch(row._id, {
      userId: args.toUserId,
      grantedAt: now,
      grantedBy: me,
      note: args.note?.trim().slice(0, 300) || "Transferred by the Quartermaster.",
    });
    if (item) {
      await ctx.db.insert("notifications", {
        userId: args.toUserId,
        kind: "vault",
        title: "Asset transferred to you",
        body: `${item.name} was transferred to your Locker by the Quartermaster.`,
        url: "/collection",
        createdAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "vault.transfer",
      target: `vaultGrants:${args.itemId}:${args.fromUserId}->${args.toUserId}`,
      createdAt: now,
    });
    return { ok: true };
  },
});

/** Public catalog of active vault items (the Locker's manifest). */
export const listVaultPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("vaultItems").collect();
    return rows
      .filter((r) => r.active !== false)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((item) => ({
        _id: item._id,
        itemId: item.itemId,
        name: item.name,
        kind: item.kind,
        description: item.description,
        classification: item.classification ?? null,
        hasCover: !!item.coverStorageId,
        hasFile: !!item.fileStorageId,
      }));
  },
});

/** My locker: granted items with cover URLs resolved. */
export const myLocker = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    const grants = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
    const enriched = await Promise.all(
      grants.map(async (g) => {
        const item = await ctx.db
          .query("vaultItems")
          .withIndex("by_item_id", (q) => q.eq("itemId", g.itemId))
          .first();
        if (!item) return null;
        let coverUrl: string | null = null;
        if (item.coverStorageId) {
          coverUrl = await ctx.storage.getUrl(item.coverStorageId);
        }
        return {
          _id: g._id,
          itemId: item.itemId,
          name: item.name,
          kind: item.kind,
          description: item.description,
          classification: item.classification ?? null,
          grantedAt: g.grantedAt,
          note: g.note ?? null,
          hasFile: !!item.fileStorageId,
          coverUrl,
        };
      }),
    );
    return enriched
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.grantedAt - a.grantedAt);
  },
});

/** Another member's public locker (profile dossier showcase). */
export const memberLocker = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const grants = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const enriched = await Promise.all(
      grants.map(async (g) => {
        const item = await ctx.db
          .query("vaultItems")
          .withIndex("by_item_id", (q) => q.eq("itemId", g.itemId))
          .first();
        if (!item) return null;
        let coverUrl: string | null = null;
        if (item.coverStorageId) {
          coverUrl = await ctx.storage.getUrl(item.coverStorageId);
        }
        return {
          itemId: item.itemId,
          name: item.name,
          kind: item.kind,
          classification: item.classification ?? null,
          coverUrl,
        };
      }),
    );
    return enriched.filter((x): x is NonNullable<typeof x> => x !== null);
  },
});

/** Download URL for a held vault item's payload file (owner or operator). */
export const vaultFileUrl = query({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    const isStaff = user?.role === "admin" || !!user?.opRole;
    const grant = await ctx.db
      .query("vaultGrants")
      .withIndex("by_user_item", (q) => q.eq("userId", me).eq("itemId", args.itemId))
      .first();
    if (!grant && !isStaff) return null; // only holders (or staff) get the payload
    const item = await ctx.db
      .query("vaultItems")
      .withIndex("by_item_id", (q) => q.eq("itemId", args.itemId))
      .first();
    if (!item?.fileStorageId) return null;
    return await ctx.storage.getUrl(item.fileStorageId);
  },
});
