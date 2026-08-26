import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v, type Infer } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Lore Library — bibles (PDF/DOC/TXT), image galleries, and subdomain-
// embedded lore databases. Public surface exposes only `approved` items.
// Member submissions land in `submitted` and are reviewed on the operator
// Lore Library desk. Operators can write directly (status `approved`).
// =========================================================================

export const LORE_TYPES = ["bible", "image", "database", "map"] as const;
export type LoreType = (typeof LORE_TYPES)[number];

export const LORE_STATUS = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "archived",
] as const;
type LoreStatus = (typeof LORE_STATUS)[number];

const fileMetaValidator = v.object({
  fileName: v.string(),
  mimeType: v.string(),
  byteSize: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});
export type LoreFileMeta = Infer<typeof fileMetaValidator>;

const coverMetaValidator = v.object({
  mimeType: v.string(),
  byteSize: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  altText: v.optional(v.string()),
});
export type LoreCoverMeta = Infer<typeof coverMetaValidator>;

// ---- Upload constraints --------------------------------------------------

const IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;
const DOC_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;
const LORE_FILE_MAX_BYTES = 25 * 1024 * 1024;

function validateLoreFile(loreType: string, meta: LoreFileMeta) {
  if (meta.byteSize > LORE_FILE_MAX_BYTES) {
    throw new Error(
      `File too large (${(meta.byteSize / (1024 * 1024)).toFixed(1)} MB; max 25 MB).`,
    );
  }
  const allowed =
    loreType === "image" || loreType === "map"
      ? IMAGE_MIME // image plates + lore maps are images only
      : [...DOC_MIME, ...IMAGE_MIME]; // bibles accept docs + image scans
  if (!(allowed as readonly string[]).includes(meta.mimeType)) {
    throw new Error(
      `Unsupported file type (${meta.mimeType}). Bibles accept PDF/DOC/DOCX/TXT/MD and images; image/map items accept images.`,
    );
  }
}

function validateDatabaseUrl(url: string | undefined) {
  if (!url) return;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    throw new Error("Database URL must be a valid http(s) URL (subdomain).");
  }
}

function asLoreStatus(value: string | undefined): LoreStatus {
  return (LORE_STATUS as readonly string[]).includes(value ?? "")
    ? (value as LoreStatus)
    : "approved";
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

type LibraryRow = {
  fileStorageId?: string | null | undefined;
  coverStorageId?: string | null | undefined;
};

async function decorate<T extends LibraryRow>(
  ctx: { storage: { getUrl(id: string): Promise<string | null> } },
  rows: T[],
) {
  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      fileUrl: r.fileStorageId ? await ctx.storage.getUrl(r.fileStorageId) : null,
      coverUrl: r.coverStorageId ? await ctx.storage.getUrl(r.coverStorageId) : null,
    })),
  );
}

// -------------------------------------------------------------------------
// Public queries — approved items only
// -------------------------------------------------------------------------

export const listLoreLibrary = query({
  args: {
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const type = args.type;
    const rows = type
      ? await ctx.db
          .query("loreLibrary")
          .withIndex("by_type_status", (q) =>
            q.eq("loreType", type).eq("status", "approved"),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("loreLibrary")
          .withIndex("by_status", (q) => q.eq("status", "approved"))
          .order("desc")
          .take(limit);
    return await decorate(ctx, rows);
  },
});

export const loreLibraryBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const all = await ctx.db.query("loreLibrary").take(500);
    const item = all.find((i) => i.slug === slug && i.status === "approved") ?? null;
    if (!item) return null;
    const [decorated] = await decorate(ctx, [item]);
    return decorated;
  },
});

// -------------------------------------------------------------------------
// Member submission
// -------------------------------------------------------------------------

