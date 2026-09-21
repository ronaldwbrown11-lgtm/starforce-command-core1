import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  applyXpGain,
  grantCredits,
  grantCreditsExact,
} from "./economy";
import { awardAchievements } from "./achievements";

// =========================================================================
// Member engagement layer
//
// Turns the First Watch activation guide into a tracked funnel, and adds
// the retention mechanics layered on top of the existing economy:
//
//   - First Watch objectives (derived from real account activity)
//   - Daily-visit streaks with best-streak tracking
//   - Personal Codex bookmarking of lore and stories
//   - Atlas exploration visits (Wayfarer badge)
//   - Referral codes with credit payouts on recruit activation
//
// Every reward flows through the standard economy helpers so tier XP
// multipliers and credit surges apply, and every credit grant lands in the
// audit log. All objectives are derived — nothing is a fake checkbox.
// =========================================================================

export const FIRST_WATCH_BONUS = { xp: 200, credits: 50 } as const;

/** Days a new recruit must remain active before the referrer is paid. */
const REFERRAL_ACTIVATION_MIN_DAYS = 1;
/** Credits paid to the referrer when a recruit activates. */
export const REFERRAL_REWARD_CREDITS = 100;
/** Credits paid to the new member for arriving via a referral. */
export const REFERRAL_NEWCOMER_CREDITS = 25;
/** Credits for a daily check-in; scales with streak length up to the cap. */
const STREAK_BASE_CREDITS = 5;
const STREAK_MAX_CREDITS = 25;
/** Streak day thresholds that pay milestone bonuses (once per threshold). */
const STREAK_MILESTONES: Record<number, number> = { 7: 50, 30: 250, 100: 1000 };
/** Days marked consecutive; gaps larger than this reset the chain. */
const STREAK_GRACE_DAYS = 1;

/** Local YYYY-MM-DD (UTC) for an epoch-ms timestamp. */
function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days between two UTC day keys (b - a). */
function daysBetween(a: string, b: string): number {
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / 86_400_000);
}

