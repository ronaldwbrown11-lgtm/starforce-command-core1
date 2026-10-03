import { env, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { requireOperatorCapability } from "./admin";
import { COVER_MAX_BYTES, COVER_MIME_TYPES } from "./assets";
import {
  SPECIES_GROUPS,
  SPECIES_NAME_KEY,
  TECHNOLOGY_GROUPS,
  TECHNOLOGY_NAME_KEY,
  labKeys,
  labNumberKeys,
  type LabFieldGroup,
} from "../lib/labFields";

// =========================================================================
// Creator Labs — species (Biology Lab) + technology (Research Lab).
//
//   list*      public: approved rows, plus your own pending rows; operators
//              additionally see every pending row for review.
//   create*    any signed-in member. Operators publish immediately, members
//              enter the operator review queue (status "pending").
//   review*    operator: approve or reject (delete) a pending row.
//   remove*    operator: delete any row.
//   seed*      operator: bulk import from an uploaded CSV/JSON file. Rows are
//              sanitized against the field allowlist in src/lib/labFields.ts
//              and de-duplicated on the name column.
//
// Rows arrive as v.any() (same pattern as seedHelpers.ts) and are sanitized
// server-side against the field config — unknown columns are dropped before
// the document ever touches a table.
// =========================================================================

const OPERATOR_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

type Row = Record<string, unknown>;
type LabSpec = { table: string; groups: LabFieldGroup[]; nameKey: string };

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

/** Keep only known fields, trim strings, coerce numeric fields, require name. */
function sanitize(
  raw: unknown,
  groups: LabFieldGroup[],
  nameKey: string,
): Row {
  const keys = labKeys(groups);
  const numberKeys = new Set(labNumberKeys(groups));
  const src = (raw ?? {}) as Record<string, unknown>;
  const out: Row = {};
  for (const key of keys) {
    const value = src[key];
    if (value === null || value === undefined) continue;
    if (numberKeys.has(key)) {
      const n =
        typeof value === "number"
          ? value
          : Number(String(value).replace(/[^\d.-]/g, ""));
      if (!Number.isNaN(n) && String(value).trim() !== "") out[key] = n;
      continue;
    }
    const s = String(value).trim();
    if (s) out[key] = s.slice(0, 12000);
  }
  const name = String(out[nameKey] ?? "").trim();
  if (!name) throw new Error("A name is required for every entry.");
  out[nameKey] = name.slice(0, 160);
  return out;
}

async function listLab(
  ctx: QueryCtx,
  table: "speciesDatabase" | "technologyDatabase",
  nameKey: string,
  search?: string,
) {
  const { me, isOperator } = await identity(ctx);
  const all = (await ctx.db.query(table).collect()) as unknown as Row[];
  const q = (search ?? "").trim().toLowerCase();
  return all
    .filter(
      (d) =>
        d.status === "approved" ||
        (isOperator ?? false) ||
        (me !== null && d.authorId === me),
    )
    .filter(
      (d) =>
        !q ||
        String(d[nameKey] ?? "").toLowerCase().includes(q) ||
        String(d.classification ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) =>
      String(a[nameKey] ?? "").localeCompare(String(b[nameKey] ?? "")),
    )
    .map((d) => ({ ...d, pending: d.status !== "approved" }));
}

async function createInLab(
  ctx: MutationCtx,
  table: "speciesDatabase" | "technologyDatabase",
  spec: LabSpec,
  raw: unknown,
  action: string,
) {
  const { me, isOperator } = await identity(ctx);
  if (!me) throw new Error("Sign in to file an entry.");
  const doc = sanitize(raw, spec.groups, spec.nameKey);
  const now = Date.now();
  const status = isOperator ? "approved" : "pending";
  const id = await ctx.db.insert(table, {
    ...(doc as object),
    status,
    authorId: me,
    createdAt: now,
    updatedAt: now,
  } as never);
  await audit(ctx, me, action, `${table}:${id}`);
  return { ok: true as const, id, status };
}

async function reviewInLab(
  ctx: MutationCtx,
  table: "speciesDatabase" | "technologyDatabase",
  id: Id<"speciesDatabase"> | Id<"technologyDatabase">,
  approve: boolean,
  action: string,
) {
  const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
  const doc = await ctx.db.get(id as Id<typeof table>);
  if (!doc) throw new Error("Entry not found.");
  if (approve) {
    await ctx.db.patch(id as Id<typeof table>, {
      status: "approved",
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.delete(id as Id<typeof table>);
  }
  await audit(ctx, me, action, `${table}:${id}`);
  return { ok: true as const };
}

async function seedLab(
  ctx: MutationCtx,
  table: "speciesDatabase" | "technologyDatabase",
  spec: LabSpec,
  rawRows: unknown[],
  action: string,
) {
  const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
  const existing = (await ctx.db.query(table).collect()) as unknown as Row[];
  const seen = new Set(
    existing.map((d) => String(d[spec.nameKey] ?? "").toLowerCase()),
  );
  const now = Date.now();
  let inserted = 0;
  let skipped = 0;
  for (const raw of rawRows) {
    let doc: Row;
    try {
      doc = sanitize(raw, spec.groups, spec.nameKey);
    } catch {
      skipped++;
      continue;
    }
    const key = String(doc[spec.nameKey]).toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    await ctx.db.insert(table, {
      ...(doc as object),
      status: "approved",
      authorId: me,
      createdAt: now,
      updatedAt: now,
    } as never);
    inserted++;
  }
  await audit(ctx, me, action, `${table}:seed(${inserted})`);
  return { ok: true as const, inserted, skipped };
}

const SPECIES_SPEC: LabSpec = {
  table: "speciesDatabase",
  groups: SPECIES_GROUPS,
  nameKey: SPECIES_NAME_KEY,
};
const TECHNOLOGY_SPEC: LabSpec = {
  table: "technologyDatabase",
  groups: TECHNOLOGY_GROUPS,
  nameKey: TECHNOLOGY_NAME_KEY,
};

// ---------------------------------------------------------------------------
// Species — Biology Lab
// ---------------------------------------------------------------------------

export const listSpecies = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) =>
    listLab(ctx, "speciesDatabase", SPECIES_NAME_KEY, args.search),
});

