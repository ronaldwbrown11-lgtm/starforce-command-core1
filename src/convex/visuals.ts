import { mutation, query, env } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { requireOperatorCapability } from "./admin";
import { COVER_MIME_TYPES } from "./assets";
import { enforceUploadBudget } from "./uploadBudget";

// =========================================================================
// Visuals — the backend for the visual creation subsystem:
//   Visual Forge · Global upload system · Canon Image Library ·
//   Storyboard Builder · Artist Profiles · Canon approval workflow.
//
//   generateUploadUrl / createAsset   any signed-in member (artists submit;
//                                     operators publish immediately)
//   reviewAsset                       operator only — approve / reject /
//                                     needs_revision (the REQUIRED canon
//                                     approval workflow)
//   listAssets                        approved rows + your own (operators may
//                                     opt in to everything)
//   storyboards                       owner CRUD + export-to-gallery publish
//   artistProfiles                    self-service profiles, public roster
//
// Existing schemas (species, technology, missions) are untouched — cross-links
// are plain string tags on the asset row.
// =========================================================================

const OPERATOR_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

async function identity(ctx: QueryCtx | MutationCtx) {
  const me = await getAuthUserId(ctx);
  const user = me ? await ctx.db.get(me) : null;
  const isOperator =
    !!user &&
    (user.role === "admin" ||
      OPERATOR_CAPS.includes(String(user.opRole ?? "")));
  return { me, isOperator };
}

async function audit(
  ctx: MutationCtx,
  actor: Id<"users">,
  action: string,
  target: string,
) {
  await ctx.db.insert("auditLog", {
    actorId: actor,
    action,
    target,
    createdAt: Date.now(),
  });
}

/** Trim + bound an optional string field. */
function str(s: unknown, max = 200): string | undefined {
  const t = String(s ?? "").trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Resolve an asset's permanent public URL. The signed Convex URL from
 * getUrl() expires within the hour, so it is only used as an existence
 * probe — the returned URL is the stable /lab-image/<storageId> route
 * (served forever, immutable caching), the same route the labs use.
 */
async function url(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
): Promise<string | null> {
  const exists = await ctx.storage.getUrl(storageId);
  if (!exists) return null;
  const site = String(env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
  return site ? `${site}/lab-image/${storageId}` : exists;
}

// ---------------------------------------------------------------------------
// Global image upload system
// ---------------------------------------------------------------------------

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await identity(ctx);
    if (!me) throw new Error("Sign in to upload artwork.");
    const uploadUrl = await ctx.storage.generateUploadUrl();
    await audit(ctx, me, "visuals.generate_url", "storage");
    return uploadUrl;
  },
});

const ASSET_STRING_ARGS = {
  title: v.string(),
  description: v.optional(v.string()),
  kind: v.optional(v.string()),
  medium: v.optional(v.string()),
  folder: v.optional(v.string()),
  attribution: v.optional(v.string()),
  species: v.optional(v.string()),
  technology: v.optional(v.string()),
  faction: v.optional(v.string()),
  mission: v.optional(v.string()),
  era: v.optional(v.string()),
  downloadAllowed: v.optional(v.boolean()),
  fileName: v.optional(v.string()),
};

