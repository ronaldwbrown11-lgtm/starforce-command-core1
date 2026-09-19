import { query } from "./_generated/server";

const TABLES = [
  "users",
  "stories",
  "loreLibrary",
  "loreEntries",
  "missions",
  "storeProducts",
  "storeOrders",
  "forumThreads",
  "groups",
  "blogPosts",
  "contests",
  "messages",
  "activityFeed",
  "auditLog",
] as const;

// Read-only census: row count + newest document timestamp per table.
// Used to verify database health and restoration state. Exposes no PII.
export const tableCounts = query({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    const newest: Record<string, number | null> = {};
    for (const t of TABLES) {
      try {
        const rows = await ctx.db.query(t).take(1001);
        counts[t] = rows.length;
        let max = 0;
        for (const r of rows) if (r._creationTime > max) max = r._creationTime;
        newest[t] = max > 0 ? max : null;
      } catch {
        counts[t] = -1; // table missing on this deployment
        newest[t] = null;
      }
    }
    return { counts, newest };
  },
});