export const createSpecies = mutation({
  args: { row: v.any() },
  handler: async (ctx, args) =>
    createInLab(ctx, "speciesDatabase", SPECIES_SPEC, args.row, "species.create"),
});

export const reviewSpecies = mutation({
  args: { id: v.id("speciesDatabase"), approve: v.boolean() },
  handler: async (ctx, args) =>
    reviewInLab(
      ctx,
      "speciesDatabase",
      args.id,
      args.approve,
      args.approve ? "species.approve" : "species.reject",
    ),
});

export const removeSpecies = mutation({
  args: { id: v.id("speciesDatabase") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Entry not found.");
    await ctx.db.delete(args.id);
    await audit(ctx, me, "species.remove", `speciesDatabase:${args.id}`);
    return { ok: true as const };
  },
});

export const seedSpecies = mutation({
  args: { rows: v.array(v.any()) },
  handler: async (ctx, args) =>
    seedLab(ctx, "speciesDatabase", SPECIES_SPEC, args.rows, "species.seed"),
});

// ---------------------------------------------------------------------------
// Technology — Research Lab
// ---------------------------------------------------------------------------

export const listTechnology = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) =>
    listLab(ctx, "technologyDatabase", TECHNOLOGY_NAME_KEY, args.search),
});

export const createTechnology = mutation({
  args: { row: v.any() },
  handler: async (ctx, args) =>
    createInLab(
      ctx,
      "technologyDatabase",
      TECHNOLOGY_SPEC,
      args.row,
      "technology.create",
    ),
});

export const reviewTechnology = mutation({
  args: { id: v.id("technologyDatabase"), approve: v.boolean() },
  handler: async (ctx, args) =>
    reviewInLab(
      ctx,
      "technologyDatabase",
      args.id,
      args.approve,
      args.approve ? "technology.approve" : "technology.reject",
    ),
});