export const submitLore = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    loreType: v.string(),
    faction: v.optional(v.string()),
    sector: v.optional(v.string()),
    era: v.optional(v.string()),
    classification: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileMeta: v.optional(fileMetaValidator),
    coverStorageId: v.optional(v.id("_storage")),
    coverMeta: v.optional(coverMetaValidator),
    databaseUrl: v.optional(v.string()),
    databaseName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required to submit lore.");
    if (!(LORE_TYPES as readonly string[]).includes(args.loreType)) {
      throw new Error("Invalid lore type.");
    }
    const title = args.title.trim();
    if (!title) throw new Error("Title is required.");
    if (!args.description.trim()) {
      throw new Error("A short description is required.");
    }
    if (args.loreType === "database" && !args.databaseUrl) {
      throw new Error("Lore databases need their subdomain URL.");
    }
    if (args.fileMeta) {
      validateLoreFile(args.loreType, args.fileMeta);
      if (!args.fileStorageId) {
        throw new Error("File metadata present but no file was uploaded.");
      }
    } else if (
      args.loreType !== "database" &&
      args.loreType !== "bible"
    ) {
      // image + map items require an uploaded image
      throw new Error(
        args.loreType === "map"
          ? "Lore maps need an uploaded image file."
          : "Lore images need an uploaded image file.",
      );
    }
    validateDatabaseUrl(args.databaseUrl);

    const id = await ctx.db.insert("loreLibrary", {
      title,
      slug: slugify(title),
      description: args.description.trim().slice(0, 480),
      loreType: args.loreType,
      status: "submitted",
      authorId: me,
      faction: args.faction || undefined,
      sector: args.sector || undefined,
      era: args.era || undefined,
      classification: args.classification || undefined,
      fileStorageId: args.fileStorageId,
      fileMeta: args.fileMeta,
      coverStorageId: args.coverStorageId,
      coverMeta: args.coverMeta,
      databaseUrl: args.databaseUrl,
      databaseName: args.databaseName,
      submittedAt: Date.now(),
      createdAt: Date.now(),
    });
    await ctx.db.insert("activityFeed", {
      actorId: me,
      verb: "submitted",
      targetType: "loreLibrary",
      targetId: id,
      url: "/operator/lore-library",
      summary: `${title} (${args.loreType})`,
      createdAt: Date.now(),
    });
    // Queue the AI canon-compliance scan; the verdict lands on the approval
    // desk a few seconds later. Best-effort — a scan failure never blocks
    // the submission itself.
    await ctx.scheduler
      .runAfter(0, api.canonScanner.scanSubmission, {
        target: { kind: "lore", id },
      })
      .catch(() => {
        // Best-effort — the submission is already recorded.
      });
    return { ok: true, id };
  },
});

export const myLoreSubmissions = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    const rows = await ctx.db
      .query("loreLibrary")
      .withIndex("by_author", (q) => q.eq("authorId", me))
      .order("desc")
      .take(100);
    return await decorate(ctx, rows);
  },
});

// -------------------------------------------------------------------------
// Operator surface
// -------------------------------------------------------------------------

const OPERATOR_CAPS = ["operator", "senior_operator", "lore_archivist"];

export const loreApprovalQueue = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const rows = await ctx.db
      .query("loreLibrary")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .order("desc")
      .take(args.limit ?? 50);
    return await decorate(ctx, rows);
  },
});

export const listAllLoreLibrary = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const rows = await ctx.db
      .query("loreLibrary")
      .order("desc")
      .take(args.limit ?? 200);
    const filtered = args.status
      ? rows.filter((r) => r.status === asLoreStatus(args.status))
      : rows;
    return await decorate(ctx, filtered);
  },
});

export const upsertLoreItem = mutation({
  args: {
    id: v.optional(v.id("loreLibrary")),
    title: v.string(),
    description: v.string(),
    loreType: v.string(),
    status: v.optional(v.string()),
    faction: v.optional(v.string()),
    sector: v.optional(v.string()),
    era: v.optional(v.string()),
    classification: v.optional(v.string()),
    fileStorageId: v.optional(v.id("_storage")),
    fileMeta: v.optional(fileMetaValidator),
    coverStorageId: v.optional(v.id("_storage")),
    coverMeta: v.optional(coverMetaValidator),
    databaseUrl: v.optional(v.string()),
    databaseName: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    featuredOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const title = args.title.trim();
    if (!title) throw new Error("Title is required.");
    if (!(LORE_TYPES as readonly string[]).includes(args.loreType)) {
      throw new Error("Invalid lore type.");
    }
    if (args.fileMeta) {
      validateLoreFile(args.loreType, args.fileMeta);
      if (!args.fileStorageId) {
        throw new Error("File metadata present but no file was uploaded.");
      }
    }
    validateDatabaseUrl(args.databaseUrl);
    const status = asLoreStatus(args.status ?? "approved");
    const now = Date.now();
    const fields = {
      title,
      slug: args.id ? undefined : slugify(title),
      description: args.description.trim().slice(0, 480),
      loreType: args.loreType,
      status,
      faction: args.faction || undefined,
      sector: args.sector || undefined,
      era: args.era || undefined,
      classification: args.classification || undefined,
      fileStorageId: args.fileStorageId,
      fileMeta: args.fileMeta,
      coverStorageId: args.coverStorageId,
      coverMeta: args.coverMeta,
      databaseUrl: args.databaseUrl,
      databaseName: args.databaseName,
      featured: args.featured,
      featuredOrder: args.featuredOrder,
      reviewedAt: status === "approved" ? now : undefined,
      reviewerId: status === "approved" ? me : undefined,
    };
    let id: string;
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Not found.");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { slug: _slug, ...patch } = fields;
      await ctx.db.patch(args.id, patch);
      id = args.id;
    } else {
      id = await ctx.db.insert("loreLibrary", {
        ...fields,
        slug: slugify(title),
        authorId: me,
        createdAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "loreLibrary.edit" : "loreLibrary.create",
      target: `loreLibrary:${id}`,
      meta: JSON.stringify({ loreType: args.loreType, status }),
      createdAt: now,
    });
    return { ok: true, id };
  },
});

