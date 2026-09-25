import { query, mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireOperatorCapability } from "./admin";
import {
  SEED_FACTIONS,
  isValidFactionCategory,
  slugifyFactionName,
  type FactionCategoryKey,
} from "../lib/factions";

// ---- Public queries -------------------------------------------------------

/**
 * List all factions for the registry. If the DB has no factions yet, the
 * canon seed catalog is returned in-memory so the registry is never empty.
 * `stored` tells callers whether the data is persisted (false = seed fallback).
 * `needsCanonSync` is true when stored species rows predate the canon
 * charter (no species row yet, or a row whose description lacks the charter's
 * PHYSIOLOGY marker) — callers should run the ensureCanon bootstrap.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("factions").collect();
    if (docs.length === 0) {
      return {
        stored: false as const,
        needsCanonSync: true as const,
        items: SEED_FACTIONS.map((f) => ({
          _id: undefined as undefined,
          ...f,
          active: true,
          createdAt: 0,
          updatedAt: 0,
        })),
      };
    }
    const items = docs
      .filter((d) => d.active)
      .sort((a, b) => {
        const catCmp = (a.category ?? "").localeCompare(b.category ?? "");
        if (catCmp !== 0) return catCmp;
        return (a.order ?? 0) - (b.order ?? 0);
      });
    // Stored species rows are stale when:
    //  1. Fewer species rows exist than the charter provides (e.g. the table
    //     was seeded before the charter transcription, or a partial sync was
    //     interrupted) — the missing rows can never appear otherwise, or
    //  2. Any stored species description lacks the charter's PHYSIOLOGY
    //     section marker (pre-canon made-up text).
    // The detectable marker is the charter's own section header, so check 2
    // stays correct if the catalog grows (any charter-era row has it).
    const catalogSpeciesCount = SEED_FACTIONS.filter(
      (f) => f.category === "species",
    ).length;
    const storedSpecies = docs.filter((d) => d.category === "species");
    const needsCanonSync =
      storedSpecies.length < catalogSpeciesCount ||
      storedSpecies.some((d) => !d.description.includes("PHYSIOLOGY"));
    return { stored: true as const, needsCanonSync, items };
  },
});

// ---- Canon reconciliation ---------------------------------------------------

/**
 * Shared, idempotent reconcile of the stored factions table against the canon
 * catalog in src/lib/factions.ts. Used by the operator `seed` mutation and the
 * public `ensureCanon` bootstrap. Contract:
 *
 * - Missing canon factions (any category) are inserted.
 * - Species rows are reconciled in place: canon text, accent, icon, and order
 *   are refreshed from the "Delegate Species of the Orion Triangle" charter
 *   so catalog edits propagate without duplicating rows.
 * - Species no longer present in the charter are deactivated (never deleted).
 * - Non-species rows keep their insert-only contract: operator edits survive
 *   re-reconciles, and rows the operator deactivated are re-activated if the
 *   operator had not removed them from the catalog intentionally. (The
 *   operator-facing `seed` preserves `active` as-is; the public bootstrap
 *   re-activates canon rows so a stale deactivation cannot hide a species.)
 *
 * Returns { inserted, updated, reactivated, retired }.
 */
