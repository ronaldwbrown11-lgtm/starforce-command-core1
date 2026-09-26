import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import { enforceRateLimit } from "./rateLimit";
import { CONTEST_JURY_CAPS } from "./contests";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Wings reward system — main-site side of the Fleet Registry integration.
//
// Division of responsibility (per the registry contract):
//   • Main site decides WHO has earned wings and WHEN; it mints single-use
//     claim tokens into its own `wingClaims` table (never the registry's).
//   • The Fleet Registry (fleetregistry.starforcebase1198.com) verifies the
//     tokens and stores the PERMANENT member→fighter assignment. Its public
//     API is CORS-open, so the BROWSER talks to it directly (see
//     src/lib/fleetRegistry.ts) — no server relay, no WAF trouble.
//   • This module is main-site bookkeeping only: issuance, earning rules,
//     and the burn record. Registry tables are never written directly.
//
// Token format (must match exactly): 43–64 chars, URL-safe — 32 random
// bytes, base64url-encoded. Single-use, 24h expiry enforced by the registry.
// =========================================================================

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // informational only; registry enforces
const MAX_REASON_LENGTH = 200;

/** 32 random bytes → 43-char URL-safe base64url token (contract format). */
function mintToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// Shared mint helper — used by operator issuance, contest judging, report
// certification, and the XP self-claim. Guarded: at most one OUTSTANDING
// (unconsumed) claim per member at a time; re-earning after consuming mints
// fresh eligibility.
// ---------------------------------------------------------------------------

export const CONVEX_ID_LENGTH = 25;

export async function mintClaimFor(
  ctx: MutationCtx,
  opts: {
    memberId: string;
    memberName: string;
    reason: string;
    issuedBy: Id<"users">;
    auditAction: string;
  },
): Promise<{ tokenId: Id<"wingClaims">; token: string; expiresAt: number }> {
  const memberId = opts.memberId.trim();
  if (!memberId || memberId.length > 64) {
    throw new Error("Member id is required (max 64 characters).");
  }
  const memberName = opts.memberName.trim();
  if (!memberName || memberName.length > 80) {
    throw new Error("Member name is required (max 80 characters).");
  }
  const reason = opts.reason.trim();
  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error(`Reason too long (max ${MAX_REASON_LENGTH} characters).`);
  }

  // At most one outstanding claim per member: an unconsumed token means the
  // ceremony link is still live. Consumed claims never block a new one.
  const recent = await ctx.db
    .query("wingClaims")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .order("desc")
    .take(5);
  if (recent.some((c) => !c.consumed)) {
    throw new Error(
      "This member already has an unconsumed claim token outstanding.",
    );
  }

  let token = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = mintToken();
    const existing = await ctx.db
      .query("wingClaims")
      .withIndex("by_token", (q) => q.eq("token", candidate))
      .first();
    if (!existing) {
      token = candidate;
      break;
    }
  }
  if (!token) throw new Error("Could not mint a unique token — try again.");

  const issuedAt = Date.now();
  const tokenId = await ctx.db.insert("wingClaims", {
    memberId,
    memberName,
    reason: reason || undefined,
    token,
    issuedAt,
    issuedBy: opts.issuedBy,
  });
  await ctx.db.insert("auditLog", {
    actorId: opts.issuedBy,
    action: opts.auditAction,
    target: `member:${memberId}`,
    meta: JSON.stringify({ memberName, reason: reason || undefined, tokenId }),
    createdAt: issuedAt,
  });
  return { tokenId, token, expiresAt: issuedAt + TOKEN_TTL_MS };
}

/** Notification + activity entry for a freshly minted claim. */
export async function notifyWingsIssued(
  ctx: MutationCtx,
  opts: {
    memberId: string;
    memberName: string;
    token: string;
    reason: string;
  },
): Promise<void> {
  if (opts.memberId.length !== CONVEX_ID_LENGTH) return;
  const userId = opts.memberId as Id<"users">;
  const user = await ctx.db.get(userId);
  if (!user) return;
  const url = `/wings?claim=${encodeURIComponent(opts.token)}`;
  await ctx.db.insert("notifications", {
    userId,
    kind: "wings_issued",
    title: "You have earned your wings",
    body: `The Bridge has awarded your wings${
      opts.reason ? ` — ${opts.reason}` : ""
    }. Open the ceremony to choose your fighter. The choice is permanent.`,
    url,
    createdAt: Date.now(),
  });
  await ctx.db.insert("activityFeed", {
    actorId: userId,
    verb: "earned_wings",
    targetType: "wings",
    targetId: opts.token.slice(0, 8),
    url,
    summary: `${opts.memberName} earned their wings${
      opts.reason ? ` — ${opts.reason}` : ""
    }`,
    createdAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Operator: mint a claim token when a member has genuinely earned their wings
// ---------------------------------------------------------------------------

export const issueWings = mutation({
  args: {
    memberId: v.string(), // main-site member id (string, ≤64 chars)
    memberName: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    await enforceRateLimit(
      ctx,
      "wings_issue",
      me,
      20,
      60 * 60 * 1000,
      "Wings issuance rate limit reached — try again later.",
    );

    const memberId = args.memberId.trim();
    let memberName = args.memberName.trim();
    if (!memberName && memberId.length === CONVEX_ID_LENGTH) {
      // Convenience: if the id is a Convex user id, auto-fill the name.
      try {
        const user = await ctx.db.get(memberId as Id<"users">);
        memberName = String(user?.displayName ?? user?.name ?? "").trim();
      } catch {
        // Not a user id — operator must supply the name explicitly.
      }
    }

    return await mintClaimFor(ctx, {
      memberId,
      memberName,
      reason: (args.reason ?? "").trim(),
      issuedBy: me,
      auditAction: "wings.issue",
    });
  },
});

// Bookkeeping hook: the browser reports that the registry burned the claim
// token (step 2 of the ceremony). Capability = possessing the token, which
// only the member and the Bridge have; this only updates OUR burn record.
export const markClaimConsumed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("wingClaims")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!row || row.consumed) return { ok: false };
    await ctx.db.patch(row._id, { consumed: true, consumedAt: Date.now() });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// Operator console: recent issuances
// ---------------------------------------------------------------------------

export const listClaims = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    return await ctx.db
      .query("wingClaims")
      .withIndex("by_issued")
      .order("desc")
      .take(100);
  },
});