export const createAsset = mutation({
  args: { storageId: v.id("_storage"), ...ASSET_STRING_ARGS },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in to upload artwork.");
    const meta = await ctx.storage.getMetadata(args.storageId);
    if (!meta) throw new Error("Uploaded file not found — please try again.");
    const wrongType = !COVER_MIME_TYPES.includes(
      meta.contentType as (typeof COVER_MIME_TYPES)[number],
    );
    // Rejection paths RETURN { ok: false } instead of throwing: a thrown
    // mutation rolls back its own writes, which would resurrect the blob we
    // just deleted. Returning commits the delete and lets the client toast
    // the error message.
    if (wrongType) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // Best effort — the file is never referenced either way.
      }
      return {
        ok: false as const,
        error: "Images only (JPEG, PNG, WebP, AVIF).",
      };
    }
    // Membership-tier limits (per-file maxUploadMb + storageGb quota) —
    // see uploadBudget.ts. The blob is removed when the member is over
    // their limits so nothing dangles unreferenced.
    try {
      await enforceUploadBudget(ctx, me, meta.size);
    } catch (err) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // Best effort — the file is never referenced either way.
      }
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Upload rejected.",
      };
    }
    const title = str(args.title, 120);
    if (!title) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // Best effort — the file is never referenced either way.
      }
      return {
        ok: false as const,
        error: "A title is required for every artwork.",
      };
    }
    const now = Date.now();
    const status = isOperator ? "approved" : "pending";
    const id = await ctx.db.insert("visualAssets", {
      authorId: me,
      storageId: args.storageId,
      fileName: str(args.fileName, 140) ?? title,
      mimeType: meta.contentType ?? "application/octet-stream",
      byteSize: meta.size,
      title,
      description: str(args.description, 1000),
      kind: str(args.kind, 40) ?? "other",
      medium: str(args.medium, 60),
      folder: str(args.folder, 80),
      attribution: str(args.attribution, 80),
      species: str(args.species),
      technology: str(args.technology),
      faction: str(args.faction),
      mission: str(args.mission),
      era: str(args.era),
      status,
      downloadAllowed: args.downloadAllowed !== false,
      createdAt: now,
      updatedAt: now,
    });
    await audit(
      ctx,
      me,
      isOperator ? "visuals.create" : "visuals.submit",
      `visualAssets:${id}`,
    );
    return { ok: true as const, id, status };
  },
});

const ASSET_FILTER_ARGS = {
  search: v.optional(v.string()),
  kind: v.optional(v.string()),
  status: v.optional(v.string()),
  species: v.optional(v.string()),
  technology: v.optional(v.string()),
  faction: v.optional(v.string()),
  mission: v.optional(v.string()),
  era: v.optional(v.string()),
  artist: v.optional(v.string()),
  folder: v.optional(v.string()),
  mine: v.optional(v.boolean()),
  all: v.optional(v.boolean()), // operators: include other members' rows
  limit: v.optional(v.number()), // cap rows (featured widgets, previews)
};

type AssetFilters = {
  search?: string;
  kind?: string;
  status?: string;
  species?: string;
  technology?: string;
  faction?: string;
  mission?: string;
  era?: string;
  artist?: string;
  folder?: string;
  mine?: boolean;
  all?: boolean;
  limit?: number;
};

async function filterAssets(
  ctx: QueryCtx,
  args: AssetFilters,
  opts: { forceAll?: boolean } = {},
) {
  const { me, isOperator } = await identity(ctx);
  const rows = await ctx.db.query("visualAssets").collect();
  const q = String(args.search ?? "").trim().toLowerCase();
  const match = (v0: unknown, needle?: string) =>
    !needle ||
    String(v0 ?? "").toLowerCase() === needle.trim().toLowerCase();
  const visible = rows.filter(
    (d) =>
      d.status === "approved" ||
      (me !== null && d.authorId === me) ||
      ((args.all === true || opts.forceAll === true) && isOperator),
  );
  const filtered = visible.filter(
    (d) =>
      (!args.mine || (me !== null && d.authorId === me)) &&
      match(d.kind, args.kind) &&
      match(d.status, args.status) &&
      match(d.species, args.species) &&
      match(d.technology, args.technology) &&
      match(d.faction, args.faction) &&
      match(d.mission, args.mission) &&
      match(d.era, args.era) &&
      match(d.folder, args.folder) &&
      (!args.artist ||
        String(d.attribution ?? "")
          .toLowerCase()
          .includes(args.artist.trim().toLowerCase())) &&
      (!q ||
        [d.title, d.description, d.attribution, d.folder, d.medium, d.species]
          .map((s) => String(s ?? "").toLowerCase())
          .some((s) => s.includes(q))),
  )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(1, Math.min(args.limit ?? 300, 300)));
  const withUrls = await Promise.all(
    filtered.map(async (d) => ({ ...d, url: await url(ctx, d.storageId) })),
  );
  return withUrls.filter((d) => d.url !== null);
}