async function reconcileCanon(
  ctx: MutationCtx,
  opts: { reactivate: boolean },
): Promise<{ inserted: number; updated: number; reactivated: number; retired: number }> {
  const existing = await ctx.db.query("factions").collect();
  const bySlug = new Map(existing.map((d) => [d.slug, d]));
  const catalogSlugs = new Set(SEED_FACTIONS.map((f) => f.slug));
  const now = Date.now();
  let inserted = 0;
  let updated = 0;
  let reactivated = 0;
  let retired = 0;
  for (const f of SEED_FACTIONS) {
    const row = bySlug.get(f.slug);
    if (!row) {
      await ctx.db.insert("factions", {
        name: f.name,
        slug: f.slug,
        category: f.category,
        description: f.description,
        accent: f.accent,
        icon: f.icon,
        order: f.order,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
      continue;
    }
    // Species rows track the canon charter verbatim. Non-species rows keep
    // their original text (operator-authored), but a stored row that is
    // missing an icon only (e.g. seeded by an older build) is topped up
    // without touching name/description.
    if (f.category === "species") {
      if (
        row.description !== f.description ||
        row.accent !== f.accent ||
        row.icon !== f.icon ||
        (row.order ?? 0) !== f.order ||
        row.name !== f.name
      ) {
        await ctx.db.patch(row._id, {
          name: f.name,
          description: f.description,
          accent: f.accent,
          icon: f.icon,
          order: f.order,
          updatedAt: now,
        });
        updated++;
      }
    } else if (row.icon !== f.icon && f.icon && !row.icon) {
      await ctx.db.patch(row._id, { icon: f.icon, updatedAt: now });
      updated++;
    }
    // Reactivation is opt-in (public bootstrap) — see reconcileCanon docs.
    if (opts.reactivate && !row.active) {
      await ctx.db.patch(row._id, { active: true, updatedAt: now });
      reactivated++;
    }
  }
  // Retire species that are no longer part of the canon charter.
  for (const row of existing) {
    if (row.category !== "species" || !row.active) continue;
    if (!catalogSlugs.has(row.slug)) {
      await ctx.db.patch(row._id, { active: false, updatedAt: now });
      retired++;
    }
  }
  return { inserted, updated, reactivated, retired };
}

// ---- Public bootstrap -------------------------------------------------------

/**
 * Auth-free, idempotent canon bootstrap (the faction-registry counterpart to
 * the public Sol-sector seed in atlasSeed.ts).
 *
 * WHY PUBLIC: the factions table predates the canon charter transcription, so
 * stored species rows carry made-up pre-canon text. The operator `seed` below
 * would fix them, but it is operator-gated and has never run successfully —
 * the public registry keeps showing the old rows. This mutation lets any
 * visitor (typically via useFactionCanonSync) heal the registry without
 * credentials. It takes NO arguments and writes ONLY canon-derived data
 * (catalog names/text/accents/icons), so an anonymous caller cannot mutate
 * anything operator-authored. auditLog rows are skipped here (actorId is a
 * required user id); the operator-facing `seed` still writes them.
 */
export const ensureCanon = mutation({
  args: {},
  handler: async (ctx) => {
    const result = await reconcileCanon(ctx, { reactivate: true });
    return { ok: true, ...result };
  },
});

// ---- Operator mutations ---------------------------------------------------

/** Create or update a faction (operator only). */
export const upsert = mutation({
  args: {
    id: v.optional(v.id("factions")),
    name: v.string(),
    category: v.string(),
    description: v.string(),
    accent: v.string(),
    icon: v.optional(v.string()),
    order: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const name = args.name.trim();
    const description = args.description.trim();
    if (!name) throw new Error("Faction name is required.");
    if (!description) throw new Error("Faction description is required.");
    if (!isValidFactionCategory(args.category)) {
      throw new Error("Invalid faction category.");
    }
    if (!args.accent || !/^#[0-9a-fA-F]{6}$/.test(args.accent.trim())) {
      throw new Error("Accent must be a hex color like #00E5FF.");
    }
    const now = Date.now();
    const slug = slugifyFactionName(name);
    const data = {
      name,
      slug,
      category: args.category,
      description,
      accent: args.accent.trim(),
      icon: args.icon?.trim() || undefined,
      order: args.order ?? 0,
      active: args.active ?? true,
      updatedAt: now,
    };
    let id: string;
    if (args.id) {
      await ctx.db.patch(args.id, data);
      id = args.id;
    } else {
      id = await ctx.db.insert("factions", { ...data, createdAt: now });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.id ? "faction.update" : "faction.create",
      target: `faction:${id}`,
      meta: JSON.stringify({ name, slug, category: args.category }),
      createdAt: now,
    });
    return id;
  },
});

/** Delete a faction (operator only). */
export const remove = mutation({
  args: { id: v.id("factions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Faction not found.");
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "faction.delete",
      target: `faction:${args.id}`,
      meta: JSON.stringify({ name: existing.name, slug: existing.slug }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Toggle a faction's visibility (operator only). */
export const setActive = mutation({
  args: { id: v.id("factions"), active: v.boolean() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: args.active ? "faction.activate" : "faction.deactivate",
      target: `faction:${args.id}`,
      meta: JSON.stringify({ active: args.active }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Reseed the faction registry from the canon catalog (operator only).
 *
 * - Missing factions (any category) are inserted.
 * - Species rows are reconciled in place: canon text, accent, icon, and
 *   order are refreshed from the "Delegate Species of the Orion Triangle"
 *   charter so edits to the catalog propagate without duplicating rows.
 * - Legacy species no longer present in the charter (e.g. Gravethari,
 *   Veyrathi, Aru'areth) are deactivated, never deleted — operator-made
 *   factions outside the seed are untouched.
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "story_editor",
    ]);
    const result = await reconcileCanon(ctx, { reactivate: false });
    const now = Date.now();
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "faction.seed",
      target: `factions:${SEED_FACTIONS.length}`,
      meta: JSON.stringify({
        inserted: result.inserted,
        updated: result.updated,
        retired: result.retired,
      }),
      createdAt: now,
    });
    return { ...result, total: SEED_FACTIONS.length };
  },
});

export type FactionCategoryKeyPublic = FactionCategoryKey;