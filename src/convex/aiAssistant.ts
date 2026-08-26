"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  BASE_URL,
  MODEL,
  extractJson,
} from "./canonScannerHelpers";
import { DAILY_LIMITS } from "./aiAssistantHelpers";

// =========================================================================
// Lore Assistant (#28) — the flagship creative tool and paid-tier upsell.
//
// Node-runtime action that takes a member's lore/story draft, pulls the
// canon corpus (same one the Canon Scanner uses), and asks the model to:
//   1. verify canon consistency + timeline placement
//   2. flag character/relationship conflicts
//   3. suggest improvements
//   4. produce a polished draft
//
// Provider: Groq Cloud (same key as the Canon Scanner — GROQ_API_KEY).
// Metered per tier per day via aiAssistantLogs (free 3, paid 25+).
// =========================================================================

export type AssistantIssue = {
  severity: "minor" | "major";
  note: string;
};

export type AssistantResult = {
  ok: boolean;
  error?: string;
  verdict?: "aligned" | "conflict" | "needs_work";
  issues?: AssistantIssue[];
  suggestions?: string[];
  polishedDraft?: string;
  usesLeft?: number;
};

const SYSTEM_PROMPT = `You are the Lore Assistant aboard Star Force Base 1198, an AI editor who enforces the fleet's canon. You validate timelines, flag character and relationship inconsistencies, check faction lore, and help members polish their submissions — without inventing new canon facts.

Rules:
- Never invent canon facts. If the corpus doesn't cover something, say it's unverified rather than asserting it.
- Be concrete and specific; reference the canon entries you're comparing against.
- The polished draft must preserve the member's voice and story intent, only fixing conflicts and tightening prose.

Respond with STRICT JSON only, no markdown fences, in exactly this shape:
{
  "verdict": "aligned" | "conflict" | "needs_work",
  "issues": [{"severity": "minor" | "major", "note": "..."}],
  "suggestions": ["...", "..."],
  "polishedDraft": "..."
}`;

export const loreAssistant = action({
  args: {
    draft: v.string(),
    // Optional freeform context: what the member is writing and any
    // specific questions (e.g. "set after the Siege of New Terra").
    target: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<AssistantResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { ok: false, error: "Sign in to use the Lore Assistant." };
    }

    const draft = args.draft.trim().slice(0, 12000);
    if (draft.length < 40) {
      return { ok: false, error: "Paste at least a short draft — 40+ characters." };
    }

    const me = await ctx.runQuery(internal.aiAssistantHelpers.getAssistantUser, {
      userId,
    });
    if (!me) {
      return { ok: false, error: "Account not found." };
    }
    const limit = DAILY_LIMITS[me.tier] ?? DAILY_LIMITS.free;
    const used = await ctx.runQuery(internal.aiAssistantHelpers.countTodayUses, {
      userId,
    });
    const usesLeft = Math.max(0, limit - used);
    if (used >= limit) {
      return {
        ok: false,
        error: `Daily assistant allowance reached (${limit}/day). Paid tiers get 25+ runs — upgrade for the full toolkit.`,
        usesLeft: 0,
      };
    }

    const apiKey =
      process.env.GROQ_API_KEY ??
      process.env.SAMBANOVA_API_KEY ??
      process.env.CANON_SCANNER_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: "AI provider is not configured — the Bridge is on it.",
        usesLeft,
      };
    }

    const corpus = await ctx.runQuery(internal.canonScannerHelpers.getCanonCorpus, {});
    const corpusText = corpus.slice(0, 24000);

    const userPrompt = [
      "CANON CORPUS (the authoritative record)",
      "========================================",
      corpusText || "(empty corpus — flag everything as unverified)",
      "",
      "MEMBER'S DRAFT",
      "==============",
      draft,
      "",
      args.target?.trim()
        ? `MEMBER'S CONTEXT / QUESTIONS\n============================\n${args.target.trim().slice(0, 2000)}`
        : null,
    ]
      .filter((x): x is string => Boolean(x))
      .join("\n\n");

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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 1400,
        }),
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content) as Record<string, unknown>;

      await ctx.runMutation(internal.aiAssistantHelpers.recordAssistantUse, { userId });

      const issues = Array.isArray(parsed.issues)
        ? (parsed.issues as AssistantIssue[]).slice(0, 8)
        : [];
      const suggestions = Array.isArray(parsed.suggestions)
        ? (parsed.suggestions as string[]).slice(0, 6)
        : [];
      const verdict = ["aligned", "conflict", "needs_work"].includes(
        String(parsed.verdict),
      )
        ? (parsed.verdict as AssistantResult["verdict"])
        : "needs_work";

      return {
        ok: true,
        verdict,
        issues,
        suggestions,
        polishedDraft:
          typeof parsed.polishedDraft === "string"
            ? parsed.polishedDraft.slice(0, 12000)
            : "",
        usesLeft: usesLeft - 1,
      };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? `Assistant error: ${e.message.slice(0, 300)}`
            : "Assistant error — try again shortly.",
        usesLeft,
      };
    }
  },
});
