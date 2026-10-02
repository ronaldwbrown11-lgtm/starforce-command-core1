import { mutation, query, type MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { v, type Infer } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";
import {
  awardAchievements,
  bumpContribution,
  evaluateAchievements,
} from "./achievements";
import { CREDIT_RATES, grantCredits } from "./economy";
import { enforceRateLimit } from "./rateLimit";

// =========================================================================
// Creator Hub — member proposals that CREATE a new canon entry or EXPAND an
// existing one. Mirrors the Lore Library approval flow: members propose,
// operators review on the Content Desk, approvals publish to `loreEntries`
// (create) or append a titled section to the parent entry (expand) and
// reward the proposing member with XP, credits, and contribution credit.
// =========================================================================

/** Entry types a member can propose as a NEW canon entry. */
export const CREATE_TYPES = [
  "character",
  "starship",
  "sector",
  "species",
  "technology",
  "faction",
  "event",
  "timeline",
] as const;

/** Expansion kinds a member can propose against an EXISTING lore entry. */
export const EXPAND_TYPES = [
  "background",
  "history",
  "cultural_notes",
  "visual_description",
  "related_event",
  "mission_hook",
  "character_connection",
] as const;

export type CreateType = (typeof CREATE_TYPES)[number];
export type ExpandType = (typeof EXPAND_TYPES)[number];

/** XP granted the first time a proposal is approved (create or expand). */
const PROPOSAL_APPROVED_XP = 25;

const OPERATOR_CAPS = ["operator", "senior_operator", "story_editor", "lore_archivist"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Unique slug against existing loreEntries (small table — bounded scan). */
async function uniqueLoreSlug(ctx: MutationCtx, title: string): Promise<string> {
  const base = slugify(title) || "new-entry";
  const taken = new Set(
    (await ctx.db.query("loreEntries").order("desc").take(2000)).map((e) => e.slug),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const creatorProposalValidator = v.object({
  _id: v.id("creatorProposals"),
  _creationTime: v.number(),
  authorId: v.id("users"),
  kind: v.string(),
  entryType: v.string(),
  title: v.string(),
  body: v.string(),
  excerpt: v.optional(v.string()),
  faction: v.optional(v.string()),
  sector: v.optional(v.string()),
  parentLoreId: v.optional(v.id("loreEntries")),
  parentTitle: v.optional(v.string()),
  status: v.string(),
  note: v.optional(v.string()),
  createdAt: v.number(),
  reviewedAt: v.optional(v.number()),
  reviewerId: v.optional(v.id("users")),
  publishedLoreId: v.optional(v.id("loreEntries")),
});

export type CreatorProposal = Infer<typeof creatorProposalValidator>;

// ---------------------------------------------------------------------------
// Member surface
// ---------------------------------------------------------------------------

export const submitProposal = mutation({
  args: {
    kind: v.string(), // "create" | "expand"
    entryType: v.string(),
    title: v.string(),
    body: v.string(),
    excerpt: v.optional(v.string()),
    faction: v.optional(v.string()),
    sector: v.optional(v.string()),
    parentLoreId: v.optional(v.id("loreEntries")),
  },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in to propose lore.");

    const kind = args.kind === "expand" ? "expand" : "create";
    if (kind === "create" && !(CREATE_TYPES as readonly string[]).includes(args.entryType)) {
      throw new Error("Pick a valid entry type.");
    }
    if (kind === "expand" && !(EXPAND_TYPES as readonly string[]).includes(args.entryType)) {
      throw new Error("Pick a valid expansion type.");
    }

    const title = args.title.trim();
    if (title.length < 3) throw new Error("Give it a title (at least 3 characters).");
    if (title.length > 140) throw new Error("Titles are limited to 140 characters.");

    const body = args.body.trim();
    const minBody = kind === "expand" ? 40 : 80;
    if (body.length < minBody) {
      throw new Error(
        kind === "expand"
          ? "Expansion text must be at least 40 characters."
          : "Entry text must be at least 80 characters.",
      );
    }
    if (body.length > 6000) throw new Error("Keep proposals under 6,000 characters.");

    let parentLoreId = args.parentLoreId;
    let parentTitle: string | undefined;
    if (kind === "expand") {
      if (!parentLoreId) throw new Error("Pick the entry you want to expand.");
      const parent = await ctx.db.get(parentLoreId);
      if (!parent) throw new Error("That lore entry no longer exists.");
      parentTitle = parent.title;
    } else {
      parentLoreId = undefined;
    }

    // Abuse guard: 10 proposals per member per hour.
    await enforceRateLimit(
      ctx,
      "creator_proposal",
      me,
      10,
      60 * 60 * 1000,
      "You've proposed a lot recently — wait an hour before proposing again.",
    );

    const now = Date.now();
    const id = await ctx.db.insert("creatorProposals", {
      authorId: me,
      kind,
      entryType: args.entryType,
      title,
      body,
      excerpt: args.excerpt?.trim().slice(0, 280) || undefined,
      faction: args.faction?.trim().slice(0, 60) || undefined,
      sector: args.sector?.trim().slice(0, 80) || undefined,
      parentLoreId,
      parentTitle,
      status: "pending",
      createdAt: now,
    });

    await ctx.db.insert("activityFeed", {
      actorId: me,
      verb: "proposed",
      targetType: "creatorProposal",
      targetId: id,
      url: "/creator",
      summary:
        kind === "expand"
          ? `Proposed an expansion: ${title}`
          : `Proposed a new ${args.entryType}: ${title}`,
      createdAt: now,
    });

    return { ok: true, id };
  },
});

export const myProposals = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return [];
    return await ctx.db
      .query("creatorProposals")
      .withIndex("by_author", (q) => q.eq("authorId", me))
      .order("desc")
      .take(50);
  },
});

