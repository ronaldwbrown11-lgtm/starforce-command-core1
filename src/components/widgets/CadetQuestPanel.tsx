import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { Check, ChevronRight, Coins, Gift, X, Zap } from "lucide-react";
import { HoloCard, NeonButton, StatusPill } from "../uf";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Cadet Induction quest (#38) — a guided first-week mission that teaches the
// loop that keeps the fleet alive. Completion is derived from real activity
// (quest.getQuestStatus), so every step flips green the moment it is actually
// done. Shown on the Account and Activity pages; self-hides once dismissed
// or the reward is claimed. forceShow re-displays it regardless.
// ---------------------------------------------------------------------------

const STEP_HINTS: Record<string, string> = {
  profile: "Set a callsign, rank, and home fleet so the roster knows you.",
  group: "Groups are where missions, threads, and real-time ops happen.",
  react: "Signal a story — reactions earn XP and feed the archives.",
  report: "Run an open operation and log what the fleet observed.",
  badge: "Every contribution unlocks achievements. Bank your first one.",
};

export function CadetQuestPanel({ forceShow = false }: { forceShow?: boolean }) {
  const status = useQuery(api.quest.getQuestStatus, {});
  const claim = useMutation(api.quest.claimQuestReward);
  const dismiss = useMutation(api.quest.dismissQuest);
  const [busy, setBusy] = useState<"claim" | "dismiss" | null>(null);

  if (status === undefined) {
    return (
      <HoloCard aria-label="Cadet induction loading">
        <div className="uf-skeleton" style={{ height: 148 }} />
      </HoloCard>
    );
  }
  if (status === null) return null; // signed out
  if (!forceShow && (status.dismissed || status.claimed)) return null;

  const percent = Math.round((status.completedCount / status.total) * 100);
  const nextIndex = status.steps.findIndex((s) => !s.done);
  const allDone = status.allDone && !status.claimed;

  const handleClaim = async () => {
    setBusy("claim");
    try {
      const res = await claim();
      toast.success(
        `Induction complete — banked ${res.xp} XP and ${res.credits} Star Credits. Welcome to the fleet.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't claim the reward.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = async () => {
    setBusy("dismiss");
    try {
      await dismiss();
    } catch {
      toast.error("Couldn't dismiss the quest right now.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <HoloCard
      accent="cyan"
      className="relative overflow-hidden !border-[rgba(0,229,255,0.28)]"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(420px 200px at 8% 0%, rgba(0,229,255,0.12), transparent 65%), linear-gradient(160deg, rgba(16,24,39,0.4), rgba(5,8,22,0.2))",
        }}
      />
      <div className="relative">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="uf-eyebrow">Cadet Induction · Week One</span>
            <h2 className="text-xl font-semibold mt-1.5 flex items-center gap-2">
              <Gift className="h-5 w-5 text-uf-cyan" aria-hidden />
              Your first mission directive
            </h2>
            <p className="text-uf-muted text-sm mt-1 max-w-[62ch]">
              Five steps. Real actions, no busywork — each one unlocks the XP,
              Star Credits, and vault systems you'll live in as a pilot.
              {status.completedCount > 0 && !status.allDone && (
                <>
                  {" "}
                  {status.completedCount} of {status.total} complete — pick up
                  where you left off.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill variant={status.allDone ? "success" : "info"}>
              {status.completedCount}/{status.total} objectives
            </StatusPill>
            {!status.claimed && (
              <button
                type="button"
                onClick={handleDismiss}
                disabled={busy !== null}
                aria-label="Dismiss the Cadet Induction quest"
                title="Not now"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted transition-colors hover:bg-[rgba(0,229,255,0.08)] hover:text-uf-text disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </header>

        <div
          className="uf-progress mt-4"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={status.total}
          aria-valuenow={status.completedCount}
          aria-label={`Cadet induction progress: ${status.completedCount} of ${status.total} steps complete`}
        >
          <div className="uf-progress__bar" style={{ width: `${percent}%` }} />
        </div>

        <ol className="mt-4 grid gap-2 list-none p-0 m-0 sm:grid-cols-2 lg:grid-cols-5">
          {status.steps.map((step, idx) => {
            const isNext = idx === nextIndex && !status.allDone;
            return (
              <li key={step.key} className="min-w-0">
                {step.done ? (
                  <div
                    className="h-full rounded-md border border-[rgba(45,255,136,0.30)] bg-[rgba(45,255,136,0.06)] p-3"
                    aria-label={`${step.label}: complete`}
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-uf-green">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Done
                    </span>
                    <p className="text-sm font-medium text-uf-text mt-1">
                      {step.label}
                    </p>
                  </div>
                ) : (
                  <Link
                    to={step.href}
                    aria-label={`${step.label} — ${step.cta}`}
                    className={
                      "h-full flex flex-col rounded-md border p-3 transition-colors group " +
                      (isNext
                        ? "border-[rgba(0,229,255,0.45)] bg-[rgba(0,229,255,0.07)] shadow-[var(--uf-glow-cyan)]"
                        : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] hover:border-[rgba(0,229,255,0.35)] hover:bg-[rgba(0,229,255,0.05)]")
                    }
                  >
                    <span
                      className={
                        "inline-flex items-center gap-1.5 text-xs font-medium " +
                        (isNext ? "text-uf-cyan" : "text-uf-muted")
                      }
                    >
                      <span className="font-mono">0{idx + 1}</span>
                      {isNext && (
                        <span className="text-[9px] uppercase tracking-[0.16em]">
                          Next
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-medium text-uf-text mt-1 flex items-center gap-1">
                      {step.label}
                      <ChevronRight
                        className="h-3.5 w-3.5 text-uf-muted transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                    <span className="text-[11px] leading-4 text-uf-muted mt-1.5">
                      {STEP_HINTS[step.key] ?? step.cta}
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        <footer className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] p-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-uf-muted">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-uf-gold" aria-hidden />
              XP powers your rank ladder.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-uf-cyan" aria-hidden />
              Star Credits buy pilot frames in the vault.
            </span>
            <Link
              to="/vault"
              className="inline-flex items-center gap-1 text-uf-cyan hover:underline"
            >
              Open the Signal Vault <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status.allDone && !status.claimed ? (
              <NeonButton
                variant="gold"
                loading={busy === "claim"}
                disabled={busy !== null}
                onClick={handleClaim}
              >
                Claim {status.reward.xp} XP + {status.reward.credits} credits
              </NeonButton>
            ) : (
              <>
                <StatusPill variant="cyan">
                  Payout: {status.reward.xp} XP · {status.reward.credits} Star
                  Credits
                </StatusPill>
                {status.completedCount === 0 && (
                  <NeonButton
                    variant="ghost"
                    onClick={() => {
                      const first = status.steps.find((s) => !s.done);
                      if (first) window.location.href = first.href;
                    }}
                  >
                    Start step one
                  </NeonButton>
                )}
              </>
            )}
          </div>
        </footer>
      </div>
    </HoloCard>
  );
}