export const listAssets = query({
  args: ASSET_FILTER_ARGS,
  handler: async (ctx, args) => await filterAssets(ctx, args),
});

/** Operator canon-review queue: pending + needs-revision submissions. */
export const reviewQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const rows = await ctx.db.query("visualAssets").collect();
    const queue = rows
      .filter((d) => d.status === "pending" || d.status === "needs_revision")
      .sort((a, b) => a.createdAt - b.createdAt);
    return await Promise.all(
      queue.map(async (d) => ({ ...d, url: await url(ctx, d.storageId) })),
    );
  },
});

export const reviewAsset = mutation({
  args: {
    id: v.id("visualAssets"),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("needs_revision"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Artwork not found.");
    await ctx.db.patch(args.id, {
      status: args.decision,
      reviewNote: str(args.note, 500),
      updatedAt: Date.now(),
    });
    await audit(ctx, me, `visuals.${args.decision}`, `visualAssets:${args.id}`);
    return { ok: true as const };
  },
});

export const updateAssetMeta = mutation({
  args: {
    id: v.id("visualAssets"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    folder: v.optional(v.string()),
    attribution: v.optional(v.string()),
    downloadAllowed: v.optional(v.boolean()),
    species: v.optional(v.string()),
    technology: v.optional(v.string()),
    faction: v.optional(v.string()),
    mission: v.optional(v.string()),
    era: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in required.");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Artwork not found.");
    if (doc.authorId !== me && !isOperator) throw new Error("Forbidden.");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const title = str(args.title, 120);
      if (!title) throw new Error("A title is required.");
      patch.title = title;
    }
    for (const key of [
      "description",
      "folder",
      "attribution",
      "species",
      "technology",
      "faction",
      "mission",
      "era",
    ] as const) {
      if (args[key] !== undefined) patch[key] = str(args[key], key === "description" ? 1000 : 200);
    }
    if (args.downloadAllowed !== undefined)
      patch.downloadAllowed = args.downloadAllowed;
    await ctx.db.patch(args.id, patch);
    await audit(ctx, me, "visuals.update", `visualAssets:${args.id}`);
    return { ok: true as const };
  },
});

export const removeAsset = mutation({
  args: { id: v.id("visualAssets") },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in required.");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Artwork not found.");
    if (doc.authorId !== me && !isOperator) throw new Error("Forbidden.");
    await ctx.db.delete(args.id);
    try {
      await ctx.storage.delete(doc.storageId);
    } catch {
      // Orphan deletion failures are non-fatal — the row is already gone.
    }
    await audit(ctx, me, "visuals.remove", `visualAssets:${args.id}`);
    return { ok: true as const };
  },
});

// ---------------------------------------------------------------------------
// Storyboard Builder
// ---------------------------------------------------------------------------

const PANEL_ARGS = v.array(
  v.object({
    imageId: v.optional(v.id("visualAssets")),
    caption: v.optional(v.string()),
    scene: v.optional(v.string()),
  }),
);

export const listStoryboards = query({
  args: { mine: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    const rows = await ctx.db.query("storyboards").collect();
    const visible = rows
      .filter(
        (s) =>
          s.published ||
          (me !== null && s.authorId === me) ||
          (args.mine === true && isOperator),
      )
      .filter((s) => !args.mine || (me !== null && s.authorId === me))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return await Promise.all(
      visible.map(async (s) => {
        const panels = await Promise.all(
          s.panels.map(async (p) => {
            if (!p.imageId) return { ...p, url: null as string | null };
            const asset = await ctx.db.get(p.imageId);
            if (!asset) return { ...p, imageId: undefined, url: null };
            return {
              ...p,
              url: (await url(ctx, asset.storageId)) as string | null,
            };
          }),
        );
        return { ...s, panels };
      }),
    );
  },
});

