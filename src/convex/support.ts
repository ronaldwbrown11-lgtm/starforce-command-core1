import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// ---- Support tickets -----------------------------------------------------

export const createTicket = mutation({
  args: {
    email: v.string(),
    topic: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim();
    const topic = args.topic.trim();
    const message = args.message.trim();
    if (!email) throw new Error("Email is required.");
    if (!message) throw new Error("Message cannot be empty.");

    const userId = await getAuthUserId(ctx);

    const id = await ctx.db.insert("supportTickets", {
      email,
      topic,
      message,
      userId: userId ?? undefined,
      status: "open",
      replies: [],
      createdAt: Date.now(),
    });
    return id;
  },
});

const TICKET_STATUSES = ["open", "responded", "closed"] as const;

function summarizeTicket(t: {
  _id: unknown;
  email: string;
  topic: string;
  message: string;
  userId?: string;
  status: string;
  replies?: { by: string; body: string; at: number }[];
  updatedAt?: number;
  createdAt: number;
}) {
  return {
    _id: t._id,
    email: t.email,
    topic: t.topic,
    message: t.message,
    userId: t.userId,
    status: t.status,
    replies: t.replies ?? [],
    updatedAt: t.updatedAt ?? t.createdAt,
    createdAt: t.createdAt,
  };
}

/**
 * Your own tickets (signed-in users) — powers the "Your tickets" section
 * on the public Support page, including any operator replies.
 */
export const myTickets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const tickets = await ctx.db
      .query("supportTickets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(25);
    return tickets.map(summarizeTicket);
  },
});

/**
 * Operator support inbox — every ticket, newest first. This query used to be
 * public; it is now gated to operator staff so nobody can read other users'
 * tickets.
 */
export const listTickets = query({
  args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    const all = await ctx.db
      .query("supportTickets")
      .order("desc")
      .take(args.limit ?? 100);
    const rows = args.status ? all.filter((t) => t.status === args.status) : all;
    return rows.map(summarizeTicket);
  },
});

/**
 * Operator reply to a ticket. Appends to the conversation, moves the ticket
 * to "responded", and pings the submitter through the in-app bell so they
 * see it the moment they open the Support page.
 */
export const respondToTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    const body = args.body.trim();
    if (!body) throw new Error("Reply cannot be empty.");

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");

    const by = user.displayName ?? user.email ?? "Operator";
    const replies = [...(ticket.replies ?? []), { by, body, at: Date.now() }];
    await ctx.db.patch(args.ticketId, {
      replies,
      status: "responded",
      updatedAt: Date.now(),
    });

    if (ticket.userId) {
      await ctx.db.insert("notifications", {
        userId: ticket.userId,
        kind: "support_reply",
        title: `Support reply — ${ticket.topic}`,
        body: body.slice(0, 140),
        url: "/support",
        createdAt: Date.now(),
      });
    }
    // Best-effort email to the ticket's contact address (covers guests too).
    await ctx.scheduler
      .runAfter(0, api.email.sendTicketReply, {
        to: ticket.email,
        topic: ticket.topic,
        body,
      })
      .catch(() => {
        // Email is best-effort; the reply is already recorded.
      });
    return { ok: true };
  },
});

/** Operator triage: mark a ticket open / responded / closed. */
export const setTicketStatus = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOperatorCapability(ctx, ["operator", "senior_operator"]);
    if (!(TICKET_STATUSES as readonly string[]).includes(args.status)) {
      throw new Error("Unknown ticket status.");
    }
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found.");
    await ctx.db.patch(args.ticketId, {
      status: args.status as (typeof TICKET_STATUSES)[number],
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});
