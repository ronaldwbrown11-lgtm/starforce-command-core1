import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Discord presence bridge — INTEGRATION PLACEHOLDER.
//
// What this module does today:
//   1. `mirrorAnnouncement` — posts operator announcements to a Discord
//      channel via a webhook URL (no bot token needed, no server to host).
//      Fires from admin.sendBroadcast automatically when configured.
//   2. `linkDiscordAccount` / `verifyDiscordLink` / `unlinkDiscord` —
//      members record their Discord username and operators verify it,
//      giving the site a verified cross-platform presence claim.
//
// What it needs before it goes live (user-provided):
//   Env vars (paste into the project's Keys/API keys tab):
//     DISCORD_WEBHOOK_URL — webhook URL of the announcements channel.
//   Manual steps:
//     Discord → Server Settings → Integrations → Webhooks → New Webhook →
//     pick channel → copy URL → paste as DISCORD_WEBHOOK_URL.
//
// The OAuth "verify-and-link" flow (member clicks Link → Discord OAuth →
// redirect back with a verified identity) requires a public app URL + client
// secret (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET) and a server route;
// until that's configured, the manual username + operator-verify flow below
// is the honest bridge. No keys are hardcoded; nothing is faked.
// =========================================================================

const DISCORD_USERNAME_RE = /^[^@#:]{2,32}$/; // basic Discord-style handle shape

/** Post an embed to the announcements webhook. Returns false when the
 * webhook is not configured (callers treat that as "skip silently"). */
export async function postDiscordAnnouncement(
  title: string,
  body: string,
): Promise<{ posted: boolean; reason?: string }> {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return { posted: false, reason: "DISCORD_WEBHOOK_URL not configured" };
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Star Force Base 1198",
        embeds: [
          {
            title: title.slice(0, 256),
            description: (body || "").slice(0, 2048),
            color: 0x00e5ff,
            footer: { text: "Ultra Force Command · mirrored announcement" },
          },
        ],
      }),
    });
    if (!res.ok) {
      return { posted: false, reason: `webhook responded ${res.status}` };
    }
    return { posted: true };
  } catch (e) {
    return { posted: false, reason: e instanceof Error ? e.message : "fetch failed" };
  }
}

// Public: current bridge status (never leaks the webhook URL itself).
export const bridgeStatus = query({
  args: {},
  handler: async () => {
    const configured = !!process.env.DISCORD_WEBHOOK_URL;
    return {
      configured,
      mode: "webhook",
      note: configured
        ? "Announcements mirror to Discord."
        : "DISCORD_WEBHOOK_URL not configured — mirroring is off.",
    };
  },
});

// Member: record the Discord username they want verified. Stored as
// unverified until an operator confirms it.
export const linkDiscordAccount = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const username = args.username.trim();
    if (!DISCORD_USERNAME_RE.test(username)) {
      throw new Error("Enter a Discord username (2–32 chars, no @/#/:).");
    }
    await ctx.db.patch(me, {
      discordUsername: username,
      discordLinkedAt: Date.now(),
      // Re-verify when the username changes.
      discordVerifiedAt: undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "discord.link",
      target: `user:${me}`,
      meta: JSON.stringify({ username }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Member: clear the linked Discord identity.
export const unlinkDiscord = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    await ctx.db.patch(me, {
      discordUsername: undefined,
      discordLinkedAt: undefined,
      discordVerifiedAt: undefined,
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "discord.unlink",
      target: `user:${me}`,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

// Operator: confirm a member's linked Discord handle (the manual half of the
// verify-and-link bridge until Discord OAuth is wired with a public app).
export const verifyDiscordLink = mutation({
  args: { userId: v.id("users"), username: v.string() },
  handler: async (ctx, args) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
      "community_moderator",
    ]);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Member not found.");
    const username = args.username.trim();
    if (target.discordUsername && target.discordUsername !== username) {
      throw new Error("The member linked a different username — ask them to update it first.");
    }
    await ctx.db.patch(args.userId, {
      discordUsername: username,
      discordVerifiedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "discord.verify",
      target: `user:${args.userId}`,
      meta: JSON.stringify({ username }),
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});