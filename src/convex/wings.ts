import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
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
//     tokens and stores the PERMANENT member→fighter assignment.
//   • Registry tables are never written directly — HTTP API only, no secret
//     required (verify/claim authenticate with the claim token itself).
//
// Token format (must match exactly): 43–64 chars, URL-safe —
// 32 random bytes, base64url-encoded, i.e. crypto.randomBytes(32) equivalent.
// Single-use, 24h expiry enforced by the registry; `consumed` here is
// main-site bookkeeping of the burn.
// =========================================================================

const REGISTRY_BASE = "https://fleetregistry.starforcebase1198.com";
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

/** POST/GET helper against the registry; surfaces the registry's error text. */
async function registryFetch(
  path: string,
  init?: { method?: string; bearer?: string; body?: unknown },
): Promise<{ status: number; ok: boolean; data: unknown }> {
  const res = await fetch(`${REGISTRY_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      ...(init?.bearer ? { Authorization: `Bearer ${init.bearer}` } : {}),
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  return { status: res.status, ok: res.ok, data };
}

function errorText(data: unknown, status: number): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return `Registry request failed (HTTP ${status}).`;
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
// One claim per member per lifetime of each eligibility; the ceremony itself
// remains the single permanent choice.
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

// ---------------------------------------------------------------------------
// Ceremony actions (public — authenticated by the claim/session token itself)
// ---------------------------------------------------------------------------

export type VerifyResult =
  | { state: "valid"; memberName: string; reason?: string; alreadyAssigned: boolean }
  | { state: "invalid" | "expired" | "used" }
  | { state: "error"; message: string };

/** Step 1 — verify a claim token WITHOUT consuming it. */
export const verifyClaim = action({
  args: { token: v.string() },
  handler: async (_ctx, args): Promise<VerifyResult> => {
    let res: { status: number; ok: boolean; data: unknown };
    try {
      res = await registryFetch("/api/wings/claim/verify", {
        method: "POST",
        bearer: args.token,
      });
    } catch {
      return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
    }
    if (res.status === 200 && res.ok) {
      const d = (res.data ?? {}) as {
        memberName?: unknown;
        reason?: unknown;
        alreadyAssigned?: unknown;
      };
      return {
        state: "valid",
        memberName: typeof d.memberName === "string" ? d.memberName : "Pilot",
        reason: typeof d.reason === "string" ? d.reason : undefined,
        alreadyAssigned: d.alreadyAssigned === true,
      };
    }
    if (res.status === 409) return { state: "used" };
    if (res.status === 401) {
      const msg = errorText(res.data, res.status);
      return msg.toLowerCase().includes("expired") ? { state: "expired" } : { state: "invalid" };
    }
    return { state: "error", message: errorText(res.data, res.status) };
  },
});

export type ClaimResult =
  | { state: "claimed"; sessionToken: string; memberName: string; expiresInMs: number }
  | { state: "used" | "already_assigned" }
  | { state: "error"; message: string };

/** Step 2 — start the assignment. CONSUMES the claim token (single-use). */
export const claimWings = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<ClaimResult> => {
    // Custody check: the token must have been minted on THIS site.
    const local = await ctx.runQuery(api.wings.getClaimByToken, { token: args.token });
    if (!local) return { state: "error", message: "Unknown claim token." };

    let res: { status: number; ok: boolean; data: unknown };
    try {
      res = await registryFetch("/api/wings/claim", {
        method: "POST",
        bearer: args.token,
      });
    } catch {
      return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
    }
    if (res.status === 200 && res.ok) {
      const d = (res.data ?? {}) as {
        sessionToken?: unknown;
        memberName?: unknown;
        expiresInMs?: unknown;
      };
      if (typeof d.sessionToken !== "string") {
        return { state: "error", message: "Registry returned an invalid session." };
      }
      // The token is burned — record the burn on our side.
      await ctx.runMutation(api.wings.publicMarkConsumed, { token: args.token });
      return {
        state: "claimed",
        sessionToken: d.sessionToken,
        memberName: typeof d.memberName === "string" ? d.memberName : "Pilot",
        expiresInMs: typeof d.expiresInMs === "number" ? d.expiresInMs : 10 * 60 * 1000,
      };
    }
    if (res.status === 409) {
      const msg = errorText(res.data, res.status).toLowerCase();
      return msg.includes("assigned") ? { state: "already_assigned" } : { state: "used" };
    }
    return { state: "error", message: errorText(res.data, res.status) };
  },
});

// Internal calls can't be reached from the client; re-export the burn
// bookkeeping through a public wrapper for the action above.
export const publicMarkConsumed = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Only the claim flow reaches this: the token must exist and must not
    // already be consumed — otherwise it's a replay attempt, ignore it.
    const row = await ctx.db
      .query("wingClaims")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!row || row.consumed) return { ok: false };
    await ctx.db.patch(row._id, { consumed: true, consumedAt: Date.now() });
    return { ok: true };
  },
});

// Custody lookup used by claimWings (kept unauthenticated-but-uninformative:
// it returns only whether a token exists, never its contents).
export const getClaimByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("wingClaims")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    return row ? { consumed: row.consumed ?? false } : null;
  },
});

export type AssignResult =
  | {
      state: "assigned";
      assignment: { vesselId: number; designation: string; memberName: string; assignedAt: number };
    }
  | { state: "session_expired" | "already_assigned" | "unknown_vessel" }
  | { state: "error"; message: string };

/** Step 3 — make the PERMANENT choice (session token, NOT the claim token). */
export const assignFighter = action({
  args: { sessionToken: v.string(), vesselId: v.number() },
  handler: async (_ctx, args): Promise<AssignResult> => {
    let res: { status: number; ok: boolean; data: unknown };
    try {
      res = await registryFetch("/api/wings/assign", {
        method: "POST",
        bearer: args.sessionToken,
        body: { vesselId: args.vesselId },
      });
    } catch {
      return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
    }
    if (res.status === 201) {
      const d = (res.data ?? {}) as {
        assignment?: {
          vesselId?: unknown;
          designation?: unknown;
          memberName?: unknown;
          assignedAt?: unknown;
        };
      };
      const a = d.assignment ?? {};
      return {
        state: "assigned",
        assignment: {
          vesselId: typeof a.vesselId === "number" ? a.vesselId : args.vesselId,
          designation: typeof a.designation === "string" ? a.designation : "Unknown vessel",
          memberName: typeof a.memberName === "string" ? a.memberName : "Pilot",
          assignedAt: typeof a.assignedAt === "number" ? a.assignedAt : Date.now(),
        },
      };
    }
    if (res.status === 401) return { state: "session_expired" };
    if (res.status === 404) return { state: "unknown_vessel" };
    if (res.status === 409) return { state: "already_assigned" };
    return { state: "error", message: errorText(res.data, res.status) };
  },
});

export type RegistryVessel = {
  id: number;
  designation: string;
  name?: string;
  shipClass?: string;
  badge?: string;
};

/** Public ship-type list for the ceremony's "choose your fighter" grid. */
export const listVessels = action({
  args: {},
  handler: async (_ctx): Promise<{ state: "ok"; vessels: RegistryVessel[] } | { state: "error"; message: string }> => {
    try {
      const res = await registryFetch("/api/vessels");
      if (!res.ok || !Array.isArray(res.data)) {
        return { state: "error", message: errorText(res.data, res.status) };
      }
      const vessels: RegistryVessel[] = [];
      for (const raw of res.data) {
        const r = (raw ?? {}) as Record<string, unknown>;
        const id = r.id;
        const designation = r.designation;
        if (typeof id !== "number" || typeof designation !== "string") continue;
        vessels.push({
          id,
          designation,
          name: typeof r.name === "string" ? r.name : undefined,
          shipClass: typeof r.shipClass === "string" ? r.shipClass : undefined,
          badge: typeof r.badge === "string" ? r.badge : undefined,
        });
      }
      return { state: "ok", vessels };
    } catch {
      return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
    }
  },
});

export type RegistryPilot = {
  id: number;
  memberId: string;
  memberName: string;
  note?: string;
  assignedAt: number;
  vesselId: number;
  designation: string;
};

/** A ship type's honor roll (public): the ASSIGNED PILOTS strip, main-site side. */
export const vesselPilots = action({
  args: { vesselId: v.number() },
  handler: async (_ctx, args): Promise<{ state: "ok"; pilots: RegistryPilot[] } | { state: "error"; message: string }> => {
    try {
      const res = await registryFetch(`/api/vessels/${args.vesselId}/pilots`);
      if (!res.ok || !Array.isArray(res.data)) {
        return { state: "error", message: errorText(res.data, res.status) };
      }
      const pilots: RegistryPilot[] = [];
      for (const raw of res.data) {
        const r = (raw ?? {}) as Record<string, unknown>;
        if (typeof r.memberName !== "string") continue;
        pilots.push({
          id: typeof r.id === "number" ? r.id : 0,
          memberId: typeof r.memberId === "string" ? r.memberId : "",
          memberName: r.memberName,
          note: typeof r.note === "string" ? r.note : undefined,
          assignedAt: typeof r.assignedAt === "number" ? r.assignedAt : 0,
          vesselId: typeof r.vesselId === "number" ? r.vesselId : args.vesselId,
          designation: typeof r.designation === "string" ? r.designation : "",
        });
      }
      return { state: "ok", pilots };
    } catch {
      return { state: "error", message: "The Fleet Registry is unreachable. Try again shortly." };
    }
  },
});
