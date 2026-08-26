import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Achievement engine (Feature #2 — Achievement Badges)
//
// Badges are stored on the user document as an array of stable string ids.
// `awardAchievements` is idempotent: awarding an already-earned badge is a
// no-op, and each newly earned badge fires one notification. Rule-based
// badges (ranks, tenure, contribution counts) are recomputed lazily by
// `evaluateAchievements` after any XP/contribution grant site.
// =========================================================================

// Accounts created on or before this cutoff receive the Founder's Crest —
// the permanent early-member badge. Bump the date before a public launch
// window to honor charter members.
export const FOUNDERS_CUTOFF = Date.UTC(2026, 8, 1); // 2026-09-01T00:00:00Z

// Verified contributions required for the Fleet Commander badge.
export const FLEET_COMMANDER_CONTRIBUTIONS = 100;

// XP thresholds that unlock rank badges (kept in sync with social.rankProgress).
export const COMMANDER_RANK_XP = 4000;

// Server-side labels for notification copy (client catalog lives in
// src/lib/achievements.ts and must not be imported into Convex).
const BADGE_LABELS: Record<string, string> = {
  first_flight: "First Flight",
  lore_contributor: "Lore Contributor",
  crew_chief: "Crew Chief",
  explorer: "Frontier Explorer",
  veteran: "Veteran",
  archivist: "Imperial Archivist",
  first_story: "First Story",
  broadcaster: "Broadcaster",
  moderator: "Moderator",
  centurion: "Centurion",
  pioneer: "Pioneer",
  first_contact: "First Contact",
  starforge_artisan: "Starforge Artisan",
  temporal_investigator: "Temporal Investigator",
  fleet_commander: "Fleet Commander",
  founders_crest: "Founder's Crest",
};

const BADGE_BLURBS: Record<string, string> = {
  first_flight: "You posted your first activity feed transmission.",
  lore_contributor: "One of your lore entries was published to the archive.",
  crew_chief: "You reached the Commander rank.",
  explorer: "You filed a fleet report from an uncharted sector.",
  veteran: "One year of fleet service.",
  archivist: "You curated the Lore Spotlight.",
  first_story: "You submitted a story for review.",
  broadcaster: "You published a fleet transmission.",
  moderator: "You were granted moderating capabilities.",
  centurion: "One hundred days on the bridge.",
  pioneer: "You joined Star Force Base 1198 at launch.",
  first_contact: "You sent your first transmission to the community.",
  starforge_artisan: "One of your artworks was approved for the archive.",
  temporal_investigator: "You certified a discovery from the sector map.",
  fleet_commander: "You reached one hundred verified contributions.",
  founders_crest: "You are a charter member of Star Force Base 1198.",
};

/**
 * Award a set of badges to a user idempotently. Returns the ids that were
 * newly earned (empty when nothing changed). Newly earned badges each fire
 * a notification.
 */
export async function awardAchievements(
  ctx: MutationCtx,
  userId: Id<"users">,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  const user = await ctx.db.get(userId);
  if (!user) return [];
  const current = new Set(user.achievements ?? []);
  const fresh = Array.from(new Set(ids)).filter((id) => !current.has(id));
  if (!fresh.length) return [];
  await ctx.db.patch(userId, {
    achievements: [...current, ...fresh],
  });
  for (const id of fresh) {
    await ctx.db.insert("notifications", {
      userId,
      kind: "achievement",
      title: `Achievement unlocked: ${BADGE_LABELS[id] ?? id}`,
      body: BADGE_BLURBS[id] ?? "A new honor was added to your service record.",
      url: "/account",
      createdAt: Date.now(),
    });
  }
  return fresh;
}

/**
 * Increment a user's verified contribution counter (used by the Fleet
 * Commander badge). Call once per approved/verified contribution.
 */
export async function bumpContribution(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const count = (user.contributionCount ?? 0) + 1;
  await ctx.db.patch(userId, { contributionCount: count });
  if (count >= FLEET_COMMANDER_CONTRIBUTIONS) {
    await awardAchievements(ctx, userId, ["fleet_commander"]);
  }
}

/**
 * Recompute every rule-based badge for a user and award anything newly
 * earned. Cheap (no table scans); call after XP grants and tenure-relevant
 * events.
 */
export async function evaluateAchievements(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const want = new Set<string>();
  const xp = user.xp ?? 0;
  const ageDays = (Date.now() - user._creationTime) / 86_400_000;

  if (xp >= COMMANDER_RANK_XP) want.add("crew_chief");
  if (user._creationTime <= FOUNDERS_CUTOFF) want.add("founders_crest");
  if (ageDays >= 100) want.add("centurion");
  if (ageDays >= 365) want.add("veteran");
  if (user.role === "admin" || user.opRole) want.add("moderator");

  await awardAchievements(ctx, userId, [...want]);
}
