import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { requireOperatorCapability } from "./admin";
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
