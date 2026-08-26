import { internalQuery } from "./_generated/server";

// =========================================================================
// Weekly digest data (Tier 2 — #20)
//
// Kept in its own file (no "use node") because queries cannot live in
// Node.js-runtime modules. The digest action (digest.ts) calls this via
// ctx.runQuery.
// =========================================================================

const WEEK_MS = 7 * 86_400_000;
const MAX_SUBSCRIBERS = 500;

export const weeklyDigestData = internalQuery({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - WEEK_MS;
    const users = await ctx.db.query("users").collect();
    const subscribers = users
      .filter(
        (u) =>
          !u.isAnonymous &&
          !!u.email &&
          !!u.emailVerificationTime &&
          !(u.emailOptOut ?? false),
      )
      .slice(0, MAX_SUBSCRIBERS)
      .map((u) => ({
        email: u.email as string,
        name: u.displayName ?? u.email!.split("@")[0] ?? "Recruit",
      }));

    const [stories, lore, transmissions, missions, events, threads] =
      await Promise.all([
        (await ctx.db.query("stories").collect()).filter(
          (s) => s.status === "published" && (s.publishedAt ?? 0) >= since,
        ),
        (await ctx.db.query("loreEntries").collect()).filter(
          (l) => l.createdAt >= since,
        ),
        (await ctx.db.query("transmissions").collect()).filter(
          (t) => (t.createdAt ?? 0) >= since,
        ),
        (await ctx.db.query("missions").collect()).filter(
          (m) => (m.createdAt ?? 0) >= since,
        ),
        (await ctx.db.query("calendarEvents").collect()).filter(
          (e) =>
            e.status !== "cancelled" &&
            e.scheduledAt >= Date.now() &&
            e.scheduledAt <= Date.now() + 7 * 86_400_000,
        ),
        (await ctx.db.query("forumThreads").collect())
          .filter((t) => (t.createdAt ?? 0) >= since)
          .slice(0, 5),
      ]);

    return {
      subscribers,
      stories: stories.slice(0, 5).map((s) => ({ title: s.title, slug: s.slug })),
      lore: lore.slice(0, 5).map((l) => ({ title: l.title, slug: l.slug })),
      transmissions: transmissions.slice(0, 3).map((t) => ({ title: t.title, slug: t.slug })),
      missions: missions.slice(0, 3).map((m) => ({ title: m.title, slug: m.slug })),
      events: events.slice(0, 3).map((e) => ({ title: e.title, scheduledAt: e.scheduledAt })),
      threads: threads.map((t) => ({ title: t.title, slug: t.slug })),
      weekStart: since,
    };
  },
});
