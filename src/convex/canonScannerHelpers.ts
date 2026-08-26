import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// =========================================================================
// Canon Scanner — shared helpers for the Node-runtime action in
// canonScanner.ts. Queries and mutations live here (non-Node), the action
// lives next door ("use node") and calls these via ctx.runQuery /
// ctx.runMutation.
// =========================================================================

export const BASE_URL =
  process.env.CANON_SCANNER_BASE_URL ?? "https://api.groq.com/openai/v1";
// Groq decommissioned llama-3.3-70b-versatile on 2026-08-16 (free/dev
// tiers). Per Groq's deprecation notice, the recommended replacement is
// openai/gpt-oss-120b (qwen/qwen3.6-27b is the lighter alternative).
export const MODEL =
  process.env.CANON_SCANNER_MODEL ?? "openai/gpt-oss-120b";

const VERDICTS = ["canon", "conflict", "needs_review"] as const;
type Verdict = (typeof VERDICTS)[number];

const SEVERITIES = ["minor", "major", "critical"] as const;

export type CanonConflict = {
  claim: string;
  canonRef?: string;
  severity?: string;
};

export type CanonScan = {
  verdict: string;
  confidence?: number;
  summary?: string;
  conflicts?: CanonConflict[];
  model?: string;
  error?: string;
};

export const targetValidator = v.union(
  v.object({ kind: v.literal("story"), id: v.id("stories") }),
  v.object({ kind: v.literal("lore"), id: v.id("loreLibrary") }),
);

export const canonScanValidator = v.object({
  verdict: v.string(),
  confidence: v.optional(v.number()),
  summary: v.optional(v.string()),
  conflicts: v.optional(
    v.array(
      v.object({
        claim: v.string(),
        canonRef: v.optional(v.string()),
        severity: v.optional(v.string()),
      }),
    ),
  ),
  model: v.optional(v.string()),
  error: v.optional(v.string()),
});

// Static framing for the model. The authoritative canon is the dynamic
// corpus passed in each request; this brief only sets the universe context.
const CANON_BRIEF = `Star Force Base 1198 is a deep-space military sci-fi universe. Its canon is maintained by the site's operators in the lore archive: named characters, factions/fleets, sectors and locations, events, ranks, ships, and technology. Member submissions (stories and lore entries) must remain consistent with that established canon.`;

export function buildSystemPrompt(): string {
  return [
    "You are the Canon Compliance Scanner for Star Force Base 1198.",
    CANON_BRIEF,
    "You review a member submission against the ESTABLISHED CANON provided in the user message and return a JSON verdict.",
    "",
    "RULES",
    '- "verdict" must be exactly one of: "canon", "conflict", "needs_review".',
    '- "canon": the submission is consistent with canon (it may add new, non-contradictory detail).',
    '- "conflict": the submission directly contradicts a specific canon fact (character, faction, location, event, ship, technology, rank).',
    '- "needs_review": ambiguous, under-specified, or plausibly but not provably conflicting.',
    '- "confidence" is a number from 0.0 to 1.0.',
    '- "summary" is 1-2 plain-English sentences explaining the verdict.',
    '- "conflicts" is a JSON array of {claim, canonRef, severity} ONLY when verdict is "conflict" or "needs_review"; otherwise omit it. "claim" is the specific statement in the submission; "canonRef" is the canon fact it clashes with (or "unclear" when none is found); "severity" is one of "minor", "major", "critical".',
    "Output ONLY the JSON object. No markdown fences, no commentary, no trailing text.",
  ].join("\n");
}

export function buildUserPrompt(args: {
  corpus: string;
  title: string;
  meta: string[];
  text: string;
}): string {
  return [
    "ESTABLISHED CANON",
    "==================",
    args.corpus,
    "",
    "SUBMISSION",
    "==========",
    `Title: ${args.title}`,
    args.meta.length ? `Metadata: ${args.meta.join(" · ")}` : "",
    "",
    args.text || "(no body text provided)",
    "",
    "Return your verdict as a single JSON object.",
  ]
    .filter(Boolean)
    .join("\n");
}

