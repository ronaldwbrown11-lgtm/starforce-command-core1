"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { BASE_URL, MODEL, extractJson } from "./canonScannerHelpers";
import { readProviderUsage, estimateCostUsd } from "./aiCost";

// =========================================================================
// AI signal forge — operator tool for the Signal Vault.
//
// Node-runtime action (it calls the AI provider). Uses the same
// OpenAI-compatible endpoint and API key as the Lore Assistant and the
// Canon Scanner (GROQ_API_KEY, with the same fallbacks).
//
// Drafts ONLY: nothing touches the signals table here. The operator reviews
// the drafts and saves them explicitly via signals.createSignal (single) or
// signals.createSignalsForCampaign (batch attached to an ARG season).
// =========================================================================

export type SignalDraft = {
  title: string;
  ciphertext: string;
  hint: string;
  answer: string;
  rewardXp: number;
  rewardCredits: number;
  tierRequired: string | null;
};

const FORGE_SYSTEM_PROMPT = `You are the signals officer of Star Force Base 1198, a sci-fi fleet community. You forge "intercepted transmissions": short in-universe cipher puzzles for members to decrypt.

Rules for every signal:
- answer: a single real English word or a very short in-universe phrase (1-3 words). This is the decrypted plaintext.
- ciphertext: a genuine, self-consistently solvable encoding of the answer. Rotate among these styles across signals: Caesar shift (state the shift in the hint), Atbash, A1Z26 (letters to numbers, hyphen-separated), reversed text (hint says "read it backwards"), or keyboard-shift. NEVER invent an undecryptable alien script.
- hint: one sentence that makes the cipher fairly solvable (name the method; give the shift if Caesar).
- title: an evocative in-universe interception name.
- tierRequired: exactly one of null, "cadet", "officer", "command", "elite", "gia_agent". Vary difficulty: easier ciphers for null/cadet, harder for higher tiers.
- rewardXp: 15-60 scaled to difficulty. rewardCredits: 10-45 scaled to difficulty.

Return STRICT JSON only, no markdown fences:
{"drafts":[{"title":string,"ciphertext":string,"hint":string,"answer":string,"rewardXp":number,"rewardCredits":number,"tierRequired":string|null}]}`;

export const generateSignalDrafts = action({
  args: {
    count: v.optional(v.number()),
    theme: v.optional(v.string()),
    campaignSeason: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Same gate as requireOperatorCapability, inlined: actions have no db
    // handle, so the shared query/mutation-context helper doesn't accept an
    // action ctx. Auth decision runs in a query; this keeps the check server-
    // side and identical to the rest of the operator surface.
    const auth = await ctx.runQuery(internal.admin.isOperatorWithCaps, {
      caps: ["operator", "senior_operator", "lore_archivist"],
    });
    if (!auth.allowed) throw new Error(auth.error ?? "Forbidden.");

    const count = Math.max(1, Math.min(12, Math.round(args.count ?? 4)));
    const apiKey =
      process.env.GROQ_API_KEY ??
      process.env.SAMBANOVA_API_KEY ??
      process.env.CANON_SCANNER_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error:
          "AI provider is not configured — add GROQ_API_KEY in the API keys panel.",
      };
    }

    const themeLine = args.theme?.trim()
      ? `Season theme: "${args.theme.trim().slice(0, 300)}". Titles, flavor, and answers should fit it where natural.`
      : "";
    const seasonLine = args.campaignSeason
      ? `These are for Season ${args.campaignSeason} of the ongoing ARG.`
      : "";

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
            { role: "system", content: FORGE_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Forge ${count} distinct signal${count === 1 ? "" : "s"}. ${themeLine} ${seasonLine}`.trim(),
            },
          ],
          temperature: 0.8,
          max_tokens: 2200,
        }),
      });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(
          `AI provider error HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(content) as { drafts?: unknown } | null;
      const raw = Array.isArray(parsed?.drafts)
        ? (parsed!.drafts as Array<Record<string, unknown>>)
        : [];
      const validTiers = ["cadet", "officer", "command", "elite", "gia_agent"];
      const drafts: SignalDraft[] = raw
        .map((d) => ({
          title: String(d.title ?? "").slice(0, 120),
          ciphertext: String(d.ciphertext ?? "").slice(0, 600),
          hint: String(d.hint ?? "").slice(0, 300),
          answer: String(d.answer ?? "").slice(0, 120),
          rewardXp: Math.max(5, Math.min(200, Number(d.rewardXp) || 20)),
          rewardCredits: Math.max(5, Math.min(150, Number(d.rewardCredits) || 15)),
          tierRequired: validTiers.includes(String(d.tierRequired))
            ? String(d.tierRequired)
            : null,
        }))
        .filter((d) => d.title && d.ciphertext && d.hint && d.answer)
        .slice(0, count);

      if (drafts.length === 0) {
        return {
          ok: false as const,
          error: "The model returned no usable drafts — try again.",
        };
      }

      // Cost ledger — same surface bookkeeping as the other AI features.
      const usage = readProviderUsage(data);
      const costUsd = estimateCostUsd(MODEL, usage.inputTokens, usage.outputTokens);
      await ctx.runMutation(internal.aiCost.logAiCall, {
        userId: undefined,
        surface: "signal_forge",
        model: MODEL,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd,
        createdAt: Date.now(),
      });

      return { ok: true as const, drafts, costUsd };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Signal forge failed.",
      };
    }
  },
});
