import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// =========================================================================
// Scheduled jobs
// =========================================================================

const crons = cronJobs();

// Weekly fleet digest (#20) — every Monday 14:00 UTC, best-effort Resend
// roundup of the week's stories, lore, missions, and upcoming events.
crons.weekly(
  "weekly-fleet-digest",
  { hourUTC: 14, minuteUTC: 0, dayOfWeek: "monday" },
  internal.digest.sendWeeklyDigest,
  {},
);

// Referral activation payouts — daily at 06:00 UTC. Pays referrers whose
// recruits have been active on the base for at least a day; idempotent
// (each recruit pays out exactly once, tracked via their referredBy marker).
crons.daily(
  "referral-payouts",
  { hourUTC: 6, minuteUTC: 0 },
  internal.engagement.payoutReferrals,
  {},
);

// Capped Star Force progression — daily Rear Admiral Queue evaluation at
// 05:30 UTC: applies the 45-day inactivity decay to active seats, then
// assigns open seats (hard cap 10) to the highest-XP eligible Captains.
// Also runs the rank-healing pass (Ensign checklist promotions + legacy
// account stamping) and seeds the ranks catalog.
crons.daily(
  "admiral-queue-evaluate",
  { hourUTC: 5, minuteUTC: 30 },
  internal.progression.evaluateAdmiralQueue,
  {},
);

export default crons;