// SambaNova's OpenAI-compatible endpoint does not guarantee a json_object
// response_format, so we ask for strict JSON in the prompt and parse
// defensively: strip code fences, then parse the first {...} span.
export function extractJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(s.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function asConfidence(n: unknown): number | undefined {
  if (typeof n !== "number" || Number.isNaN(n)) return undefined;
  return Math.max(0, Math.min(1, n));
}

function asString(s: unknown): string | undefined {
  return typeof s === "string" && s.trim() ? s.trim() : undefined;
}

function asConflicts(raw: unknown): CanonConflict[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CanonConflict[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const claim = asString(record.claim);
    if (!claim) continue;
    const severityRaw = asString(record.severity);
    out.push({
      claim: claim.slice(0, 500),
      canonRef: asString(record.canonRef)?.slice(0, 300),
      severity:
        severityRaw && (SEVERITIES as readonly string[]).includes(severityRaw)
          ? severityRaw
          : "minor",
    });
    if (out.length >= 8) break;
  }
  return out.length ? out : undefined;
}

export function normalizeVerdict(raw: Record<string, unknown>): CanonScan {
  const verdictRaw = asString(raw.verdict);
  const verdict = (VERDICTS as readonly string[]).includes(verdictRaw ?? "")
    ? (verdictRaw as Verdict)
    : "needs_review";
  return {
    verdict,
    confidence: asConfidence(raw.confidence),
    summary: asString(raw.summary)?.slice(0, 600),
    conflicts: asConflicts(raw.conflicts),
    model: MODEL,
  };
}

// ---- Internal reads (actions cannot touch ctx.db directly) ----------------

export type SubmissionAttachment = {
  storageId: string;
  fileName: string;
  mimeType: string;
};

/** Resolve a submission's scannable text + metadata, plus any attached
 *  manuscript file the action should try to read. */
export const getSubmissionText = internalQuery({
  args: { target: targetValidator },
  handler: async (ctx, { target }): Promise<{
    title: string;
    text: string;
    meta: string[];
    attachment?: SubmissionAttachment;
  } | null> => {
    if (target.kind === "story") {
      const doc = await ctx.db.get(target.id as Id<"stories">);
      if (!doc) return null;
      return {
        title: doc.title,
        text: [doc.excerpt, doc.content]
          .filter((x): x is string => Boolean(x))
          .join("\n\n")
          .slice(0, 20000),
        meta: [
          doc.series,
          ...(doc.factions ?? []),
          ...(doc.sectors ?? []),
          doc.classification,
        ].filter((x): x is string => Boolean(x)),
        attachment:
          doc.attachmentStorageId && doc.attachmentMeta
            ? {
                storageId: doc.attachmentStorageId,
                fileName: doc.attachmentMeta.fileName,
                mimeType: doc.attachmentMeta.mimeType,
              }
            : undefined,
      };
    }
    const doc = await ctx.db.get(target.id as Id<"loreLibrary">);
    if (!doc) return null;
    return {
      title: doc.title,
      text: doc.description.slice(0, 4000),
      meta: [
        doc.loreType,
        doc.faction,
        doc.sector,
        doc.era,
        doc.classification,
        doc.databaseName,
      ].filter((x): x is string => Boolean(x)),
      attachment:
        doc.fileStorageId && doc.fileMeta
          ? {
              storageId: doc.fileStorageId,
              fileName: doc.fileMeta.fileName,
              mimeType: doc.fileMeta.mimeType,
            }
          : undefined,
    };
  },
});

/** Build a compact, bounded canon corpus for the model prompt. */
export const getCanonCorpus = internalQuery({
  args: {},
  handler: async (ctx): Promise<string> => {
    const [lore, published] = await Promise.all([
      ctx.db.query("loreEntries").order("desc").take(40),
      ctx.db
        .query("stories")
        .withIndex("by_status", (q) => q.eq("status", "published"))
        .order("desc")
        .take(40),
    ]);

    const parts: string[] = [];

    for (const e of lore) {
      const meta = [
        e.faction,
        e.sector,
        e.era,
        e.classification,
        e.entryType,
      ]
        .filter((x): x is string => Boolean(x))
        .join(" · ");
      parts.push(
        `LORE: ${e.title}${meta ? ` [${meta}]` : ""} — ${(e.excerpt ?? "").slice(0, 280)}`,
      );
    }

    for (const s of published) {
      const meta = [
        ...(s.factions ?? []),
        ...(s.sectors ?? []),
        s.classification,
      ]
        .filter((x): x is string => Boolean(x))
        .join(" · ");
      parts.push(
        `STORY: ${s.title}${meta ? ` [${meta}]` : ""} — ${(s.excerpt ?? "").slice(0, 280)}`,
      );
    }

    let corpus = parts.join("\n");
    if (corpus.length > 30000) {
      corpus = corpus.slice(0, 30000);
    }
    return (
      corpus || "(no canon corpus recorded yet — treat unknowns as needs_review)"
    );
  },
});

/** Internal write path — the action cannot patch the DB directly. */
export const recordCanonScan = internalMutation({
  args: {
    target: targetValidator,
    canonScan: canonScanValidator,
  },
  handler: async (ctx, { target, canonScan }) => {
    const canonScanAt = Date.now();
    if (target.kind === "story") {
      await ctx.db.patch(target.id as Id<"stories">, {
        canonScan,
        canonScanAt,
      });
    } else {
      await ctx.db.patch(target.id as Id<"loreLibrary">, {
        canonScan,
        canonScanAt,
      });
    }
    return { ok: true };
  },
});

const OPERATOR_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
] as const;

