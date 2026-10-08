import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import { enforceRateLimit } from "./rateLimit";

// ---------------------------------------------------------------------------
// Site reviews — members submit on /reviews, an operator approves, the public
// list renders. Pending and rejected drafts are NEVER returned by the public
// query, so a draft cannot leak onto the page before review.
//
// This is the "reviews hosted on our own site" path. Google reviews are a
// separate, outbound-only path (see GOOGLE_REVIEW_LINK in src/lib/reviews.ts)
// and are not ingested here — that needs the Places API.
// ---------------------------------------------------------------------------

const OPERATOR_CAPS = ["operator", "senior_operator", "community_moderator"];

const HEADLINE_MIN = 6;
const HEADLINE_MAX = 120;
const BODY_MIN = 40;
const BODY_MAX = 2000;

/** Shape returned to the public list — no user ids, no moderation metadata. */
export type PublicReview = {
  id: string;
  authorName: string;
  callSign?: string;
  role?: string;
  headline: string;
  body: string;
  rating: number;
  createdAt: number;
};

/**
 * Submit a review. Signed-in only — an attributed review is the whole point,
 * and it keeps abuse keyed to a real account.
 */
export const submit = mutation({
  args: {
    headline: v.string(),
    body: v.string(),
    rating: v.float64(),
    callSign: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in to transmit a review.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");

    const headline = args.headline.trim();
    const body = args.body.trim();
    const callSign = args.callSign?.trim() || undefined;
    const role = args.role?.trim() || undefined;

    if (headline.length < HEADLINE_MIN || headline.length > HEADLINE_MAX) {
      throw new Error(
        `Headline must be ${HEADLINE_MIN}–${HEADLINE_MAX} characters.`,
      );
    }
    if (body.length < BODY_MIN || body.length > BODY_MAX) {
      throw new Error(`Review must be ${BODY_MIN}–${BODY_MAX} characters.`);
    }
    if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be a whole number from 1 to 5.");
    }

    // 3 submissions per 7 days per member — enough to fix a draft, not enough
    // to flood the queue.
    await enforceRateLimit(
      ctx,
      "site_review",
      userId,
      3,
      7 * 24 * 60 * 60 * 1000,
      "You've sent several reviews this week — the queue will catch up.",
    );

    const authorName =
      (user as { displayName?: string; name?: string }).displayName?.trim() ||
      (user as { name?: string }).name?.trim() ||
      "Fleet member";

    return await ctx.db.insert("siteReviews", {
      userId,
      authorName,
      callSign,
      role,
      headline,
      body,
      rating: args.rating,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/** Public. Approved reviews only, newest first. */
export const listApproved = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), 100);
    const rows = await ctx.db
      .query("siteReviews")
      .withIndex("by_status_created", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(limit);

    return rows.map(
      (row): PublicReview => ({
        id: row._id,
        authorName: row.authorName,
        callSign: row.callSign,
        role: row.role,
        headline: row.headline,
        body: row.body,
        rating: row.rating,
        createdAt: row.createdAt,
      }),
    );
  },
});

/** Operator. Everything still awaiting a decision. */
export const listPending = query({
  args: {},
  handler: async (ctx) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    return await ctx.db
      .query("siteReviews")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(50);
  },
});

/** Operator. Approve or reject a submitted review. Audit-logged. */
export const setDecision = mutation({
  args: {
    id: v.id("siteReviews"),
    action: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Review not found.");

    const status = args.action === "approve" ? "approved" : "rejected";
    await ctx.db.patch(args.id, {
      status,
      decidedAt: Date.now(),
      decidedBy: me,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `siteReview.${args.action}`,
      target: `siteReviews:${args.id}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