export const saveStoryboard = mutation({
  args: {
    id: v.optional(v.id("storyboards")),
    title: v.string(),
    summary: v.optional(v.string()),
    panels: PANEL_ARGS,
    missionLink: v.optional(v.string()),
    speciesLink: v.optional(v.string()),
    characterLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in to build storyboards.");
    const title = str(args.title, 120);
    if (!title) throw new Error("A storyboard title is required.");
    if (args.panels.length > 24)
      throw new Error("A storyboard holds up to 24 panels.");
    // Every linked image must be visible to this author.
    for (const p of args.panels) {
      if (!p.imageId) continue;
      const asset = await ctx.db.get(p.imageId);
      if (!asset) throw new Error("One of the linked images no longer exists.");
      if (asset.status !== "approved" && asset.authorId !== me && !isOperator)
        throw new Error("One of the linked images is not available to you.");
    }
    const panels = args.panels.map((p) => ({
      imageId: p.imageId,
      caption: str(p.caption, 600),
      scene: str(p.scene, 200),
    }));
    const now = Date.now();
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Storyboard not found.");
      if (existing.authorId !== me && !isOperator)
        throw new Error("Forbidden.");
      await ctx.db.patch(args.id, {
        title,
        summary: str(args.summary, 1000),
        panels,
        missionLink: str(args.missionLink),
        speciesLink: str(args.speciesLink),
        characterLink: str(args.characterLink),
        updatedAt: now,
      });
      await audit(ctx, me, "visuals.storyboard_update", `storyboards:${args.id}`);
      return { ok: true as const, id: args.id };
    }
    const id = await ctx.db.insert("storyboards", {
      authorId: me,
      title,
      summary: str(args.summary, 1000),
      panels,
      missionLink: str(args.missionLink),
      speciesLink: str(args.speciesLink),
      characterLink: str(args.characterLink),
      published: false,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, me, "visuals.storyboard_create", `storyboards:${id}`);
    return { ok: true as const, id };
  },
});

/** Export to gallery — publishes the storyboard into the Canon Image Library. */
export const exportStoryboard = mutation({
  args: { id: v.id("storyboards"), publish: v.boolean() },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in required.");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Storyboard not found.");
    if (doc.authorId !== me && !isOperator) throw new Error("Forbidden.");
    await ctx.db.patch(args.id, {
      published: args.publish,
      updatedAt: Date.now(),
    });
    await audit(
      ctx,
      me,
      args.publish ? "visuals.export" : "visuals.unexport",
      `storyboards:${args.id}`,
    );
    return { ok: true as const };
  },
});

export const removeStoryboard = mutation({
  args: { id: v.id("storyboards") },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in required.");
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Storyboard not found.");
    if (doc.authorId !== me && !isOperator) throw new Error("Forbidden.");
    await ctx.db.delete(args.id);
    await audit(ctx, me, "visuals.storyboard_remove", `storyboards:${args.id}`);
    return { ok: true as const };
  },
});

// ---------------------------------------------------------------------------
// Artist Profiles
// ---------------------------------------------------------------------------

async function profilePhotoUrl(
  ctx: QueryCtx,
  photoAssetId: Id<"visualAssets"> | undefined,
): Promise<string | null> {
  if (!photoAssetId) return null;
  const asset = await ctx.db.get(photoAssetId);
  if (!asset) return null;
  return await url(ctx, asset.storageId);
}