// Author XP granted the first time a lore submission is approved (guarded by
// xpAwardedAt so re-approving never double-pays).
const LORE_APPROVED_XP = 25;

export const loreApprovalAction = mutation({
  args: {
    id: v.id("loreLibrary"),
    action: v.string(), // "approve" | "reject"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    if (!["approve", "reject"].includes(args.action)) {
      throw new Error("Invalid action.");
    }
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Not found.");
    const status = args.action === "approve" ? "approved" : "rejected";
    await ctx.db.patch(args.id, {
      status,
      reviewedAt: Date.now(),
      reviewerId: me,
    });
    // Notify the submitter of the outcome (skip when an operator wrote it
    // directly and is reviewing their own item).
    if (item.authorId !== me) {
      await ctx.db.insert("notifications", {
        userId: item.authorId,
        kind: args.action === "approve" ? "lore_approved" : "lore_rejected",
        title:
          args.action === "approve"
            ? "Your lore was approved"
            : "Your lore submission was not approved",
        body: item.title.slice(0, 140),
        url: args.action === "approve" ? `/lore/${item.slug}` : "/lore/submit",
        createdAt: Date.now(),
      });
      // Best-effort email of the verdict to the submitter.
      const author = await ctx.db.get(item.authorId);
      if (author?.email) {
        await ctx.scheduler
          .runAfter(0, api.email.sendVerdict, {
            to: author.email,
            kind: "lore",
            title: item.title,
            outcome: args.action === "approve" ? "approved" : "rejected",
            note: args.note,
          })
          .catch(() => {
            // Best-effort — the verdict is already recorded.
          });
      }
    }
    if (args.action === "approve") {
      await ctx.db.insert("activityFeed", {
        actorId: me,
        verb: "published_lore",
        targetType: "loreLibrary",
        targetId: args.id,
        url: `/lore/${item.slug}`,
        summary: item.title,
        createdAt: Date.now(),
      });
    }
    // Award author XP the first time a submission is approved. Guarded by
    // xpAwardedAt, and skipped when the reviewer is the author (no self-grants).
    if (args.action === "approve" && !item.xpAwardedAt && item.authorId !== me) {
      const author = await ctx.db.get(item.authorId);
      if (author) {
        await ctx.db.patch(item.authorId, {
          xp: (author.xp ?? 0) + LORE_APPROVED_XP,
        });
        await ctx.db.patch(args.id, { xpAwardedAt: Date.now() });
        await ctx.db.insert("auditLog", {
          actorId: me,
          action: "xp.grant",
          target: `user:${item.authorId}`,
          meta: JSON.stringify({
            source: "loreLibrary.approved",
            amount: LORE_APPROVED_XP,
            item: args.id,
          }),
          createdAt: Date.now(),
        });
      }
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `loreLibrary.${args.action}`,
      target: `loreLibrary:${args.id}`,
      meta: args.note ? JSON.stringify({ note: args.note }) : undefined,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const archiveLoreItem = mutation({
  args: { id: v.id("loreLibrary") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Not found.");
    await ctx.db.patch(args.id, {
      status: "archived",
      featured: false,
      featuredOrder: undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "loreLibrary.archive",
      target: `loreLibrary:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