// ---------------------------------------------------------------------------
// Earning path 1 — contest winners. Called from the operator judging board.
// The prize (XP/credits) is paid by judgeEntry; this mints the wings claim.
// ---------------------------------------------------------------------------

export const awardWingsToContestWinner = mutation({
  args: { entryId: v.id("contestSubmissions") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [...CONTEST_JURY_CAPS]);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found.");
    if (entry.status !== "winner") {
      throw new Error("Only winning entries earn wings — mark the winner first.");
    }
    const author = await ctx.db.get(entry.authorId);
    if (!author) throw new Error("Entry author not found.");
    const contest = await ctx.db.get(entry.contestId);
    const reason = `Won “${contest?.title ?? "a fleet contest"}” with “${entry.title}”`;

    const res = await mintClaimFor(ctx, {
      memberId: entry.authorId,
      memberName: author.displayName ?? author.name ?? "Pilot",
      reason,
      issuedBy: me,
      auditAction: "wings.issue_contest",
    });
    await notifyWingsIssued(ctx, {
      memberId: entry.authorId,
      memberName: author.displayName ?? author.name ?? "Pilot",
      token: res.token,
      reason,
    });
    return res;
  },
});

// ---------------------------------------------------------------------------
// Earning path 2 — certified field reports. Called from the operator review
// queue for already-approved reports.
// ---------------------------------------------------------------------------

export const awardWingsForReport = mutation({
  args: { reportId: v.id("fleetReports") },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Report not found.");
    if (report.reviewStatus !== "approved") {
      throw new Error("Only approved (certified) reports earn wings.");
    }
    if (!report.authorId) throw new Error("Report has no author on record.");
    const author = await ctx.db.get(report.authorId);
    if (!author) throw new Error("Report author not found.");
    const mission = report.missionId
      ? await ctx.db.get(report.missionId)
      : null;
    const reason = `Certified field report: “${report.title}”${
      mission ? ` (${mission.title})` : ""
    }`;

    const res = await mintClaimFor(ctx, {
      memberId: report.authorId,
      memberName: author.displayName ?? author.name ?? "Pilot",
      reason,
      issuedBy: me,
      auditAction: "wings.issue_report",
    });
    await notifyWingsIssued(ctx, {
      memberId: report.authorId,
      memberName: author.displayName ?? author.name ?? "Pilot",
      token: res.token,
      reason,
    });
    return res;
  },
});

// ---------------------------------------------------------------------------
// Earning path 3 — XP threshold self-claim. The member-facing rule: reach
// the rank of CAPTAIN (2,500 XP) and your wings are waiting to be claimed.
// The ceremony itself remains the single permanent choice.
// ---------------------------------------------------------------------------

export const WINGS_XP_THRESHOLD = 2500;
export const WINGS_XP_RANK = "Captain";

export const getMyWingsClaim = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return null;
    const user = await ctx.db.get(me);
    if (!user) return null;
    const xp = user.xp ?? 0;
    const claims = await ctx.db
      .query("wingClaims")
      .withIndex("by_member", (q) => q.eq("memberId", me))
      .order("desc")
      .take(5);
    const outstanding = claims.find((c) => !c.consumed);
    return {
      xp,
      threshold: WINGS_XP_THRESHOLD,
      rank: WINGS_XP_RANK,
      eligible: xp >= WINGS_XP_THRESHOLD,
      hasOutstandingClaim: Boolean(outstanding),
      claimToken: outstanding?.token ?? null,
    };
  },
});

export const selfClaimWings = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (!user) throw new Error("User not found.");
    const xp = user.xp ?? 0;
    if (xp < WINGS_XP_THRESHOLD) {
      throw new Error(
        `Not yet eligible — wings await at ${WINGS_XP_THRESHOLD} XP (${WINGS_XP_RANK} rank). You have ${xp}.`,
      );
    }
    const res = await mintClaimFor(ctx, {
      memberId: me,
      memberName: user.displayName ?? user.name ?? "Pilot",
      reason: `Reached ${WINGS_XP_RANK} rank — ${xp} XP of verified service`,
      issuedBy: me,
      auditAction: "wings.self_claim",
    });
    await notifyWingsIssued(ctx, {
      memberId: me,
      memberName: user.displayName ?? user.name ?? "Pilot",
      token: res.token,
      reason: `Reached ${WINGS_XP_RANK} rank`,
    });
    return { token: res.token, expiresAt: res.expiresAt };
  },
});
