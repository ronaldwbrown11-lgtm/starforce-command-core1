"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";

/**
 * Transactional email via Resend (https://resend.com).
 *
 * Required env var (paste into the project's Keys/API keys tab):
 *   RESEND_API_KEY   — server-side API key (re_...)
 *
 * Optional:
 *   EMAIL_FROM   — from address; must be a verified domain in Resend.
 *                  Defaults to "Star Force 1198 <no-reply@starforcebase1198.com>".
 *   SITE_URL     — absolute site URL used for links in emails.
 *
 * All senders are best-effort: when RESEND_API_KEY is missing or the send
 * fails, the action returns { ok: false } and the caller's core write still
 * succeeds — an email failure never breaks the feature it accompanies.
 */

const SITE_URL = process.env.SITE_URL ?? "https://starforcebase1198.com";
const FROM =
  process.env.EMAIL_FROM ?? "Star Force 1198 <no-reply@starforcebase1198.com>";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function shell({ subject, body }: { subject: string; body: string }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0A0A0C;color:#F5F9FF;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0C;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border:1px solid #1E2430;border-radius:12px;overflow:hidden;background:#111214">
          <tr><td style="padding:20px 28px;border-bottom:1px solid #1E2430;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#00E5FF">Star Force 1198</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#F5F9FF">${subject}</h1>
            <div style="font-size:14px;line-height:1.6;color:#B7C3D0">${body}</div>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #1E2430;font-size:12px;color:#7A8794">
            You're receiving this because of activity on Star Force Base 1198 · <a href="${SITE_URL}" style="color:#00E5FF;text-decoration:none">${SITE_URL.replace(/^https?:\/\//, "")}</a>
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function bestEffortSend(
  resend: Resend,
  args: { to: string; subject: string; html: string },
): Promise<{ ok: boolean; reason?: string }> {
  try {
    await resend.emails.send({
      from: FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    return { ok: true };
  } catch (e) {
    console.error("Resend send failed:", e);
    return { ok: false, reason: "send_failed" };
  }
}

/** Email the submitter when an operator replies to their support ticket. */
export const sendTicketReply = action({
  args: {
    to: v.string(),
    topic: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    if (!resend) return { ok: false, reason: "not_configured" };
    const subject = `Re: ${args.topic} — Star Force 1198 Support`;
    const body = `
      <p>Your ticket <strong>${escapeHtml(args.topic)}</strong> has a new reply from our team:</p>
      <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #00E5FF;background:#16181D;border-radius:6px;white-space:pre-wrap">${escapeHtml(args.body)}</blockquote>
      <p><a href="${SITE_URL}/support" style="color:#00E5FF">View your tickets on Star Force Base 1198</a></p>`;
    return bestEffortSend(resend, { to: args.to, subject, html: shell({ subject, body }) });
  },
});

/** Email the author when their story or lore submission is reviewed. */
export const sendVerdict = action({
  args: {
    to: v.string(),
    kind: v.string(), // "story" | "lore"
    title: v.string(),
    outcome: v.string(), // "approved" | "rejected" | "changes_requested"
    note: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    if (!resend) return { ok: false, reason: "not_configured" };

    const kindLabel = args.kind === "lore" ? "lore submission" : "story";
    const outcomeLabel =
      args.outcome === "approved"
        ? "approved"
        : args.outcome === "changes_requested"
          ? "needs changes"
          : "was not approved";
    const subject = `${kindLabel[0].toUpperCase()}${kindLabel.slice(1)} ${outcomeLabel}: ${args.title}`;

    const bodyLines = [
      `<p>Your ${kindLabel} <strong>${escapeHtml(args.title)}</strong> has been reviewed and <strong>${outcomeLabel}</strong>.</p>`,
    ];
    if (args.note) {
      bodyLines.push(
        `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #E6A817;background:#16181D;border-radius:6px;white-space:pre-wrap">${escapeHtml(args.note)}</blockquote>`,
      );
    }
    if (args.outcome === "approved") {
      const url = args.kind === "lore" ? `${SITE_URL}/lore/` : `${SITE_URL}/stories/`;
      bodyLines.push(
        `<p><a href="${url}" style="color:#00E5FF">View it in the archive</a></p>`,
      );
    }
    return bestEffortSend(resend, {
      to: args.to,
      subject,
      html: shell({ subject, body: bodyLines.join("") }),
    });
  },
});
