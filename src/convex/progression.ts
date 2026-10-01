import { internalMutation, query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { applyXpGain, recordPromotion } from "./economy";
import { QUEST_STEPS } from "./quest";
import {
  ADMIRAL_INACTIVITY_DAYS,
  ADMIRAL_SEAT_CAP,
  DAILY_XP_CAP,
  FLAG_OFFICER_MIN_XP,
  RANK_LADDER,
  XP_CATEGORIES,
  XP_RATES,
  clampXpForCategory,
  deriveRankKey,
  isRankKey,
  rankForXp,
  rankProgressInfo,
  rankSpec,
  utcDayKey,
  type XpCategory,
} from "../lib/ranks";

// =========================================================================
// Capped Star Force Progression System — backend (Deliverable A)
//
// Maps to the spec'd API surface (Convex mutations stand in for the
// POST endpoints; see docs/progression-system.md for the mapping table):
//   POST /api/onboarding/complete  → progression.onboardingComplete
//   POST /api/xp/add               → internal.progression.addXp  (server-to-server)
//   POST /api/admiral-queue/evaluate → internal.progression.evaluateAdmiralQueue
//                                      (registered as a daily cron in cronJobs.ts)
// =========================================================================

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Onboarding checklist (Deliverable A: OnboardingTasks)
// ---------------------------------------------------------------------------

/**
 * DERIVE the Ensign induction checklist from real activity — never from
 * stored flags — so the widget updates the moment each step is genuinely
 * done (same philosophy as the Cadet Induction quest).
 */
export async function deriveChecklist(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  user: Doc<"users">,
): Promise<Record<string, boolean>> {
  const [memberships, reactions, reports] = await Promise.all([
    ctx.db
      .query("groupMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("reactions")
      .withIndex("by_user_target", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("fleetReports")
      .withIndex("by_author_mission", (q) => q.eq("authorId", userId))
      .collect(),
  ]);

  return {
    profile: !!(
      user.displayName &&
      (user.bio || user.rank || user.fleet || user.avatarStorageId || user.flair)
    ),
    ship: !!user.shipClass,
    group: memberships.length > 0,
    react: reactions.length > 0,
    report: reports.length > 0,
    badge: (user.achievements ?? []).length > 0,
  };
}

function checklistSummary(done: Record<string, boolean>) {
  const total = QUEST_STEPS.length;
  const completedCount = QUEST_STEPS.filter((s) => done[s.key]).length;
  return {
    steps: QUEST_STEPS.map((s) => ({
      key: s.key,
      label: s.label,
      href: s.href,
      cta: s.cta,
      done: !!done[s.key],
    })),
    completedCount,
    total,
    percent: Math.round((completedCount / total) * 100),
    allDone: completedCount === total,
  };
}

async function queueRowFor(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("admiralQueue")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function ensureQueueRow(
  ctx: MutationCtx,
  userId: Id<"users">,
  totalXp: number,
  now: number,
) {
  const row = await queueRowFor(ctx, userId);
  if (!row) {
    if (totalXp < FLAG_OFFICER_MIN_XP) return null;
    await ctx.db.insert("admiralQueue", {
      userId,
      status: "waiting",
      totalXp,
      joinedAt: now,
      lastXpAt: now,
      updatedAt: now,
    });
    return null;
  }
  // Refresh the waitlist snapshot + inactivity clock.
  await ctx.db.patch(row._id, { totalXp, lastXpAt: now, updatedAt: now });
  return row;
}

/**
 * Full read/derive/patch evaluation for one member: syncs the onboarding
 * audit rows, re-derives the rank (checklist-gated Ensign promotion, ladder
 * promotions up to Captain, seat-aware Rear Admiral), and joins the Admiral
 * Queue at 35,000 XP. Safe to call from any mutation at any time.
 */
export async function evaluateMember(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<{ promoted: boolean; allDone: boolean; rankKey: string } | null> {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const now = Date.now();

  const done = await deriveChecklist(ctx, userId, user);
  const summary = checklistSummary(done);

  // Audit trail: persist a row for every derived-complete step.
  const existing = await ctx.db
    .query("onboardingTasks")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const have = new Set(existing.map((r) => r.taskKey));
  for (const step of QUEST_STEPS) {
    if (done[step.key] && !have.has(step.key)) {
      await ctx.db.insert("onboardingTasks", {
        userId,
        taskKey: step.key,
        label: step.label,
        completedAt: now,
        createdAt: now,
      });
    }
  }

  const queueRow = await queueRowFor(ctx, userId);
  const seatActive = queueRow?.status === "active";
  const totalXp = user.xp ?? 0;

  const nextKey = deriveRankKey({
    xp: totalXp,
    currentRankKey: user.rankKey,
    checklistComplete: summary.allDone,
    seatActive,
  });

  const prevKey = user.rankKey ?? null;
  const promoted = nextKey !== prevKey;
  const patch: Partial<Doc<"users">> = {};
  if (promoted) {
    patch.rankKey = nextKey;
    patch.rank = rankSpec(nextKey).label;
  }
  if (totalXp > FLAG_OFFICER_MIN_XP && (user.prestigeXp ?? 0) !== totalXp - FLAG_OFFICER_MIN_XP) {
    patch.prestigeXp = totalXp - FLAG_OFFICER_MIN_XP;
  }
  if (Object.keys(patch).length) await ctx.db.patch(userId, patch);
  if (promoted) await recordPromotion(ctx, userId, prevKey, nextKey, now);

  // Only actual Captains (or seated Rear Admirals) enter the queue — an
  // Ensign sitting on unspent XP, or an operator-assigned custom rank,
  // never joins the waitlist automatically.
  if (
    totalXp >= FLAG_OFFICER_MIN_XP &&
    (nextKey === "captain" || nextKey === "rear_admiral")
  ) {
    await ensureQueueRow(ctx, userId, totalXp, now);
  }

  return { promoted, allDone: summary.allDone, rankKey: promoted ? nextKey : (user.rankKey ?? nextKey) };
}

// ---------------------------------------------------------------------------
// Display rank resolution — one helper so every surface shows the same
// commissioned rank, label, and insignia image.
// ---------------------------------------------------------------------------

export interface DisplayRank {
  key: string;
  label: string;
  short: string;
  tier: number;
  flagOfficer: boolean;
  blurb: string;
  imageStorageId: Id<"_storage"> | null;
}

function initials(label: string): string {
  return label
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

/**
 * Resolve a member's commissioned rank for display: derives the ladder
 * position from XP + checklist state (so it is never stale), applies any
 * operator label override / insignia image from the `ranks` table, and
 * passes through operator-assigned custom ranks.
 */
export async function resolveDisplayRank(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  /** Pre-computed checklist result — skips re-deriving when the caller has it. */
  checklistAllDone?: boolean,
): Promise<DisplayRank> {
  // Fast path: operator-assigned custom ranks are outside the ladder.
  const stored = user.rankKey;
  if (stored && !isRankKey(stored) && stored !== "rear_admiral") {
    const row = await ctx.db
      .query("ranks")
      .withIndex("by_key", (q) => q.eq("key", stored))
      .unique();
    const label = row?.label ?? user.rank ?? stored;
    return {
      key: stored,
      label,
      short: initials(label),
      tier: row?.tier ?? 0,
      flagOfficer: false,
      blurb: row?.blurb ?? "",
      imageStorageId: row?.imageStorageId ?? null,
    };
  }

  let allDone: boolean;
  if (checklistAllDone !== undefined) {
    allDone = checklistAllDone;
  } else {
    const checklistDone = await deriveChecklist(ctx, user._id, user);
    allDone = QUEST_STEPS.every((s) => checklistDone[s.key]);
  }
  const key = deriveRankKey({
    xp: user.xp ?? 0,
    currentRankKey: stored,
    checklistComplete: allDone,
    seatActive: stored === "rear_admiral",
  });
  const row = await ctx.db
    .query("ranks")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (isRankKey(key)) {
    const spec = rankSpec(key);
    return {
      key,
      label: row?.label ?? spec.label,
      short: spec.short,
      tier: row?.tier ?? spec.tier,
      flagOfficer: spec.flagOfficer,
      blurb: row?.blurb ?? spec.blurb,
      imageStorageId: row?.imageStorageId ?? null,
    };
  }
  // Unreachable (deriveRankKey always returns a canonical key here), but
  // keep a safe fallback rather than ever rendering "undefined".
  const label = row?.label ?? user.rank ?? "Ensign";
  return {
    key,
    label,
    short: initials(label),
    tier: row?.tier ?? 0,
    flagOfficer: false,
    blurb: row?.blurb ?? "",
    imageStorageId: row?.imageStorageId ?? null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/onboarding/complete — Ensign → Lieutenant trigger
// ---------------------------------------------------------------------------

/**
 * Mark one induction checklist step complete. The step is VERIFIED against
 * real activity server-side before the row is written; when the checklist
 * hits 100% the member is auto-promoted from Ensign to Lieutenant
 * (spec §1.1) via evaluateMember.
 */
export const onboardingComplete = mutation({
  args: { taskKey: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user) throw new Error("Account not found.");

    const step = QUEST_STEPS.find((s) => s.key === args.taskKey);
    if (!step) throw new Error("Unknown onboarding task.");

    const done = await deriveChecklist(ctx, me, user);
    if (!done[step.key]) {
      throw new Error("That step isn't complete yet — complete the action first.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("onboardingTasks")
      .withIndex("by_user_task", (q) => q.eq("userId", me).eq("taskKey", step.key))
      .unique();
    if (!existing) {
      await ctx.db.insert("onboardingTasks", {
        userId: me,
        taskKey: step.key,
        label: step.label,
        completedAt: now,
        createdAt: now,
      });
    }

    const evaluation = await evaluateMember(ctx, me);
    const summary = checklistSummary(done);
    return {
      ok: true,
      taskKey: step.key,
      completedCount: summary.completedCount,
      total: summary.total,
      allDone: summary.allDone,
      promoted: evaluation?.promoted ?? false,
      rankKey: evaluation?.rankKey ?? (user.rankKey ?? "ensign"),
    };
  },
});

// ---------------------------------------------------------------------------
// POST /api/xp/add — categorized XP grants (server-to-server)
// ---------------------------------------------------------------------------

/**
 * Internal endpoint for granting XP with a source/category. Amounts are
 * clamped to the spec'd band for the category (§2); `category: "daily"`
 * counts against the hard 50 XP/day cap inside applyXpGain, and every grant
 * runs the ladder promotion evaluation (up to Captain) + Admiral Queue
 * join at 35,000 XP. Not callable from the client — members earn XP through
 * the real activity surfaces (missions, quests, signals, streaks, content).
 */
export const addXp = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    source: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Account not found.");
    const category: XpCategory = XP_CATEGORIES.includes(args.category as XpCategory)
      ? (args.category as XpCategory)
      : "other";
    const requested = clampXpForCategory(category, args.amount);
    if (requested <= 0) throw new Error("amount must be a positive number.");

    const granted = await applyXpGain(ctx, args.userId, requested, {
      source: args.source,
      category,
    });
    const after = await ctx.db.get(args.userId);
    return {
      ok: true,
      requested,
      granted,
      capped: granted < requested,
      totalXp: after?.xp ?? 0,
      rankKey: after?.rankKey ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// POST /api/admiral-queue/evaluate — seat assignment + inactivity decay
// ---------------------------------------------------------------------------

async function ensureRanks(ctx: MutationCtx) {
  const rows = await ctx.db.query("ranks").collect();
  const have = new Set(rows.map((r) => r.key));
  const now = Date.now();
  for (let i = 0; i < RANK_LADDER.length; i++) {
    const r = RANK_LADDER[i];
    if (have.has(r.key)) continue;
    await ctx.db.insert("ranks", {
      key: r.key,
      label: r.label,
      tier: r.tier,
      order: i,
      minXp: r.minXp,
      flagOfficer: r.flagOfficer,
      maxActiveSeats: r.flagOfficer ? ADMIRAL_SEAT_CAP : undefined,
      blurb: r.blurb,
      createdAt: now,
    });
  }
}

/**
 * Daily evaluation of the Rear Admiral Queue (cron target, §1.6):
 *  1. Inactivity decay — an active seat holder with zero XP for 45
 *     consecutive days loses the seat (→ Inactive Flag Officer).
 *  2. Reactivation — a flag officer who earns XP again returns to the
 *     eligible waitlist.
 *  3. Seat assignment — while active seats < 10, the highest-total-XP
 *     eligible Captain (≥35,000) on the waitlist is promoted.
 *  4. Rank healing — Ens whose checklist hit 100%, and legacy accounts the
 *     ladder hasn't stamped yet, get a full evaluation.
 */
export const evaluateAdmiralQueue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const revokeCutoff = now - ADMIRAL_INACTIVITY_DAYS * DAY_MS;
    await ensureRanks(ctx);

    const rows = await ctx.db.query("admiralQueue").collect();
    let activeCount = rows.filter((r) => r.status === "active").length;
    let revoked = 0;
    let reactivated = 0;
    let promotedCount = 0;

    // 1. Inactivity decay on active seats.
    for (const row of rows) {
      if (row.status !== "active") continue;
      const u = await ctx.db.get(row.userId);
      if (!u) continue;
      const lastXpAt = u.lastXpAt ?? row.seatGrantedAt ?? row.joinedAt;
      if (lastXpAt >= revokeCutoff) continue;

      await ctx.db.patch(row._id, {
        status: "inactive_flag_officer",
        seatRevokedAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(row.userId, {
        rankKey: "captain",
        rank: rankSpec("captain").label,
      });
      await ctx.db.insert("notifications", {
        userId: row.userId,
        kind: "rank",
        title: "Rear Admiral seat revoked",
        body: `Zero XP for ${ADMIRAL_INACTIVITY_DAYS} consecutive days — you now hold Inactive Flag Officer status. Earn XP to rejoin the waitlist.`,
        url: "/high-command",
        createdAt: now,
      });
      await ctx.db.insert("auditLog", {
        actorId: row.userId,
        action: "admiral.seat_revoked",
        target: `user:${row.userId}`,
        meta: JSON.stringify({ reason: "inactivity_45d" }),
        createdAt: now,
      });
      activeCount -= 1;
      revoked += 1;
    }

    // 2. Reactivate flag officers who earned XP again since revocation.
    for (const row of rows) {
      if (row.status !== "inactive_flag_officer") continue;
      const u = await ctx.db.get(row.userId);
      if (!u?.lastXpAt || !row.seatRevokedAt) continue;
      if (u.lastXpAt > row.seatRevokedAt) {
        await ctx.db.patch(row._id, { status: "waiting", updatedAt: now });
        reactivated += 1;
      }
    }

    // 3. Assign open seats to the highest-XP eligible Captains.
    const openSeats = Math.max(0, ADMIRAL_SEAT_CAP - activeCount);
    if (openSeats > 0) {
      const candidates: Array<{ row: (typeof rows)[number]; xp: number }> = [];
      for (const row of rows) {
        if (row.status !== "waiting") continue;
        const u = await ctx.db.get(row.userId);
        if (!u) continue;
        const xp = u.xp ?? 0;
        if (xp < FLAG_OFFICER_MIN_XP) continue;
        // Seats go to Captains (Fleet): legacy accounts resolve through the
        // XP ladder; Ens and operator-assigned custom ranks are skipped.
        const effectiveKey = u.rankKey ?? rankForXp(xp);
        if (effectiveKey !== "captain") continue;
        candidates.push({ row, xp });
      }
      candidates.sort((a, b) => b.xp - a.xp);
      for (const c of candidates.slice(0, openSeats)) {
        await ctx.db.patch(c.row._id, {
          status: "active",
          totalXp: c.xp,
          seatGrantedAt: now,
          updatedAt: now,
        });
        await ctx.db.patch(c.row.userId, {
          rankKey: "rear_admiral",
          rank: rankSpec("rear_admiral").label,
          prestigeXp: Math.max(0, c.xp - FLAG_OFFICER_MIN_XP),
        });
        await ctx.db.insert("notifications", {
          userId: c.row.userId,
          kind: "promotion",
          title: "Rear Admiral seat granted",
          body: `You now hold one of only ${ADMIRAL_SEAT_CAP} active flag-officer seats on the High Command.`,
          url: "/high-command",
          createdAt: now,
        });
        await recordPromotion(ctx, c.row.userId, "captain", "rear_admiral", now);
        promotedCount += 1;
        activeCount += 1;
      }
    }

    // 4. Rank healing pass — stamp legacy accounts, promote finished Ens.
    const allUsers = await ctx.db.query("users").collect();
    let evaluated = 0;
    for (const u of allUsers) {
      if (u.isAnonymous) continue;
      if (u.rankKey && u.rankKey !== "ensign") continue;
      await evaluateMember(ctx, u._id);
      evaluated += 1;
    }

    return {
      ok: true,
      activeSeats: activeCount,
      seatCap: ADMIRAL_SEAT_CAP,
      revoked,
      reactivated,
      promoted: promotedCount,
      evaluated,
      at: now,
    };
  },
});

// ---------------------------------------------------------------------------
// Dashboard queries (Deliverable B data sources)
// ---------------------------------------------------------------------------

/**
 * The signed-in member's full progression snapshot: rank badge, XP
 * progress toward the next rank, induction checklist, daily-cap usage, and
 * Admiral Queue standing. Returns null when signed out.
 */
export const myProgress = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (!user) return null;

    const done = await deriveChecklist(ctx, me, user);
    const checklist = checklistSummary(done);
    const totalXp = user.xp ?? 0;

    const queueRow = await queueRowFor(ctx, me);
    const resolved = await resolveDisplayRank(ctx, user, checklist.allDone);
    const onLadder = isRankKey(resolved.key);
    const progress = onLadder ? rankProgressInfo(resolved.key, totalXp) : null;

    // Daily engagement cap usage (UTC day).
    const day = utcDayKey(Date.now());
    const todayRows = await ctx.db
      .query("xpLedger")
      .withIndex("by_user_day", (q) => q.eq("userId", me).eq("day", day))
      .collect();
    // Engagement XP only — mirrors the cap accounting in applyXpGain.
    const todayXp = todayRows
      .filter((r) => r.category === "daily")
      .reduce((s, r) => s + r.amount, 0);

    // Waitlist position (1-based) among eligible Captains.
    const allRows = await ctx.db.query("admiralQueue").collect();
    const waiting = allRows
      .filter((r) => r.status === "waiting")
      .sort((a, b) => b.totalXp - a.totalXp);
    const queue = {
      status: queueRow?.status ?? null,
      position: queueRow
        ? queueRow.status === "active"
          ? null
          : Math.max(1, waiting.findIndex((r) => r._id === queueRow._id) + 1)
        : null,
      activeSeats: allRows.filter((r) => r.status === "active").length,
      seatCap: ADMIRAL_SEAT_CAP,
    };

    // Recent XP history for the dashboard feed.
    const recent = await ctx.db
      .query("xpLedger")
      .withIndex("by_user_created", (q) => q.eq("userId", me))
      .order("desc")
      .take(8);

    return {
      rankKey: resolved.key,
      rank: {
        key: resolved.key,
        label: resolved.label,
        short: resolved.short,
        tier: resolved.tier,
        blurb: resolved.blurb,
        flagOfficer: resolved.flagOfficer,
        imageStorageId: resolved.imageStorageId,
      },
      next: progress?.next
        ? {
            label: progress.next.label,
            tier: progress.next.tier,
            target: progress.target ?? progress.next.minXp,
            needed: progress.needed,
            // Ensigns advance by checklist, not XP — substitute that percent.
            percent:
              progress.current.key === "ensign"
                ? checklist.percent
                : progress.percent,
            progressBy: progress.current.key === "ensign" ? "checklist" : "xp",
          }
        : null,
      xp: totalXp,
      prestigeXp: user.prestigeXp ?? 0,
      checklist,
      daily: {
        used: todayXp,
        cap: DAILY_XP_CAP,
        remaining: Math.max(0, DAILY_XP_CAP - todayXp),
      },
      queue,
      recentXp: recent.map((r) => ({
        amount: r.amount,
        source: r.source,
        category: r.category,
        createdAt: r.createdAt,
      })),
      rates: XP_RATES,
    };
  },
});

/**
 * The High Command Council Table: active Rear Admiral seats (≤10) and the
 * top 5 Captains on the promotion waitlist.
 */
export const council = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("admiralQueue").collect();

    const activeRows = rows
      .filter((r) => r.status === "active")
      .sort((a, b) => (b.totalXp ?? 0) - (a.totalXp ?? 0));
    const seats: Array<{
      userId: string;
      name: string;
      fleet: string | null;
      xp: number;
      seatGrantedAt: number | null;
      lastXpAt: number | null;
    }> = [];
    for (const row of activeRows) {
      const u = await ctx.db.get(row.userId);
      if (!u) continue;
      seats.push({
        userId: row.userId,
        name: u.displayName ?? u.name ?? "Unknown officer",
        fleet: u.fleet ?? null,
        xp: u.xp ?? 0,
        seatGrantedAt: row.seatGrantedAt ?? null,
        lastXpAt: u.lastXpAt ?? null,
      });
    }

    const waitingRows = rows
      .filter((r) => r.status === "waiting")
      .sort((a, b) => b.totalXp - a.totalXp);
    const waitlist: Array<{
      userId: string;
      name: string;
      fleet: string | null;
      totalXp: number;
      joinedAt: number;
    }> = [];
    let waitlistTotal = 0;
    for (const row of waitingRows) {
      const u = await ctx.db.get(row.userId);
      if (!u) continue;
      // Only actual Captains wait for the flag — operator-assigned custom
      // ranks and un-promoted Ens never appear on the waitlist.
      const effectiveKey = u.rankKey ?? rankForXp(u.xp ?? 0);
      if (effectiveKey !== "captain") continue;
      waitlistTotal++;
      if (waitlist.length >= 5) continue;
      waitlist.push({
        userId: row.userId,
        name: u.displayName ?? u.name ?? "Unknown officer",
        fleet: u.fleet ?? null,
        totalXp: row.totalXp,
        joinedAt: row.joinedAt,
      });
    }

    return {
      seats,
      seatCap: ADMIRAL_SEAT_CAP,
      openSeats: Math.max(0, ADMIRAL_SEAT_CAP - seats.length),
      waitlist,
      waitlistTotal,
      inactiveFlagOfficers: rows.filter((r) => r.status === "inactive_flag_officer").length,
      flagOfficerMinXp: FLAG_OFFICER_MIN_XP,
    };
  },
});

/**
 * The rank catalog (Deliverable A `Ranks` table + ladder constants) with
 * live holder counts for the progression table.
 */
export const ranksCatalog = query({
  args: {},
  handler: async (ctx) => {
    const [users, rows] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("ranks").collect(),
    ]);
    const counts: Record<string, number> = {};
    for (const u of users) {
      if (u.isAnonymous) continue;
      const key = u.rankKey ?? rankForXp(u.xp ?? 0);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const rowByKey = new Map(rows.map((r) => [r.key, r]));

    // Canonical ladder first (DB row supplies operator label/image overrides),
    // then operator-created custom ranks (manual-assignment only).
    const canonical = RANK_LADDER.map((r, i) => {
      const row = rowByKey.get(r.key);
      return {
        key: r.key,
        label: row?.label ?? r.label,
        tier: row?.tier ?? r.tier,
        order: i,
        minXp: r.minXp,
        flagOfficer: r.flagOfficer,
        blurb: row?.blurb ?? r.blurb,
        imageStorageId: row?.imageStorageId ?? null,
        canonical: true as const,
        holderCount: counts[r.key] ?? 0,
      };
    });
    const custom = rows
      .filter((r) => !isRankKey(r.key))
      .sort((a, b) => a.tier - b.tier || a.order - b.order)
      .map((row) => ({
        key: row.key,
        label: row.label,
        tier: row.tier,
        order: row.order,
        minXp: row.minXp,
        flagOfficer: row.flagOfficer,
        blurb: row.blurb,
        imageStorageId: row.imageStorageId ?? null,
        canonical: false as const,
        holderCount: counts[row.key] ?? 0,
      }));

    return {
      seeded: rows.length > 0,
      ranks: [...canonical, ...custom],
      seatCap: ADMIRAL_SEAT_CAP,
      inactivityDays: ADMIRAL_INACTIVITY_DAYS,
      dailyCap: DAILY_XP_CAP,
      rates: XP_RATES,
    };
  },
});