export const removeTechnology = mutation({
  args: { id: v.id("technologyDatabase") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Entry not found.");
    await ctx.db.delete(args.id);
    await audit(ctx, me, "technology.remove", `technologyDatabase:${args.id}`);
    return { ok: true as const };
  },
});

export const seedTechnology = mutation({
  args: { rows: v.array(v.any()) },
  handler: async (ctx, args) =>
    seedLab(
      ctx,
      "technologyDatabase",
      TECHNOLOGY_SPEC,
      args.rows,
      "technology.seed",
    ),
});

// ---------------------------------------------------------------------------
// Image uploads — the lab upload widget.
//
// Flow (two-step, mirroring the assets.ts cover pipeline):
//   1. generateImageUploadUrl  — mints a short-lived Convex upload URL.
//   2. browser POSTs the file  — Convex stores it, returns a storageId.
//   3. finalizeImageUpload     — validates size/MIME against the cover rules
//      and returns the STABLE public URL
//      ("${CONVEX_SITE_URL}/lab-image/<storageId>") that gets pinned into the
//      row's image field. That URL is served forever by the HTTP route in
//      http.ts, unlike ctx.storage.getUrl() which expires within the hour.
//
// Any signed-in member may upload (image fields belong to their own entry);
// invalid files are deleted server-side before they can be referenced.
// Fields stay plain URL strings, so CSV seeds and pasted URLs keep working.
// ---------------------------------------------------------------------------

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await identity(ctx);
    if (!me) throw new Error("Sign in to upload an image.");
    const url = await ctx.storage.generateUploadUrl();
    await audit(ctx, me, "labs.generate_image_url", "storage");
    return url;
  },
});

export const finalizeImageUpload = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { me } = await identity(ctx);
    if (!me) throw new Error("Sign in to upload an image.");
    const file = await ctx.storage.getMetadata(args.storageId);
    if (!file) throw new Error("Uploaded file not found — please try again.");
    const size = file.size ?? 0;
    const contentType = String(file.contentType ?? "");
    const tooLarge = size > COVER_MAX_BYTES;
    const wrongType = !COVER_MIME_TYPES.includes(
      contentType as (typeof COVER_MIME_TYPES)[number],
    );
    if (tooLarge || wrongType) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // Best effort — the file is never referenced either way.
      }
      throw new Error(
        `Images only, up to ${COVER_MAX_BYTES / (1024 * 1024)} MB (${COVER_MIME_TYPES.join(
          ", ",
        )}).`,
      );
    }
    await audit(ctx, me, "labs.image_upload", `storage:${args.storageId}`);
    const siteUrl = String(env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
    if (!siteUrl) throw new Error("Deployment URL unavailable — try again.");
    return {
      storageId: args.storageId,
      url: `${siteUrl}/lab-image/${args.storageId}`,
      byteSize: size,
      contentType,
    };
  },
});

/**
 * Best-effort cleanup for abandoned lab uploads (the widget calls this when
 * an image the user uploaded this session is cleared, replaced, or the form
 * resets). Deliberately non-throwing for the two expected outcomes:
 *   - unauthenticated caller        → { removed: false }
 *   - still referenced by any row   → { removed: false }
 * so a post-submit reset (where the image IS now referenced) is a silent
 * no-op instead of a failed mutation. Anything else (a real storage failure)
 * still surfaces as an error.
 */
export const discardImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { me } = await identity(ctx);
    if (!me) return { removed: false };
    const needle = String(args.storageId);
    const inUse = async (table: "speciesDatabase" | "technologyDatabase") => {
      const rows = (await ctx.db.query(table).collect()) as unknown as Row[];
      return rows.some((d) =>
        Object.values(d).some(
          (value) => typeof value === "string" && value.includes(needle),
        ),
      );
    };
    if (
      (await inUse("speciesDatabase")) ||
      (await inUse("technologyDatabase"))
    ) {
      return { removed: false };
    }
    try {
      await ctx.storage.delete(args.storageId);
    } catch {
      // Already gone — discarding is idempotent.
    }
    await audit(ctx, me, "labs.image_discard", `storage:${args.storageId}`);
    return { removed: true };
  },
});
