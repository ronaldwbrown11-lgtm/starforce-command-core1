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

export default crons;
