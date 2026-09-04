import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOperatorCapability } from "./admin";

// =========================================================================
// Discord presence bridge — INTEGRATION PLACEHOLDER.
//
// What this module does today:
//   1. Announcement mirroring — operator broadcasts post to a Discord
//      channel via a webhook URL (no bot token needed, no server to host).
//      The webhook POST runs in discordBridgeNode.ts (Node.js runtime),
//      scheduled from admin.sendBroadcast; the outcome lands back on the
//      audit log so the operator console shows whether the mirror fired.
//   2. `linkDiscordAccount` / `verifyDiscordLink` / `unlinkDiscord` —
//      members record their Discord username and operators verify it,
//      giving the site a verified cross-platform presence claim.
//   The operator-facing test action lives in discordBridgeActions.ts (kept
//   out of this module because a public action referencing this module's own
//   internals triggers a TypeScript inference cycle).
//
// What it needs before mirroring goes live (user-provided):
//   Env var (paste into the project's Keys/API keys tab):
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
  // trim(): env values pasted from dashboards can carry a trailing newline,
  // which would make the URL unparseable and fail with a cryptic error.
  const webhook = (process.env.DISCORD_WEBHOOK_URL ?? "").trim();
  if (!webhook) {
    return { posted: false, reason: "DISCORD_WEBHOOK_URL not configured" };
  }
  if (!/^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\//i.test(webhook)) {
    return {
      posted: false,
      reason:
        "DISCORD_WEBHOOK_URL is set but does not look like a Discord webhook " +
        "(expected https://discord.com/api/webhooks/...). Re-copy the full URL " +
        "from Server Settings → Integrations → Webhooks.",
    };
  }
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Discord rejects API calls that carry no recognizable User-Agent;
        // Convex's Node fetch sends none by default, so set one explicitly.
        "User-Agent":
          "StarForceBase1198/1.0 (announcement mirror; Ultra Force Command)",
        Accept: "application/json",
      },
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
      // Surface Discord's own error text (e.g. "Unknown Webhook") so the
      // operator console shows the actionable cause, not a bare status code.
      let detail = "";
      try {
        const text = (await res.text()).trim();
        if (text) {
          try {
            const j = JSON.parse(text) as { message?: string; code?: number };
            if (j.message) {
              detail = `: ${j.message}${j.code != null ? ` (code ${j.code})` : ""}`;
            }
          } catch {
            detail = `: ${text.slice(0, 140)}`;
          }
        }
      } catch {
        // Body read failed — keep the bare status.
      }
      return { posted: false, reason: `webhook responded ${res.status}${detail}` };
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
    const webhook = (process.env.DISCORD_WEBHOOK_URL ?? "").trim();
    const configured = !!webhook;
    const looksValid = /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\//i.test(
      webhook,
    );
    return {
      configured,
      mode: "webhook",
      note: !configured
        ? "DISCORD_WEBHOOK_URL not configured — mirroring is off."
        : looksValid
          ? "Announcements mirror to Discord."
          : "DISCORD_WEBHOOK_URL is set but does not look like a Discord webhook URL — re-copy it from Integrations → Webhooks.",
    };
  },
});

// Internal gate: the node actions and public test action have no db/handler
// context of their own, so operator authorization is enforced here, in a
// context that can run requireOperatorCapability. Never export as public.
export const requireBridgeOperator = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { me } = await requireOperatorCapability(ctx, [
      "operator",
      "senior_operator",
    ]);
    return { me };
  },
});

// Internal: the node mirror action reports its outcome back onto the
// broadcast's audit row so history shows whether the Discord mirror fired.
export const recordMirrorOutcome = internalMutation({
  args: {
    auditLogId: v.id("auditLog"),
    posted: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.auditLogId);
    if (!row) return { ok: false };
    let meta: Record<string, unknown> = {};
    try {
      meta = row.meta ? (JSON.parse(row.meta) as Record<string, unknown>) : {};
    } catch {
      meta = {};
    }
    meta.discordMirrored = args.posted;
    if (!args.posted && args.reason) meta.discordMirrorReason = args.reason;
    await ctx.db.patch(args.auditLogId, { meta: JSON.stringify(meta) });
    return { ok: true };
  },
});

// Internal: audit a test transmission (actor comes from requireBridgeOperator).
export const recordDiscordTest = internalMutation({
  args: {
    actorId: v.id("users"),
    result: v.object({
      posted: v.boolean(),
      reason: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      actorId: args.actorId,
      action: "discord.test",
      target: "discord:webhook",
      meta: JSON.stringify(args.result),
      createdAt: Date.now(),
    });
    return { ok: true };
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
