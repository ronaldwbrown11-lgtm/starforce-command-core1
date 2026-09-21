import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router";
import {
  Check,
  Coins,
  Flame,
  Gift,
  Swords,
  Zap,
} from "lucide-react";
import { HoloCard, NeonButton, StatusPill } from "../uf";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// First Watch panel — the tracked activation funnel. Objectives are derived
// from real account activity (engagement.firstWatchStatus): Orientation,
// three atlas worlds, a lore/story entry, faction membership, and a first
// artifact. Completing all five unlocks a one-time XP + Star Credits bonus,
// and the claim fires an activity-feed entry so the fleet sees it.
// ---------------------------------------------------------------------------

export function FirstWatchPanel({ forceShow = false }: { forceShow?: boolean }) {
  const { isAuthenticated, isLoading } = useAuth();
  const status = useQuery(
    api.engagement.firstWatchStatus,
    isAuthenticated ? {} : "skip",
  );
  const claim = useMutation(api.engagement.claimFirstWatchReward);
  const streak = useMutation(api.engagement.touchStreak);
  const [claiming, setClaiming] = useState(false);

  // Daily check-in: fires once per UTC day per session, exactly when the
  // member is signed in and the auth state has resolved.
  useEffect(() => {
    if (!isAuthenticated) return;
    void streak().catch(() => {
      /* best-effort; retried on next mount */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <HoloCard aria-label="First Watch loading">
        <div className="uf-skeleton" style={{ height: 160 }} />
      </HoloCard>
    );
  }
  if (isAuthenticated && status === undefined) {
    return (
      <HoloCard aria-label="First Watch loading">
        <div className="uf-skeleton" style={{ height: 160 }} />
      </HoloCard>
    );
  }
  // Single narrowing guard: signed out, or no status (undefined/null) hides.
  if (!isAuthenticated || !status) return null;
  if (!forceShow && (status.claimed || status.completedCount === 0)) {
    return null;
  }

  async function handleClaim() {
    setClaiming(true);
    try {
      const res = await claim({});
      toast.success(
        `First Watch complete — +${res.xp} XP, +${res.credits}★ awarded.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <HoloCard aria-label="First Watch activation guide">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="uf-eyebrow">First Watch</span>
          <h3 className="text-lg font-semibold mt-1">
            Your first five objectives
          </h3>
          <p className="text-uf-muted text-sm mt-0.5">
            Complete the watch and the fleet pays out your activation bonus.
          </p>
        </div>
        <StatusPill variant={status.allDone ? "success" : "default"}>
          {status.completedCount}/{status.total}
        </StatusPill>
      </div>

      <ul className="flex flex-col gap-2 list-none p-0 m-0" role="list">
        {status.steps.map((step) => (
          <li key={step.key}>
            <Link
              to={step.cta.href}
              className="flex items-center gap-3 rounded-md border border-[color:var(--uf-border)] px-3 py-2.5 min-h-[44px] transition-colors hover:border-[rgba(0,229,255,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--uf-cyan)]"
            >
              <span
                aria-hidden
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                  step.done
                    ? "border-[rgba(74,222,128,0.6)] bg-[rgba(74,222,128,0.12)] text-[#4ade80]"
                    : "border-[color:var(--uf-border)] text-uf-muted"
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-sm font-medium ${
                    step.done ? "text-uf-muted line-through" : "text-uf-text"
                  }`}
                >
                  {step.title}
                </span>
                <span className="block text-xs text-uf-muted line-clamp-1">
                  {step.body}
                </span>
              </span>
              <span className="text-uf-muted text-xs shrink-0 hidden sm:block">
                {step.cta.label} →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {status.allDone && !status.claimed ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[rgba(255,200,80,0.4)] bg-[rgba(255,200,80,0.06)] p-3">
          <div className="flex items-center gap-2 min-w-0">
            <Gift className="h-5 w-5 shrink-0" style={{ color: "var(--uf-gold)" }} aria-hidden />
            <p className="text-sm">
              Every objective complete. Claim{" "}
              <span className="font-semibold">
                +{status.reward.xp} XP and +{status.reward.credits}★
              </span>
              .
            </p>
          </div>
          <NeonButton
            variant="primary"
            onClick={handleClaim}
            loading={claiming}
            disabled={claiming}
          >
            Claim bonus
          </NeonButton>
        </div>
      ) : null}

      {status.claimed ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-uf-muted">
          <Check className="h-4 w-4 text-[#4ade80]" aria-hidden />
          First Watch complete — bonus paid. The galaxy is yours to shape.
        </div>
      ) : null}
    </HoloCard>
  );
}

// ---------------------------------------------------------------------------
// Streak chip — small status line for the Account page. The daily check-in
// mutation is fired by FirstWatchPanel above; this widget only displays.
// ---------------------------------------------------------------------------

export function StreakChip() {
  const { isAuthenticated } = useAuth();
  const user = useQuery(api.users.currentUser, isAuthenticated ? {} : "skip");

  if (!isAuthenticated || !user) return null;
  const streak = user.streakCount ?? 0;
  if (streak <= 0) return null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,140,60,0.45)] bg-[rgba(255,140,60,0.08)] px-3 py-1.5 text-sm"
      role="status"
      aria-label={`Daily streak: ${streak} days`}
    >
      <Flame className="h-4 w-4" style={{ color: "#ff8c3c" }} aria-hidden />
      <span className="font-semibold">{streak}-day streak</span>
      {user.streakBest && user.streakBest > streak ? (
        <span className="text-uf-muted text-xs">best {user.streakBest}</span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referral card — shows the member's recruitment code, a copy button, and
// their recruit count. Rendered on the Account page.
// ---------------------------------------------------------------------------

export function ReferralCard() {
  const { isAuthenticated } = useAuth();
  const ref = useQuery(api.engagement.myReferral, isAuthenticated ? {} : "skip");
  const ensureCode = useMutation(api.engagement.ensureReferralCode);
  const [copied, setCopied] = useState(false);

  // Lazily mint the member's code the first time the card renders.
  useEffect(() => {
    if (isAuthenticated && ref && !ref.code) {
      void ensureCode({}).catch(() => {
        /* retried on next render */
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, ref?.code]);

  if (!isAuthenticated || ref === undefined || ref === null) return null;

  async function copy() {
    if (!ref?.code) return;
    try {
      await navigator.clipboard.writeText(ref.code);
      setCopied(true);
      toast.success("Recruitment code copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select the code and copy it manually.");
    }
  }

  return (
    <HoloCard aria-label="Recruitment code">
      <span className="uf-eyebrow">Recruitment</span>
      <div className="flex flex-wrap items-center gap-3 mt-2">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5" style={{ color: "var(--uf-cyan)" }} aria-hidden />
          <code
            className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-3 py-1.5 text-lg font-mono tracking-[0.14em] select-all"
            aria-label="Your referral code"
          >
            {ref.code ?? "generating…"}
          </code>
        </div>
        <NeonButton variant="ghost" onClick={copy} disabled={!ref.code}>
          {copied ? "Copied" : "Copy code"}
        </NeonButton>
      </div>
      <p className="text-uf-muted text-sm mt-2">
        Share your code — new cadets who arrive with it get{" "}
        <span className="text-uf-text">+{25}★</span> instantly, and you earn{" "}
        <span className="text-uf-text">+{ref.rewardCredits}★</span> when they
        complete their first day.
      </p>
      {ref.count > 0 ? (
        <p className="text-sm mt-1.5 flex items-center gap-1.5">
          <Coins className="h-4 w-4" aria-hidden />
          {ref.count} recruit{ref.count === 1 ? "" : "s"} activated under your
          command.
        </p>
      ) : null}
    </HoloCard>
  );
}
