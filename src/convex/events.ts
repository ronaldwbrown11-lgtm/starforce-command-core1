import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Site-wide events calendar (#7)
//
// Operator-managed calendar for the public /events page: weekly Lore Lab
// writing sessions, monthly faction meetings, seasonal story arcs, live
// Q&As, and countdowns for major lore releases. The public surface lists
// upcoming + in-flight events with a live countdown to the next one.
// =========================================================================

export const EVENT_KINDS = [
  "lore_lab",
  "faction_meeting",
  "arc",
  "live_qa",
  "release",
  "community",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

const KIND_LABEL: Record<EventKind, string> = {
  lore_lab: "Lore Lab",
  faction_meeting: "Faction Meeting",
  arc: "Story Arc",
  live_qa: "Live Q&A",
  release: "Lore Release",
  community: "Community",
};

export function eventKindLabel(kind: string): string {
  return KIND_LABEL[kind as EventKind] ?? "Event";
}

export const listUpcomingEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const events = await ctx.db
      .query("calendarEvents")
      .withIndex("by_scheduled", (q) => q.gte("scheduledAt", now - 6 * 60 * 60 * 1000))
      .take(args.limit ?? 25);
    const out = events
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        _id: e._id,
        title: e.title,
        description: e.description,
        kind: e.kind,
        kindLabel: eventKindLabel(e.kind),
        scheduledAt: e.scheduledAt,
        endsAt: e.endsAt ?? null,
        location: e.location ?? null,
        link: e.link ?? null,
        status: e.status,
      }))
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
    const next = out.find(
      (e) => e.status !== "ended" && e.scheduledAt + (e.endsAt ? e.endsAt - e.scheduledAt : 3 * 60 * 60 * 1000) > now,
    );
    return { events: out.slice(0, args.limit ?? 25), next: next ?? null };
  },
});

export const createCalendarEvent = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    kind: v.string(),
    scheduledAt: v.number(),
    endsAt: v.optional(v.number()),
    location: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const title = args.title.trim();
    const description = args.description.trim();
    if (!title || !description) throw new Error("Title and description are required.");
    if (!EVENT_KINDS.includes(args.kind as EventKind)) {
      throw new Error("Unknown event kind.");
    }
    if (!Number.isFinite(args.scheduledAt) || args.scheduledAt < Date.now() - 86_400_000) {
      throw new Error("Pick a valid start time.");
    }
    const id = await ctx.db.insert("calendarEvents", {
      title,
      description,
      kind: args.kind,
      scheduledAt: args.scheduledAt,
      endsAt: args.endsAt,
      location: args.location?.trim() || undefined,
      link: args.link?.trim() || undefined,
      status: "scheduled",
      createdBy: me,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "calendar.create",
      target: `calendarEvent:${id}`,
      meta: JSON.stringify({ title }),
      createdAt: Date.now(),
    });
    return id;
  },
});

export const setEventStatus = mutation({
  args: { id: v.id("calendarEvents"), status: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    if (!["scheduled", "live", "ended", "cancelled"].includes(args.status)) {
      throw new Error("Invalid status.");
    }
    await ctx.db.patch(args.id, { status: args.status });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "calendar.status",
      target: `calendarEvent:${args.id}`,
      meta: JSON.stringify({ status: args.status }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});
