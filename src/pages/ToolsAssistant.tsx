import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "react-router";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, PenLine } from "lucide-react";

type AssistantResult = {
  ok: boolean;
  error?: string;
  verdict?: "aligned" | "conflict" | "needs_work";
  issues?: Array<{ severity: "minor" | "major"; note: string }>;
  suggestions?: string[];
  polishedDraft?: string;
  usesLeft?: number;
};

export default function ToolsAssistant() {
  const { isAuthenticated, user } = useAuth();
  const runAssistant = useAction(api.aiAssistant.loreAssistant);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AssistantResult | null>(null);

  usePageMeta({
    title: "AI Lore Assistant — Star Force Base 1198",
    description:
      "Paste your draft and the Lore Assistant checks canon, validates timelines, flags character conflicts, and suggests a polished rewrite.",
    noindex: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;
    if (!draft.trim()) {
      setResult({ ok: false, error: "Paste a draft first — even a rough one." });
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await runAssistant({
        draft,
        target: target.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Assistant error — try again shortly.",
      });
    } finally {
      setRunning(false);
    }
  };

  const tier = user?.tier ?? "free";

  return (
    <SiteShell>
      <PageHero
        eyebrow="Creative tools"
        title="AI Lore Assistant."
        lead="Paste a draft. The assistant checks it against the canon corpus, validates the timeline, flags character conflicts, and hands back a polished rewrite — so your drops land Bridge-ready."
        primary={{
          label: isAuthenticated ? "Run the assistant" : "Sign in to use it",
          href: isAuthenticated ? "#assistant" : "/auth?returnTo=/tools/assistant",
          variant: "primary",
        }}
        secondary={{ label: "Membership tiers", href: "/membership", variant: "ghost" }}
      />

      <section id="assistant" className="uf-section max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <HoloCard>
            <span className="uf-eyebrow flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Lore Assistant
            </span>
            {!isAuthenticated ? (
              <div className="uf-empty mt-4">
                Sign in to run the assistant. Free members get a daily taste;
                paid tiers get the full toolkit.{" "}
                <Link to="/auth?returnTo=/tools/assistant" className="text-uf-cyan underline">
                  Sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-uf-muted">Your draft</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={10}
                    maxLength={12000}
                    placeholder="Paste your story or lore entry here — the rough draft is fine."
                    className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-uf-muted">
                    Context or questions <span className="opacity-60">(optional)</span>
                  </span>
                  <input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    maxLength={2000}
                    placeholder="e.g. Set after the Siege of New Terra. Is this consistent with the Chrono Monks timeline?"
                    className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                  />
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="submit" disabled={running} className="uf-btn uf-btn--primary">
                    {running ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Consulting the archive…
                      </>
                    ) : (
                      "Run the assistant"
                    )}
                  </button>
                  {result?.usesLeft !== undefined && !running && (
                    <span className="text-xs text-uf-muted">
                      {result.usesLeft} use{result.usesLeft === 1 ? "" : "s"} left today
                    </span>
                  )}
                </div>
              </form>
            )}

            {result && (
              <div className="mt-6 flex flex-col gap-4">
                {!result.ok && result.error ? (
                  <div className="rounded-md border border-[rgba(255,77,109,0.4)] bg-[rgba(255,77,109,0.08)] p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold text-[var(--uf-red)]">
                      <AlertTriangle className="h-4 w-4" aria-hidden /> Assistant blocked
                    </p>
                    <p className="text-uf-text/90 mt-1">{result.error}</p>
                    {tier === "free" && (
                      <Link to="/membership" className="text-uf-cyan underline text-xs mt-2 inline-block">
                        Paid tiers get 25+ runs a day →
                      </Link>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusPill
                        variant={
                          result.verdict === "aligned"
                            ? "success"
                            : result.verdict === "conflict"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {result.verdict === "aligned"
                          ? "Canon aligned"
                          : result.verdict === "conflict"
                            ? "Canon conflict"
                            : "Needs work"}
                      </StatusPill>
                      {result.usesLeft !== undefined && (
                        <span className="text-xs text-uf-muted">
                          {result.usesLeft} use{result.usesLeft === 1 ? "" : "s"} left today
                        </span>
                      )}
                    </div>

                    {result.issues && result.issues.length > 0 && (
                      <div>
                        <p className="uf-eyebrow">Canon checks</p>
                        <ul className="mt-2 flex flex-col gap-2 list-none p-0 m-0">
                          {result.issues.map((issue, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2 text-sm"
                            >
                              <span
                                className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                                  issue.severity === "major"
                                    ? "bg-[var(--uf-red)]"
                                    : "bg-[var(--uf-gold)]"
                                }`}
                                aria-hidden
                              />
                              <span className="text-uf-text/90">{issue.note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.suggestions && result.suggestions.length > 0 && (
                      <div>
                        <p className="uf-eyebrow">Suggestions</p>
                        <ul className="mt-2 flex flex-col gap-2 list-none p-0 m-0">
                          {result.suggestions.map((s, i) => (
                            <li key={i} className="text-sm text-uf-text/90 flex gap-2">
                              <CheckCircle2 className="h-4 w-4 text-uf-cyan shrink-0 mt-0.5" aria-hidden />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.polishedDraft ? (
                      <div>
                        <p className="uf-eyebrow flex items-center gap-1.5">
                          <PenLine className="h-3.5 w-3.5" aria-hidden /> Polished draft
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] p-4 text-sm text-uf-text/90">
                          {result.polishedDraft}
                        </pre>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </HoloCard>

          <div className="flex flex-col gap-6">
            <HoloCard>
              <span className="uf-eyebrow">What it checks</span>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-uf-muted list-none p-0 m-0">
                <li>• Canon consistency against the live lore archive</li>
                <li>• Timeline placement and era conflicts</li>
                <li>• Character and faction relationship consistency</li>
                <li>• A polished rewrite that keeps your voice</li>
              </ul>
            </HoloCard>
            <HoloCard>
              <span className="uf-eyebrow">Daily allowance</span>
              <ul className="mt-3 flex flex-col gap-2 text-sm list-none p-0 m-0">
                <li className="flex justify-between">
                  <span className="text-uf-muted">Free</span>
                  <span className="text-uf-text">3 runs</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-uf-muted">Cadet / Officer / Command / G.I.A.</span>
                  <span className="text-uf-text">25–50 runs</span>
                </li>
              </ul>
              <Link to="/membership" className="text-uf-cyan text-sm mt-3 inline-block">
                Upgrade for the full toolkit →
              </Link>
            </HoloCard>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
