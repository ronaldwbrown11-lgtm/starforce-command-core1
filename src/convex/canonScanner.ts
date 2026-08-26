"use node";

import { action, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  BASE_URL,
  MODEL,
  buildSystemPrompt,
  buildUserPrompt,
  extractJson,
  normalizeVerdict,
  targetValidator,
  type CanonScan,
  type SubmissionAttachment,
} from "./canonScannerHelpers";

// Manuscripts we can read directly as text in the Node runtime. Binary
// formats (PDF / DOC / DOCX) are left for the operator to open manually —
// they are noted in the prompt so the model knows it saw an unread file.
const TEXT_MIME = new Set(["text/plain", "text/markdown"]);

async function readAttachmentText(
  ctx: ActionCtx,
  attachment: SubmissionAttachment,
): Promise<{ text?: string; note?: string }> {
  if (!TEXT_MIME.has(attachment.mimeType)) {
    return {
      note: `Attached file "${attachment.fileName}" (${attachment.mimeType}) was not auto-read — review it manually.`,
    };
  }
  try {
    const url = await ctx.storage.getUrl(attachment.storageId as Id<"_storage">);
    if (!url) return { note: `Attached file "${attachment.fileName}" could not be resolved.` };
    const res = await fetch(url);
    if (!res.ok) {
      return { note: `Attached file "${attachment.fileName}" failed to load (HTTP ${res.status}).` };
    }
    const raw = await res.text();
    return { text: raw.slice(0, 20000) };
  } catch {
    return { note: `Attached file "${attachment.fileName}" failed to load.` };
  }
}

// =========================================================================
// Canon Scanner — AI canon-compliance review for member submissions.
//
// Node-runtime action that reads a submission + the canon corpus via
// internal queries, sends both to an OpenAI-compatible chat-completions
// endpoint, then persists the structured verdict via an internal mutation.
// All queries/mutations/validators live in canonScannerHelpers.ts because
// Node-runtime files may only export actions.
//
// Provider: Groq Cloud (permanent free tier, no card required)
//   https://console.groq.com/docs/openai
//
// Required env var (paste into the project's Keys / API keys tab):
//   GROQ_API_KEY — server-side API key
// Optional:
//   CANON_SCANNER_MODEL    — defaults to "llama-3.3-70b-versatile"
//   CANON_SCANNER_BASE_URL — defaults to "https://api.groq.com/openai/v1"
//   (SAMBANOVA_API_KEY is still accepted as a fallback for existing setups)
// =========================================================================

export const scanSubmission = action({
  args: { target: targetValidator },
  handler: async (ctx, { target }): Promise<{ ok: boolean; error?: string }> => {
    const submission = await ctx.runQuery(
      internal.canonScannerHelpers.getSubmissionText,
      { target },
    );
    if (!submission) {
      return { ok: false, error: `${target.kind}_not_found` };
    }

    // ---- missing key → record a needs_review with a clear error ----------
    const apiKey =
      process.env.GROQ_API_KEY ??
      process.env.SAMBANOVA_API_KEY ??
      process.env.CANON_SCANNER_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.canonScannerHelpers.recordCanonScan, {
        target,
        canonScan: {
          verdict: "needs_review",
          summary: "Canon scan skipped — AI provider is not configured.",
          error:
            "GROQ_API_KEY not set. Add it in the Keys/API keys tab.",
        },
      });
      return { ok: false, error: "missing_api_key" };
    }

    // ---- build canon corpus + prompt -------------------------------------
    const corpus = await ctx.runQuery(internal.canonScannerHelpers.getCanonCorpus, {});

    // Read any attached manuscript so the scanner reviews the actual text,
    // not just the excerpt/description. Binary formats get an explicit note.
    const attachment = submission.attachment
      ? await readAttachmentText(ctx, submission.attachment)
      : null;
    const scannableText = [
      submission.text,
      attachment?.text
        ? `ATTACHED MANUSCRIPT\n===================\n${attachment.text}`
        : null,
      attachment?.note ? `NOTE: ${attachment.note}` : null,
    ]
      .filter((x): x is string => Boolean(x))
      .join("\n\n");

    const userPrompt = buildUserPrompt({
      corpus,
      title: submission.title,
      meta: submission.meta,
      text: scannableText,
    });

    let scan: CanonScan;
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 900,
        }),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(
          `HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`,
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content);
      if (!parsed) {
        throw new Error("Unparseable model response");
      }
      scan = normalizeVerdict(parsed);
    } catch (e) {
      // Never throw out of the action — record a needs_review with the
      // reason so the operator still sees a (blocked) scan rather than a
      // silent failure.
      scan = {
        verdict: "needs_review",
        summary: "Canon scan failed — manual review required.",
        model: MODEL,
        error: e instanceof Error ? e.message.slice(0, 400) : "unknown_error",
      };
    }

    await ctx.runMutation(internal.canonScannerHelpers.recordCanonScan, {
      target,
      canonScan: scan,
    });
    return { ok: true };
  },
});
