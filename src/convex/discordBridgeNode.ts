"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { postDiscordAnnouncement } from "./discordBridge";

// =========================================================================
// Discord presence bridge — outbound webhook runtime (Node.js).
//
// Why this file exists: webhook POSTs are guaranteed here. The default V8
// isolate in this Convex deployment has no `fetch` (see seeds/README.md —
// this is why the seed action had to move to "use node"), so every mirror
// attempt made from a query/mutation would throw and be swallowed by its
// caller. These internalActions are invoked either from a gated mutation
// (admin.sendBroadcast schedules mirrorAnnouncement) or from the gated
// public action discordBridge.testBridgeConnection — they never run
// unauthenticated.
//
// Both actions write their outcome back to the audit log via
// discordBridge.recordMirrorOutcome / recordDiscordTest (internalMutation,
// which cannot live in a node module) so the operator console shows the
// mirror result instead of guessing.
//
// Missing env var → { posted: false, reason: "DISCORD_WEBHOOK_URL not
// configured" } — callers treat that as "mirror skipped", never as a
// broadcast failure.
// =========================================================================

export const mirrorAnnouncement = internalAction({
  args: {
    auditLogId: v.id("auditLog"),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const res = await postDiscordAnnouncement(args.title, args.body);
    await ctx.runMutation(internal.discordBridge.recordMirrorOutcome, {
      auditLogId: args.auditLogId,
      posted: res.posted,
      reason: res.reason,
    });
    return res;
  },
});

export const sendTestTransmission = internalAction({
  args: { actorId: v.id("users") },
  handler: async (ctx, args) => {
    const res = await postDiscordAnnouncement(
      "Presence bridge — online",
      "This is a test transmission from Ultra Force Command. If you can read " +
        "this, announcement mirroring is live and future broadcasts will " +
        "appear in this channel. You can delete this message.",
    );
    await ctx.runMutation(internal.discordBridge.recordDiscordTest, {
      actorId: args.actorId,
      result: res,
    });
    return res;
  },
});
