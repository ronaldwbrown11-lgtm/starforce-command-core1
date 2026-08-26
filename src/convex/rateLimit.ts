import type { MutationCtx } from "./_generated/server";

/**
 * Minimal fixed-window rate limiter backed by a Convex table.
 *
 * One row per (kind, key). Convex serializes writes per document, so the
 * read-modify-write below is race-safe across concurrent requests.
 *
 * Rows are small and bounded by the number of distinct identities that hit
 * each endpoint; they can be pruned from the `rateLimits` table (Convex
 * dashboard → Data tab) if they ever accumulate.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  kind: string,
  key: string,
  limit: number,
  windowMs: number,
  message = "Slow down — too many requests. Try again in a few minutes.",
): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_kind_key", (q) => q.eq("kind", kind).eq("key", key))
    .first();
  if (!row) {
    await ctx.db.insert("rateLimits", {
      kind,
      key,
      windowStart: now,
      count: 1,
    });
    return;
  }
  if (now - row.windowStart >= windowMs) {
    await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    return;
  }
  if (row.count >= limit) {
    throw new Error(message);
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}