/** Operator trigger to re-run the canon scan on an existing submission. */
export const rescanCanon = mutation({
  args: { target: targetValidator },
  handler: async (ctx, { target }) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (
      user?.role !== "admin" &&
      !OPERATOR_CAPS.includes(
        String(user?.opRole ?? "") as (typeof OPERATOR_CAPS)[number],
      )
    ) {
      throw new Error("Forbidden.");
    }

    if (target.kind === "story") {
      const doc = await ctx.db.get(target.id as Id<"stories">);
      if (!doc) throw new Error("Story not found.");
    } else {
      const doc = await ctx.db.get(target.id as Id<"loreLibrary">);
      if (!doc) throw new Error("Lore item not found.");
    }

    await ctx.scheduler.runAfter(0, api.canonScanner.scanSubmission, {
      target,
    });
    return { ok: true };
  },
});

/**
 * Operator batch trigger: queue a canon scan for every pending submission
 * that still needs one (never scanned, previously errored — e.g. the key was
 * missing — or flagged needs_review). Scans are staggered 4s apart so the
 * burst stays under SambaNova's 20 requests/minute developer-tier limit.
 */
export const rescanPendingCanon = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await getAuthUserId(ctx);
    if (!me) throw new Error("Sign in required.");
    const user = await ctx.db.get(me);
    if (
      user?.role !== "admin" &&
      !OPERATOR_CAPS.includes(
        String(user?.opRole ?? "") as (typeof OPERATOR_CAPS)[number],
      )
    ) {
      throw new Error("Forbidden.");
    }

    const max = Math.max(1, Math.min(args.limit ?? 20, 40));
    const needsScan = (
      scan: { verdict?: string; error?: string } | undefined,
    ) => !scan || !!scan.error || scan.verdict === "needs_review";

    const [submitted, inReview, lorePending] = await Promise.all([
      ctx.db
        .query("stories")
        .withIndex("by_status", (q) => q.eq("status", "submitted"))
        .collect(),
      ctx.db
        .query("stories")
        .withIndex("by_status", (q) => q.eq("status", "in_review"))
        .collect(),
      ctx.db
        .query("loreLibrary")
        .withIndex("by_status", (q) => q.eq("status", "submitted"))
        .collect(),
    ]);

    type ScanTarget =
      | { kind: "story"; id: Id<"stories"> }
      | { kind: "lore"; id: Id<"loreLibrary"> };
    const eligible: ScanTarget[] = [];
    for (const s of [...submitted, ...inReview]) {
      if (needsScan(s.canonScan)) eligible.push({ kind: "story", id: s._id });
    }
    for (const l of lorePending) {
      if (needsScan(l.canonScan)) eligible.push({ kind: "lore", id: l._id });
    }
    const queue = eligible.slice(0, max);

    // 4s spacing → 15 req/min, under the 20 req/min developer-tier ceiling.
    const SPACING_MS = 4000;
    for (let i = 0; i < queue.length; i++) {
      await ctx.scheduler.runAfter(i * SPACING_MS, api.canonScanner.scanSubmission, {
        target: queue[i],
      });
    }

    await ctx.db.insert("auditLog", {
      actorId: me,
      action: "canon.batch_rescan",
      target: "canon",
      meta: JSON.stringify({
        queued: queue.length,
        totalEligible: eligible.length,
        staggeredMs: SPACING_MS,
      }),
      createdAt: Date.now(),
    });

    return { ok: true, queued: queue.length, totalEligible: eligible.length };
  },
});