// ---------------------------------------------------------------------------
// Operator surface (Content Desk → Proposals tab)
// ---------------------------------------------------------------------------

export const proposalQueue = query({
  args: {
    status: v.optional(v.string()), // pending / approved / rejected (default pending)
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, OPERATOR_CAPS);
    const status = args.status ?? "pending";
    const rows = await ctx.db
      .query("creatorProposals")
      .withIndex("by_status_created", (q) => q.eq("status", status))
      .order("desc")
      .take(args.limit ?? 100);
    return await Promise.all(
      rows.map(async (row) => {
        const author = await ctx.db.get(row.authorId);
        const parent =
          row.parentLoreId !== undefined ? await ctx.db.get(row.parentLoreId) : null;
        return {
          ...row,
          authorName:
            author?.displayName ?? author?.email?.split("@")[0] ?? "Unknown member",
          parentSlug: parent?.slug ?? null,
        };
      }),
    );
  },
});

export const reviewProposal = mutation({
  args: {
    id: v.id("creatorProposals"),
    action: v.string(), // "approve" | "reject"
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, OPERATOR_CAPS);
    if (!["approve", "reject"].includes(args.action)) {
      throw new Error("Invalid action.");
    }
    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Not found.");
    if (proposal.status !== "pending") {
      throw new Error("This proposal has already been reviewed.");
    }

    const note = args.note?.trim().slice(0, 500) || undefined;
    const approved = args.action === "approve";
    const now = Date.now();
    let publishedLoreId = proposal.publishedLoreId;
    let loreSlug: string | null = null;

    if (approved && proposal.kind === "create") {
      // Publish a new canon entry credited to the proposing member.
      const slug = await uniqueLoreSlug(ctx, proposal.title);
      const excerpt =
        proposal.excerpt ??
        proposal.body.replace(/\s+/g, " ").trim().slice(0, 240);
      publishedLoreId = await ctx.db.insert("loreEntries", {
        title: proposal.title,
        slug,
        excerpt,
        content: proposal.body,
        faction: proposal.faction,
        sector: proposal.sector,
        entryType: proposal.entryType,
        authorId: proposal.authorId,
        createdAt: now,
      });
      loreSlug = slug;
      await ctx.db.insert("activityFeed", {
        actorId: me,
        verb: "published",
        targetType: "lore",
        targetId: String(publishedLoreId),
        url: `/lore/${slug}`,
        summary: proposal.title,
        createdAt: now,
      });
    }

    if (approved && proposal.kind === "expand") {
      // Append the expansion as a titled section on the parent entry.
      const parent = proposal.parentLoreId ? await ctx.db.get(proposal.parentLoreId) : null;
      if (!parent) throw new Error("The parent entry no longer exists.");
      const merged = `${parent.content}\n\n${proposal.title}\n${proposal.body}`;
      await ctx.db.patch(parent._id, { content: merged });
      publishedLoreId = parent._id;
      loreSlug = parent.slug;
    }

    await ctx.db.patch(args.id, {
      status: approved ? "approved" : "rejected",
      note,
      reviewedAt: now,
      reviewerId: me,
      publishedLoreId: approved ? publishedLoreId : undefined,
    });

    // Reward the proposing member the first time a proposal is approved —
    // never for self-review, never twice.
    if (approved && !proposal.reviewedAt && proposal.authorId !== me) {
      const author = await ctx.db.get(proposal.authorId);
      if (author) {
        await ctx.db.patch(proposal.authorId, {
          xp: (author.xp ?? 0) + PROPOSAL_APPROVED_XP,
        });
        await ctx.db.insert("auditLog", {
          actorId: me,
          action: "xp.grant",
          target: `user:${proposal.authorId}`,
          meta: JSON.stringify({
            source: "creatorProposal.approved",
            amount: PROPOSAL_APPROVED_XP,
            item: args.id,
          }),
          createdAt: now,
        });
        await awardAchievements(ctx, proposal.authorId, ["lore_contributor"]);
        await bumpContribution(ctx, proposal.authorId);
        await evaluateAchievements(ctx, proposal.authorId);
        await grantCredits(
          ctx,
          proposal.authorId,
          CREDIT_RATES.loreApproved,
          "creatorProposal.approved",
        );
      }
    }

    // Notify the proposer of the outcome.
    if (proposal.authorId !== me) {
      await ctx.db.insert("notifications", {
        userId: proposal.authorId,
        kind: approved ? "lore_approved" : "lore_rejected",
        title: approved
          ? proposal.kind === "expand"
            ? "Your lore expansion was published"
            : "Your canon entry was published"
          : "Your proposal was not approved",
        body: note
          ? `${proposal.title} — ${note}`.slice(0, 300)
          : proposal.title.slice(0, 300),
        url: approved && loreSlug ? `/lore/${loreSlug}` : "/creator",
        createdAt: now,
      });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: `creatorProposal.${args.action}`,
      target: `creatorProposal:${args.id}`,
      meta: note ? JSON.stringify({ note }) : undefined,
      createdAt: now,
    });

    return { ok: true, loreSlug };
  },
});

/** Pending count for the operator nav badge. */
export const pendingProposalCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) return 0;
    const user = await ctx.db.get(me);
    const isOperator =
      user?.role === "admin" ||
      OPERATOR_CAPS.includes(String(user?.opRole ?? ""));
    if (!isOperator) return 0;
    const rows = await ctx.db
      .query("creatorProposals")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(200);
    return rows.length;
  },
});