/** Generate a readable, collision-checked referral code, e.g. VEGA-7K2M. */
async function generateReferralCode(
  ctx: { db: any },
  seed: string,
): Promise<string> {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no lookalikes
  for (let attempt = 0; attempt < 24; attempt++) {
    let tail = "";
    for (let i = 0; i < 4; i++) {
      tail += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const base =
      (seed || "CADET").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6) ||
      "CADET";
    const code = `${base}-${tail}`;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q: any) => q.eq("referralCode", code))
      .first();
    if (!existing) return code;
  }
  return `SF${Date.now().toString(36).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// First Watch — activation funnel
// ---------------------------------------------------------------------------

/** Aggregate the boolean signals First Watch objectives are derived from. */
async function collectFirstWatchSignals(ctx: any, me: any) {
  const user = await ctx.db.get(me);
  if (!user) return null;

  const [loreApproved, stories, factionMemberships, orders, visits, progress] =
    await Promise.all([
      ctx.db
        .query("loreEntries")
        .withIndex("by_author", (q: any) => q.eq("authorId", me))
        .collect(),
      ctx.db.query("stories").filter((s: any) => s.authorId === me).collect(),
      ctx.db
        .query("groupMembers")
        .withIndex("by_user", (q: any) => q.eq("userId", me))
        .collect(),
      ctx.db
        .query("storeOrders")
        .withIndex("by_user", (q: any) => q.eq("userId", me))
        .collect(),
      ctx.db
        .query("atlasVisits")
        .withIndex("by_user", (q: any) => q.eq("userId", me))
        .collect(),
      ctx.db
        .query("storyProgress")
        .withIndex("by_user", (q: any) => q.eq("userId", me))
        .collect(),
    ]);

  const distinctSectors = new Set(visits.map((v: any) => v.sectorName));

  return {
    user,
    done: {
      orientation:
        progress.some((p: any) => p.percent >= 100) ||
        progress.length >= 3 ||
        (user.shipClass && (user.xp ?? 0) > 0) === true ||
        user.questClaimedAt != null,
      worlds: distinctSectors.size >= 3,
      lore: loreApproved.some((l: any) => l.status === "approved") ||
        stories.some(
          (s: any) => s.status === "approved" || s.status === "published",
        ),
      faction: factionMemberships.length > 0,
      artifact: orders.length > 0,
    },
  };
}

export const firstWatchStatus = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const signals = await collectFirstWatchSignals(ctx, me);
    if (!signals) return null;

    const objectives = [
      {
        key: "orientation",
        title: "Complete your Orientation Mission",
        body: "Run the Cadet Orientation on the mission board — it walks you through the Atlas, your Service Record, and your first entry.",
        cta: { label: "Open the mission board", href: "/missions" },
      },
      {
        key: "worlds",
        title: "Visit at least three worlds",
        body: "Click any world on the Star Atlas and its sector is logged to your exploration record. Three sectors unlocks your wayfinder's honor.",
        cta: { label: "Chart the Star Atlas", href: "/map" },
      },
      {
        key: "lore",
        title: "Create your first entry",
        body: "A character, a planet, a species, a relic, a starship, an event — whatever inspires you. Your entry becomes part of the galaxy forever.",
        cta: { label: "File your first entry", href: "/submit" },
      },
      {
        key: "faction",
        title: "Choose your faction",
        body: "Read the dossiers and pick the one that feels like home. Membership unlocks private channels, specialized missions, and cosmetic upgrades.",
        cta: { label: "Read the faction dossiers", href: "/fleet-registry" },
      },
      {
        key: "artifact",
        title: "Earn your first artifact",
        body: "Artifacts mark your journey — earned through missions, exploration, and creation. Your first one appears in your collection.",
        cta: { label: "Open the Requisition Depot", href: "/store" },
      },
    ];

    const doneMap = signals.done as Record<string, boolean>;
    const steps = objectives.map((o) => ({ ...o, done: !!doneMap[o.key] }));
    const allDone = steps.every((s) => s.done);

    return {
      steps,
      completedCount: steps.filter((s) => s.done).length,
      total: steps.length,
      allDone,
      claimed: !!signals.user.firstWatchClaimedAt,
      reward: FIRST_WATCH_BONUS,
    };
  },
});

export const claimFirstWatchReward = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user) throw new Error("Account not found.");
    if (user.firstWatchClaimedAt) {
      throw new Error("First Watch reward already claimed.");
    }

    const signals = await collectFirstWatchSignals(ctx, me);
    if (!signals) throw new Error("Account not found.");
    const d = signals.done;
    if (!(d.orientation && d.worlds && d.lore && d.faction && d.artifact)) {
      throw new Error("Complete every First Watch objective first.");
    }

    const now = Date.now();
    await ctx.db.patch(me, { firstWatchClaimedAt: now });
    const xp = await applyXpGain(ctx, me, FIRST_WATCH_BONUS.xp);
    await grantCredits(ctx, me, FIRST_WATCH_BONUS.credits, "first_watch");
    await awardAchievements(ctx, me, ["explorer"]);

    await ctx.db.insert("activityFeed", {
      actorId: me,
      verb: "published",
      targetType: "first_watch",
      targetId: String(me),
      summary: `completed their First Watch — five objectives, one galaxy. (+${xp} XP, +${FIRST_WATCH_BONUS.credits}★)`,
      createdAt: now,
    });

    return { xp, credits: FIRST_WATCH_BONUS.credits };
  },
});

// ---------------------------------------------------------------------------
// Daily streaks
// ---------------------------------------------------------------------------

/**
 * Called from the app shell whenever an authenticated app view mounts. Marks
 * today's visit, extends or resets the streak, and pays the daily credit +
 * any milestone bonus exactly once per day. Idempotent per UTC day.
 */
export const touchStreak = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (!user) return null;

    const today = dayKey(Date.now());
    if (user.streakLastDay === today) {
      return { streak: user.streakCount ?? 0, alreadyCounted: true };
    }

    const last = user.streakLastDay;
    const gap = last ? daysBetween(last, today) : Number.POSITIVE_INFINITY;
    // Grace: a missed day doesn't kill the chain (life happens); two or more
    // consecutive missed days reset it.
    const extended = gap === 1 || gap === STREAK_GRACE_DAYS;
    const streak = last ? (extended ? (user.streakCount ?? 0) + 1 : 1) : 1;
    const best = Math.max(streak, user.streakBest ?? 0);

    await ctx.db.patch(me, {
      streakCount: streak,
      streakLastDay: today,
      streakBest: best,
    });

    // Daily credit: 5★ scaling to 25★ at long streaks.
    const daily = Math.min(
      STREAK_BASE_CREDITS + Math.floor(streak / 5) * 5,
      STREAK_MAX_CREDITS,
    );
    await grantCredits(ctx, me, daily, `streak_day_${streak}`);

    // Milestone bonuses pay exactly once — they key on `streak`, and a
    // streak value is only ever reached once per chain.
    let milestone = 0;
    if (STREAK_MILESTONES[streak]) {
      milestone = STREAK_MILESTONES[streak];
      await grantCreditsExact(ctx, me, milestone, `streak_milestone_${streak}`);
    }

    return { streak, daily, milestone: milestone || undefined, best };
  },
});

/** Current streak snapshot for binder/profile surfaces. */
export const myStreak = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (!user) return null;
    const today = dayKey(Date.now());
    // A streak whose last day isn't today or yesterday is effectively broken;
    // display it as lapsed rather than live.
    const live =
      user.streakLastDay === today ||
      (user.streakLastDay != null &&
        daysBetween(user.streakLastDay, today) <= STREAK_GRACE_DAYS);
    return {
      streak: live ? (user.streakCount ?? 0) : 0,
      best: user.streakBest ?? 0,
      lastDay: user.streakLastDay ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Personal Codex
// ---------------------------------------------------------------------------

export const listCodex = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    return ctx.db
      .query("codexSaves")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .order("desc")
      .collect();
  },
});

export const toggleCodexSave = mutation({
  args: {
    entryType: v.union(v.literal("lore"), v.literal("story")),
    entryId: v.string(),
    title: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in to save entries to your codex.");
    const title = args.title.slice(0, 240);
    const slug = args.slug.slice(0, 240);
    if (!title || !slug) throw new Error("Missing entry details.");

    const existing = await ctx.db
      .query("codexSaves")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", me).eq("entryId", args.entryId),
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }
    await ctx.db.insert("codexSaves", {
      userId: me,
      entryType: args.entryType,
      entryId: args.entryId,
      title,
      slug,
      savedAt: Date.now(),
    });
    return { saved: true };
  },
});

export const isCodexSaved = query({
  args: { entryId: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return false;
    const row = await ctx.db
      .query("codexSaves")
      .withIndex("by_user_entry", (q) =>
        q.eq("userId", me).eq("entryId", args.entryId),
      )
      .first();
    return !!row;
  },
});

// ---------------------------------------------------------------------------
// Atlas exploration
// ---------------------------------------------------------------------------

export const myAtlasVisits = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    return ctx.db
      .query("atlasVisits")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
  },
});

/** Log a sector visit from the Star Atlas (deduped per user+sector). */
export const logAtlasVisit = mutation({
  args: { sectorName: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return { ok: false };
    const sector = args.sectorName.slice(0, 120);
    if (!sector) return { ok: false };

    const existing = await ctx.db
      .query("atlasVisits")
      .withIndex("by_user_sector", (q) =>
        q.eq("userId", me).eq("sectorName", sector),
      )
      .first();
    if (existing) return { ok: false, alreadyVisited: true };

    await ctx.db.insert("atlasVisits", {
      userId: me,
      sectorName: sector,
      visitedAt: Date.now(),
    });

    const visits = await ctx.db
      .query("atlasVisits")
      .withIndex("by_user", (q) => q.eq("userId", me))
      .collect();
    const firstTime = visits.length === 1;
    if (firstTime) {
      await awardAchievements(ctx, me, ["explorer"]);
    }
    return { ok: true, distinctSectors: visits.length };
  },
});

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

/** My referral code (lazily generated) + recruitment stats. */
export const myReferral = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (!user) return null;
    return {
      code: user.referralCode ?? null,
      count: user.referralCount ?? 0,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    };
  },
});

/**
 * Generates the caller's referral code on first request (queries can't
 * write, so the UI calls this once when the code is still null).
 */
export const ensureReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user) throw new Error("Account not found.");
    if (user.referralCode) return { code: user.referralCode };
    const code = await generateReferralCode(
      ctx,
      user.displayName ?? user.name ?? "CADET",
    );
    await ctx.db.patch(me, { referralCode: code });
    return { code };
  },
});

/**
 * Claim a referral code. Called once during onboarding; the newcomer gets a
 * welcome credit, and the referrer is paid when the recruit activates
 * (evaluated by the daily cron in digestData/cronJobs).
 */
export const claimReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user) throw new Error("Account not found.");
    if (user.referredBy) throw new Error("Referral already claimed.");

    const code = args.code.trim().toUpperCase().slice(0, 24);
    if (!code) throw new Error("Enter a referral code.");

    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
      .first();
    if (!referrer) throw new Error("No operator found with that code.");
    if (referrer._id === me) throw new Error("You can't refer yourself.");

    await ctx.db.patch(me, { referredBy: code });
    await grantCredits(ctx, me, REFERRAL_NEWCOMER_CREDITS, "referral_newcomer");
    await ctx.db.insert("notifications", {
      userId: referrer._id,
      kind: "referral",
      title: "New recruit inbound",
      body: `${user.displayName ?? user.name ?? "A cadet"} just activated under your code. Your bonus lands once they complete their first watch.`,
      url: "/account",
      createdAt: Date.now(),
    });
    return { ok: true, newcomerCredits: REFERRAL_NEWCOMER_CREDITS };
  },
});

// ---------------------------------------------------------------------------
// Push subscriptions (registration; delivery is the integration boundary)
// ---------------------------------------------------------------------------

export const registerPushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.optional(v.string()),
    auth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const endpoint = args.endpoint.slice(0, 1024);
    if (!endpoint.startsWith("https://")) {
      throw new Error("Invalid push endpoint.");
    }
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
      });
      return { ok: true };
    }
    await ctx.db.insert("pushSubscriptions", {
      userId: me,
      endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      ua: undefined,
      createdAt: now,
    });
    return { ok: true };
  },
});

export const removePushSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) return { ok: false };
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();
    if (existing && existing.userId === me) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Lore Arcs — operator-curated collaborative storylines
//
// Operators create arcs (multi-author storylines); members submit chapter
// contributions which render publicly only after operator approval. Canon
// integrity holds because approved chapters are the only ones ever shown.
// ---------------------------------------------------------------------------

/** Public list of open/active arcs with approved-chapter counts. */
export const listArcs = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("loreArcs")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const open = await ctx.db
      .query("loreArcs")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const arcs = [...rows, ...open].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.createdAt - b.createdAt,
    );
    return await Promise.all(
      arcs.map(async (arc) => {
        const approved = await ctx.db
          .query("arcContributions")
          .withIndex("by_arc_status", (q) =>
            q.eq("arcId", arc._id).eq("status", "approved"),
          )
          .collect();
        return {
          _id: arc._id,
          title: arc.title,
          slug: arc.slug,
          summary: arc.summary,
          status: arc.status,
          chapterCount: approved.length,
        };
      }),
    );
  },
});

/** One arc by slug with its approved chapters in order. */
export const getArcBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = args.slug.slice(0, 240);
    const arc = await ctx.db
      .query("loreArcs")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!arc || arc.status === "closed") return null;

    const chapters = await ctx.db
      .query("arcContributions")
      .withIndex("by_arc_status", (q) =>
        q.eq("arcId", arc._id).eq("status", "approved"),
      )
      .collect();
    chapters.sort((a, b) => a.createdAt - b.createdAt);
    const authors = await Promise.all(
      chapters.map(async (ch) => {
        const u = await ctx.db.get(ch.authorId);
        return u?.displayName ?? u?.name ?? "Unknown pilot";
      }),
    );
    return {
      arc: {
        _id: arc._id,
        title: arc.title,
        summary: arc.summary,
        status: arc.status,
      },
      chapters: chapters.map((ch, i) => ({
        _id: ch._id,
        title: ch.title,
        body: ch.body,
        chapterNumber: i + 1,
        author: authors[i],
        createdAt: ch.createdAt,
      })),
    };
  },
});

/** My pending/approved contributions across all arcs. */
export const myArcContributions = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    return ctx.db
      .query("arcContributions")
      .withIndex("by_author", (q) => q.eq("authorId", me))
      .order("desc")
      .collect();
  },
});

function slugifyArc(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// --- Operator arc management ----------------------------------------------

export const listAllArcsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin") return null;
    const arcs = await ctx.db.query("loreArcs").order("desc").collect();
    return await Promise.all(
      arcs.map(async (arc) => {
        const pending = await ctx.db
          .query("arcContributions")
          .withIndex("by_arc_status", (q) =>
            q.eq("arcId", arc._id).eq("status", "pending"),
          )
          .collect();
        const approved = await ctx.db
          .query("arcContributions")
          .withIndex("by_arc_status", (q) =>
            q.eq("arcId", arc._id).eq("status", "approved"),
          )
          .collect();
        return {
          _id: arc._id,
          title: arc.title,
          slug: arc.slug,
          summary: arc.summary,
          status: arc.status,
          createdAt: arc.createdAt,
          pendingCount: pending.length,
          approvedCount: approved.length,
        };
      }),
    );
  },
});

/** Pending contributions queue for operator review. */
export const listPendingContributions = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (user?.role !== "admin") return null;
    const rows = await ctx.db
      .query("arcContributions")
      .filter((r) => r.eq(r.field("status"), "pending"))
      .order("desc")
      .take(200);
    return await Promise.all(
      rows.map(async (row) => {
          const [arc, author] = await Promise.all([
            ctx.db.get(row.arcId),
            ctx.db.get(row.authorId),
          ]);
          return {
            _id: row._id,
            arcTitle: arc?.title ?? "Unknown arc",
            author: author?.displayName ?? author?.name ?? "Unknown",
            title: row.title,
            body: row.body,
            createdAt: row.createdAt,
          };
        }),
    );
  },
});

export const createArc = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    status: v.optional(v.union(v.literal("open"), v.literal("active"))),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (user?.role !== "admin") throw new Error("Forbidden.");
    const title = args.title.trim().slice(0, 160);
    const summary = args.summary.trim().slice(0, 2000);
    if (!title || !summary) throw new Error("Title and summary are required.");

    const base = slugifyArc(title);
    let slug = base;
    for (let i = 2; i < 30; i++) {
      const existing = await ctx.db
        .query("loreArcs")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();
      if (!existing) break;
      slug = `${base}-${i}`;
    }
    const now = Date.now();
    const id = await ctx.db.insert("loreArcs", {
      title,
      slug,
      summary,
      status: args.status ?? "open",
      createdBy: me,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "arc.create",
      target: `loreArcs:${id}`,
      meta: JSON.stringify({ title }),
      createdAt: now,
    });
    return { id, slug };
  },
});

export const updateArc = mutation({
  args: {
    id: v.id("loreArcs"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("open"), v.literal("active"), v.literal("closed")),
    ),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (user?.role !== "admin") throw new Error("Forbidden.");
    const arc = await ctx.db.get(args.id);
    if (!arc) throw new Error("Arc not found.");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const t = args.title.trim().slice(0, 160);
      if (t) patch.title = t;
    }
    if (args.summary !== undefined) {
      const s = args.summary.trim().slice(0, 2000);
      if (s) patch.summary = s;
    }
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.id, patch);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "arc.update",
      target: `loreArcs:${args.id}`,
      meta: JSON.stringify({ status: args.status ?? arc.status }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

export const deleteArc = mutation({
  args: { id: v.id("loreArcs") },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (user?.role !== "admin") throw new Error("Forbidden.");
    const arc = await ctx.db.get(args.id);
    if (!arc) throw new Error("Arc not found.");
    // Cascade: delete every contribution belonging to the arc.
    const contribs = await ctx.db
      .query("arcContributions")
      .withIndex("by_arc", (q) => q.eq("arcId", args.id))
      .collect();
    for (const c of contribs) await ctx.db.delete(c._id);
    await ctx.db.delete(args.id);
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "arc.delete",
      target: `loreArcs:${args.id}`,
      meta: JSON.stringify({ title: arc.title }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Member submits a chapter contribution to an arc. */
export const submitArcContribution = mutation({
  args: {
    arcId: v.id("loreArcs"),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in to contribute to an arc.");
    const arc = await ctx.db.get(args.arcId);
    if (!arc || arc.status === "closed") {
      throw new Error("This arc is closed to new contributions.");
    }
    const title = args.title.trim().slice(0, 160);
    const body = args.body.trim().slice(0, 20000);
    if (!title || body.length < 50) {
      throw new Error("A chapter needs a title and at least 50 characters of story.");
    }
    const now = Date.now();
    await ctx.db.insert("arcContributions", {
      arcId: args.arcId,
      authorId: me,
      title,
      body,
      status: "pending",
      createdAt: now,
    });
    await ctx.db.insert("notifications", {
      userId: me,
      kind: "arc",
      title: "Contribution received",
      body: `Your chapter "${title}" is in the review queue for ${arc.title}.`,
      url: `/arcs/${arc.slug}`,
      createdAt: now,
    });
    return { ok: true };
  },
});

/** Operator approves/rejects a contribution. Approval grants credits + XP. */
export const reviewArcContribution = mutation({
  args: {
    id: v.id("arcContributions"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (user?.role !== "admin") throw new Error("Forbidden.");
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Contribution not found.");
    if (row.status !== "pending") {
      throw new Error("Already reviewed.");
    }
    const now = Date.now();
    if (args.action === "approve") {
      await ctx.db.patch(args.id, {
        status: "approved",
        reviewNote: args.note?.slice(0, 500),
        reviewedAt: now,
      });
      const xp = await applyXpGain(ctx, row.authorId, 100);
      await grantCredits(ctx, row.authorId, 50, `arc_chapter:${row.title.slice(0, 40)}`);
      await ctx.db.insert("notifications", {
        userId: row.authorId,
        kind: "arc",
        title: "Chapter approved",
        body: `"${row.title}" is now canon in the arc. +100 XP, +50★.`,
        url: "/arcs",
        createdAt: now,
      });
      await ctx.db.insert("activityFeed", {
        actorId: row.authorId,
        verb: "published_lore",
        targetType: "arc_chapter",
        targetId: String(row._id),
        summary: `published chapter "${row.title}"`,
        url: "/arcs",
        createdAt: now,
      });
    } else {
      await ctx.db.patch(args.id, {
        status: "rejected",
        reviewNote: args.note?.slice(0, 500),
        reviewedAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: row.authorId,
        kind: "arc",
        title: "Chapter returned",
        body: `"${row.title}" was returned by the Bridge.${args.note ? ` Note: ${args.note.slice(0, 300)}` : ""}`,
        url: "/arcs",
        createdAt: now,
      });
    }
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `arc.${args.action}`,
      target: `arcContributions:${args.id}`,
      createdAt: now,
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Referral activation payout — runs from the daily cron
// ---------------------------------------------------------------------------

/**
 * Pays referrers whose recruits have now activated (been on the base at
 * least a day and completed their First Watch). Idempotent: it clears the
 * recruit's `referredBy` marker as it pays, so a recruit never pays out
 * twice. Wires into the existing digest cron schedule.
 */
export const payoutReferrals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const recruits = await ctx.db
      .query("users")
      .order("desc")
      .take(500)
      .then((rows: any[]) =>
        rows.filter(
          (r) =>
            r.referredBy &&
            Date.now() - r._creationTime >=
              REFERRAL_ACTIVATION_MIN_DAYS * 86_400_000,
        ),
      );

    let paid = 0;
    for (const recruit of recruits) {
      const code = recruit.referredBy as string;
      const referrer = await ctx.db
        .query("users")
        .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
        .first();
      if (!referrer) {
        await ctx.db.patch(recruit._id, { referredBy: undefined });
        continue;
      }
      await grantCreditsExact(
        ctx,
        referrer._id,
        REFERRAL_REWARD_CREDITS,
        `referral_reward:${recruit.displayName ?? recruit._id}`,
      );
      await ctx.db.patch(referrer._id, {
        referralCount: (referrer.referralCount ?? 0) + 1,
      });
      await ctx.db.patch(recruit._id, { referredBy: undefined });
      await ctx.db.insert("notifications", {
        userId: referrer._id,
        kind: "referral",
        title: "Recruit activated",
        body: `Your recruit ${recruit.displayName ?? "has"} completed their first day. +${REFERRAL_REWARD_CREDITS}★ paid.`,
        url: "/account",
        createdAt: Date.now(),
      });
      paid++;
    }
    return { paid };
  },
});