export const myArtistProfile = query({
  args: {},
  handler: async (ctx) => {
    const { me } = await identity(ctx);
    if (!me) return null;
    const profile = await ctx.db
      .query("artistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();
    if (!profile) return null;
    return { ...profile, photoUrl: await profilePhotoUrl(ctx, profile.photoAssetId) };
  },
});

export const upsertArtistProfile = mutation({
  args: {
    displayName: v.string(),
    bio: v.optional(v.string()),
    mediums: v.optional(v.string()),
    commissionAvailable: v.boolean(),
    socialLinks: v.array(v.object({ label: v.string(), url: v.string() })),
    photoAssetId: v.optional(v.id("visualAssets")),
  },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    if (!me) throw new Error("Sign in to create an artist profile.");
    const displayName = str(args.displayName, 60);
    if (!displayName) throw new Error("A display name is required.");
    if (args.photoAssetId) {
      const asset = await ctx.db.get(args.photoAssetId);
      if (!asset) throw new Error("Profile photo not found.");
      if (asset.status !== "approved" && asset.authorId !== me && !isOperator)
        throw new Error("Profile photo is not available.");
    }
    const socialLinks = args.socialLinks
      .slice(0, 8)
      .map((l) => ({ label: str(l.label, 40) ?? "Link", url: str(l.url, 300) ?? "" }))
      .filter((l) => l.url);
    const now = Date.now();
    const existing = await ctx.db
      .query("artistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();
    const id = existing
      ? (await (async () => {
          await ctx.db.patch(existing._id, {
            displayName,
            bio: str(args.bio, 1200),
            mediums: str(args.mediums, 200),
            commissionAvailable: args.commissionAvailable,
            socialLinks,
            photoAssetId: args.photoAssetId,
            updatedAt: now,
          });
          return existing._id;
        })())
      : await ctx.db.insert("artistProfiles", {
          userId: me,
          displayName,
          bio: str(args.bio, 1200),
          mediums: str(args.mediums, 200),
          commissionAvailable: args.commissionAvailable,
          socialLinks,
          photoAssetId: args.photoAssetId,
          createdAt: now,
          updatedAt: now,
        });
    await audit(ctx, me, "visuals.artist_profile", `artistProfiles:${id}`);
    return { ok: true as const, id };
  },
});

export const removeArtistProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await identity(ctx);
    if (!me) throw new Error("Sign in required.");
    const existing = await ctx.db
      .query("artistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .first();
    if (!existing) return { ok: true as const, removed: false };
    await ctx.db.delete(existing._id);
    await audit(
      ctx,
      me,
      "visuals.artist_profile_remove",
      `artistProfiles:${existing._id}`,
    );
    return { ok: true as const, removed: true };
  },
});

export const listArtists = query({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("artistProfiles").collect();
    const assets = await ctx.db.query("visualAssets").collect();
    return await Promise.all(
      profiles.map(async (p) => {
        const mine = assets.filter((a) => a.authorId === p.userId);
        const approved = mine.filter((a) => a.status === "approved");
        return {
          userId: p.userId,
          displayName: p.displayName,
          bio: p.bio,
          mediums: p.mediums,
          commissionAvailable: p.commissionAvailable,
          photoUrl: await profilePhotoUrl(ctx, p.photoAssetId),
          approvedCount: approved.length,
          totalCount: mine.length,
          featuredUrl: approved[0]
            ? await url(ctx, approved[0].storageId)
            : null,
        };
      }),
    ).then((rows) =>
      rows.sort((a, b) => b.approvedCount - a.approvedCount),
    );
  },
});

export const artistProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const { me, isOperator } = await identity(ctx);
    const profile = await ctx.db
      .query("artistProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    const userDoc = await ctx.db.get(args.userId);
    const name =
      profile?.displayName ??
      String(
        (userDoc as { displayName?: string; name?: string } | null)
          ?.displayName ??
          (userDoc as { name?: string } | null)?.name ??
          "Fleet artist",
      );
    const all = await ctx.db.query("visualAssets").collect();
    const rows = all
      .filter(
        (a) =>
          a.authorId === args.userId &&
          (a.status === "approved" ||
            me === args.userId ||
            isOperator),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    const assets = await Promise.all(
      rows.map(async (a) => ({ ...a, url: await url(ctx, a.storageId) })),
    );
    return {
      profile: profile
        ? { ...profile, photoUrl: await profilePhotoUrl(ctx, profile.photoAssetId) }
        : null,
      userId: args.userId,
      displayName: name,
      socialLinks: profile?.socialLinks ?? [],
      commissionAvailable: profile?.commissionAvailable ?? false,
      assets: assets.filter((a) => a.url !== null),
      approvedCount: assets.filter((a) => a.status === "approved").length,
    };
  },
});
