"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Resend } from "resend";

// =========================================================================
// Weekly email digest (Tier 2 — #20)
//
// A Monday cron (see cronJobs.ts) sends every verified subscriber a short
// roundup of the week's content. Delivery is best-effort per recipient —
// a failure for one address never aborts the batch — and the run is
// bounded to 500 subscribers so a large roster can't blow the action's
// budget. Data comes from digestData.ts (queries can't live in node
// modules).
// =========================================================================

const SITE_URL = process.env.SITE_URL ?? "https://starforcebase1198.com";
const FROM =
  process.env.EMAIL_FROM ?? "Star Force 1198 <no-reply@starforcebase1198.com>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function digestHtml(data: {
  name: string;
  stories: { title: string; slug: string }[];
  lore: { title: string; slug: string }[];
  transmissions: { title: string; slug: string }[];
  missions: { title: string; slug: string }[];
  events: { title: string; scheduledAt: number }[];
  threads: { title: string; slug: string }[];
  weekStart: number;
}): string {
  const row = (
    label: string,
    items: { title: string; slug: string }[],
    path: string,
  ) =>
    items.length
      ? `<tr><td style="padding:14px 28px;border-bottom:1px solid #1E2430"><p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7A8794">${label}</p>${items
          .map(
            (i) =>
              `<p style="margin:4px 0"><a href="${SITE_URL}/${path}/${encodeURIComponent(i.slug)}" style="color:#00E5FF;text-decoration:none">${escapeHtml(i.title)}</a></p>`,
          )
          .join("")}</td></tr>`
      : "";

  return `<!doctype html><html><body style="margin:0;background:#0A0A0C;color:#F5F9FF;font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0C;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border:1px solid #1E2430;border-radius:12px;overflow:hidden;background:#111214">
          <tr><td style="padding:20px 28px;border-bottom:1px solid #1E2430;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#00E5FF">Star Force 1198 — Weekly Fleet Digest</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#F5F9FF">Reporting in, ${escapeHtml(data.name)}</h1>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#B7C3D0">Here's what the fleet published this week — new stories, lore, missions, and transmissions from Star Force Base 1198.</p>
            ${row("New stories", data.stories, "stories")}
            ${row("New lore", data.lore, "lore")}
            ${row("Transmissions", data.transmissions, "videos")}
            ${row("New missions", data.missions, "missions")}
            ${
              data.events.length
                ? `<tr><td style="padding:14px 28px;border-bottom:1px solid #1E2430"><p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7A8794">Coming up</p>${data.events
                    .map(
                      (e) =>
                        `<p style="margin:4px 0;color:#B7C3D0">${escapeHtml(e.title)} — ${new Date(e.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>`,
                    )
                    .join("")}</td></tr>`
                : ""
            }
            ${
              data.threads.length
                ? `<tr><td style="padding:14px 28px;border-bottom:1px solid #1E2430"><p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7A8794">Hot forum threads</p>${data.threads
                    .map(
                      (t) =>
                        `<p style="margin:4px 0"><a href="${SITE_URL}/forums" style="color:#00E5FF;text-decoration:none">${escapeHtml(t.title)}</a></p>`,
                    )
                    .join("")}</td></tr>`
                : ""
            }
            <tr><td style="padding:20px 28px 8px">
              <a href="${SITE_URL}/" style="display:inline-block;background:#00E5FF;color:#001018;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px">Open the command center</a>
            </td></tr>
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #1E2430;font-size:12px;color:#7A8794">
            You're receiving this because of your Star Force Base 1198 account. Sign in and open the Account page to opt out of future digests.
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>`;
}

export const sendWeeklyDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const data = await ctx.runQuery(internal.digestData.weeklyDigestData, {});
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, reason: "not_configured", sent: 0 };
    if (!data.subscribers.length) return { ok: true, sent: 0 };

    const resend = new Resend(apiKey);
    let sent = 0;
    let failed = 0;
    for (const sub of data.subscribers) {
      try {
        const result = await resend.emails.send({
          from: FROM,
          to: sub.email,
          subject: `Weekly Fleet Digest — ${new Date(data.weekStart).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`,
          html: digestHtml({ ...data, name: sub.name }),
        });
        if (result.error) {
          failed += 1;
        } else {
          sent += 1;
        }
      } catch {
        failed += 1;
      }
    }
    return { ok: true, sent, failed };
  },
});
