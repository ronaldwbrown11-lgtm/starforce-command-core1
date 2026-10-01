import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Check, ClipboardList, Crown, Lock, Users, Zap } from "lucide-react";

// =========================================================================
// High Command Dashboard (Deliverable B)
//
// The member-facing home of the Capped Star Force progression system:
//   1. Current rank badge + XP progress bar toward the next rank
//   2. Ensign induction checklist widget
//   3. The High Command Council Table — 10 active Rear Admiral seats and
//      the top 5 Captains on the promotion waitlist
//   4. Full progression ladder + XP earning rates (Deliverable C tables)
//   5. FAQ
// =========================================================================

function ProgressBar({ percent, tone = "var(--uf-cyan)" }: { percent: number; tone?: string }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="h-2.5 w-full rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.8)] overflow-hidden"
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${p}%`,
          background: `linear-gradient(90deg, ${tone}, rgba(139,92,246,0.9))`,
          boxShadow: `0 0 10px ${tone}`,
        }}
      />
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/** Operator-managed rank insignia (uploaded in the Rank Ladder console). */
function RankInsignia({
  storageId,
  className = "h-6 w-6 rounded-sm",
}: {
  storageId: string | null;
  className?: string;
}) {
  const url = useQuery(
    api.assets.coverUrl,
    storageId ? { storageId: storageId as Id<"_storage"> } : "skip",
  );
  if (!storageId || !url) return null;
  return <img src={url} alt="" aria-hidden className={`${className} object-cover`} />;
}

export default function HighCommand() {
  const { isAuthenticated } = useAuth();
  const progress = useQuery(api.progression.myProgress);
  const council = useQuery(api.progression.council);
  const catalog = useQuery(api.progression.ranksCatalog);
  // Insignia for the personal rank badge (operator-managed).
  const rankBadgeUrl = useQuery(
    api.assets.coverUrl,
    progress?.rank.imageStorageId
      ? { storageId: progress.rank.imageStorageId }
      : "skip",
  );
  const completeStep = useMutation(api.progression.onboardingComplete);

  usePageMeta({
    title: "High Command — Star Force Base 1198",
    description:
      "The Capped Star Force progression system: your rank and XP progress, the Ensign induction checklist, the 10 Rear Admiral seats, and the promotion waitlist.",
  });

  // All checklist steps derived complete but still showing Ensign? Claim the
  // promotion immediately instead of waiting for the next lazy evaluation.
  const checklistReady =
    isAuthenticated &&
    progress !== undefined &&
    progress !== null &&
    progress.rankKey === "ensign" &&
    progress.checklist.allDone;
  useEffect(() => {
    if (!checklistReady || !progress) return;
    void completeStep({ taskKey: "profile" })
      .then((res) => {
        if (res.promoted) toast.success("Promoted to Lieutenant — welcome to the bridge.");
      })
      .catch(() => {
        /* lazy evaluation (touchStreak / daily cron) will catch up */
      });
  }, [checklistReady, progress, completeStep]);

  const markStep = async (taskKey: string) => {
    try {
      const res = await completeStep({ taskKey });
      if (res.promoted) {
        toast.success("Checklist at 100% — you are now a Lieutenant.");
      } else if (res.allDone) {
        toast.success("Step verified.");
      } else {
        toast.success(
          `Step verified — ${res.completedCount} of ${res.total} induction steps done.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't verify that step.");
    }
  };

  const seatRows = council?.seats ?? [];
  const openSeats = council?.openSeats ?? 0;

  return (
    <SiteShell>
      <PageHero
        eyebrow="Capped Progression"
        title="The High Command"
        lead="Where the fleet's ladder is measured: your commission and XP, the Ensign induction checklist, the ten Rear Admiral seats, and the officers waiting in line."
      />

      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* ---------------------------------------------------------------
            1 · Rank badge & XP progress
        --------------------------------------------------------------- */}
        {progress === undefined ? (
          <div className="uf-skeleton" style={{ height: 220 }} />
        ) : progress === null ? (
          <HoloCard className="!p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="uf-eyebrow">Your commission</span>
                <h2 className="text-xl font-semibold mt-1">Sign in to track your rank</h2>
                <p className="text-uf-muted text-sm mt-1 max-w-[52ch]">
                  Your rank badge, XP progress, and induction checklist live behind your
                  personnel file. New pilots enter as Tier 7 Ensign and earn their promotion
                  to Lieutenant by finishing the induction checklist.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/auth?returnTo=/high-command" className="uf-btn uf-btn--primary">
                  Sign in
                </Link>
              </div>
            </div>
          </HoloCard>
        ) : (
          <HoloCard className="!p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Rank badge */}
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2"
                  style={{
                    borderColor:
                      progress.rank.flagOfficer ? "var(--uf-gold)" : "var(--uf-cyan)",
                    color: progress.rank.flagOfficer ? "var(--uf-gold)" : "var(--uf-cyan)",
                    boxShadow: progress.rank.flagOfficer
                      ? "0 0 18px rgba(230,168,23,0.45)"
                      : "0 0 18px rgba(0,229,255,0.35)",
                    background: "rgba(6,10,18,0.85)",
                  }}
                  aria-hidden
                >
                  {rankBadgeUrl ? (
                    <img
                      src={rankBadgeUrl}
                      alt=""
                      aria-hidden
                      className="h-full w-full rounded-[0.6rem] object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold tracking-[0.14em]">
                      {progress.rank.short}
                    </span>
                  )}
                </div>
                <div>
                  <span className="uf-eyebrow">Tier {progress.rank.tier}</span>
                  <h2 className="text-2xl font-semibold leading-tight">
                    {progress.rank.label}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusPill variant="cyan">{fmt(progress.xp)} XP</StatusPill>
                    {progress.prestigeXp > 0 ? (
                      <StatusPill variant="gold">
                        {fmt(progress.prestigeXp)} Prestige XP
                      </StatusPill>
                    ) : null}
                    {progress.queue.status === "active" ? (
                      <StatusPill variant="gold">Rear Admiral · Seat holder</StatusPill>
                    ) : progress.queue.status === "waiting" ? (
                      <StatusPill variant="violet">
                        Rear Admiral Eligible · #{progress.queue.position}
                      </StatusPill>
                    ) : progress.queue.status === "inactive_flag_officer" ? (
                      <StatusPill variant="warning">Inactive Flag Officer</StatusPill>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="text-right min-w-[220px] flex-1 max-w-[420px]">
                {progress.next ? (
                  <>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-uf-muted">
                        Toward{" "}
                        <span className="text-uf-text font-medium">
                          {progress.next.label}
                        </span>{" "}
                        <span className="text-uf-muted">(Tier {progress.next.tier})</span>
                      </span>
                      <span className="font-mono tabular-nums text-uf-cyan">
                        {progress.next.progressBy === "checklist"
                          ? `${progress.checklist.percent}%`
                          : `${progress.next.percent}%`}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar percent={progress.next.percent} />
                    </div>
                    <p className="text-uf-muted text-xs mt-2">
                      {progress.next.progressBy === "checklist"
                        ? "Finish the induction checklist below to earn Lieutenant."
                        : `${fmt(progress.next.needed)} XP to ${progress.next.label}.`}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-uf-muted">Flag officer — ladder complete</span>
                      <span className="font-mono tabular-nums text-[color:var(--uf-gold)]">
                        100%
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar percent={100} tone="var(--uf-gold)" />
                    </div>
                    <p className="text-uf-muted text-xs mt-2">
                      Hold the line — seats are reviewed daily for inactivity.
                    </p>
                  </>
                )}

                {/* Daily engagement cap meter */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-3 text-xs text-uf-muted">
                    <span>Engagement XP today</span>
                    <span className="font-mono tabular-nums">
                      {progress.daily.used}/{progress.daily.cap} (daily cap)
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar
                      percent={(progress.daily.used / progress.daily.cap) * 100}
                      tone="var(--uf-violet, #8B5CF6)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </HoloCard>
        )}

        {/* ---------------------------------------------------------------
            2 · Ensign induction checklist
        --------------------------------------------------------------- */}
        {progress && progress.rankKey === "ensign" ? (
          <HoloCard className="!p-6 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="h-5 w-5 text-uf-cyan" aria-hidden />
                <div>
                  <span className="uf-eyebrow">Ensign induction</span>
                  <h3 className="text-lg font-semibold leading-tight">
                    Checklist — {progress.checklist.completedCount} of{" "}
                    {progress.checklist.total} complete
                  </h3>
                </div>
              </div>
              <StatusPill variant={progress.checklist.allDone ? "success" : "info"}>
                {progress.checklist.percent}% · promotes at 100%
              </StatusPill>
            </div>

            <div className="mt-3">
              <ProgressBar percent={progress.checklist.percent} tone="#50FFA0" />
            </div>

            <ul className="mt-4 grid gap-2 list-none p-0 m-0">
              {progress.checklist.steps.map((step, i) => (
                <li
                  key={step.key}
                  className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                    step.done
                      ? "border-[rgba(80,255,160,0.35)] bg-[rgba(80,255,160,0.06)]"
                      : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)]"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                      step.done
                        ? "border-[rgba(80,255,160,0.6)] text-[#50FFA0]"
                        : "border-[color:var(--uf-border)] text-uf-muted"
                    }`}
                    aria-hidden
                  >
                    {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={`text-sm ${step.done ? "text-uf-text" : "text-uf-muted"}`}
                  >
                    {step.label}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <Link
                      to={step.href}
                      className="text-xs text-uf-cyan underline underline-offset-2"
                    >
                      {step.cta}
                    </Link>
                    {!step.done ? (
                      <button
                        type="button"
                        onClick={() => void markStep(step.key)}
                        className="rounded-md border border-[rgba(0,229,255,0.5)] px-2.5 py-1 text-xs text-uf-cyan hover:bg-[rgba(0,229,255,0.12)] transition-colors cursor-pointer"
                      >
                        Mark complete
                      </button>
                    ) : (
                      <StatusPill variant="success">Done</StatusPill>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-uf-muted text-xs mt-3">
              Each step is verified server-side against your real activity — completing all
              six auto-promotes you from Ensign to Lieutenant, where XP tracking begins.
            </p>
          </HoloCard>
        ) : null}

        {/* ---------------------------------------------------------------
            3 · High Command Council Table
        --------------------------------------------------------------- */}
        <div className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <span className="uf-eyebrow">The Council</span>
              <h2 className="text-2xl font-semibold mt-1">High Command Council</h2>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill variant="gold">
                <Crown className="h-3.5 w-3.5 inline mr-1 -mt-0.5" aria-hidden />
                {council === undefined ? "…" : `${seatRows.length}`}/
                {council?.seatCap ?? 10} seats active
              </StatusPill>
              <StatusPill variant="violet">
                {council === undefined ? "…" : council.waitlist.length} of{" "}
                {council?.waitlistTotal ?? 0} waiting
              </StatusPill>
            </div>
          </div>

          {council === undefined ? (
            <div className="uf-skeleton" style={{ height: 320 }} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Active seats */}
              <div className="lg:col-span-3 uf-panel p-4 md:p-5">
                <span className="uf-eyebrow mb-3 block">
                  Active Rear Admirals — hard cap {council.seatCap}
                </span>
                {seatRows.length === 0 ? (
                  <div className="uf-empty">
                    No active Rear Admirals yet. The first seat opens the moment a Captain
                    crosses {fmt(council.flagOfficerMinXp)} XP.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-uf-muted text-xs border-b border-[color:var(--uf-border)]">
                        <th className="py-2 pr-2 font-medium w-10">#</th>
                        <th className="py-2 pr-2 font-medium">Officer</th>
                        <th className="py-2 pr-2 font-medium">Fleet</th>
                        <th className="py-2 pr-2 font-medium text-right">XP</th>
                        <th className="py-2 font-medium text-right">Last XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seatRows.map((s, i) => (
                        <tr
                          key={s.userId}
                          className="border-b border-[color:var(--uf-border)] last:border-0"
                        >
                          <td className="py-2.5 pr-2 font-mono tabular-nums text-[color:var(--uf-gold)]">
                            {i + 1}
                          </td>
                          <td className="py-2.5 pr-2">
                            <Link
                              to={`/u/${s.userId}`}
                              className="text-uf-text hover:text-uf-cyan transition-colors"
                            >
                              {s.name}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-2 text-uf-muted">{s.fleet ?? "—"}</td>
                          <td className="py-2.5 pr-2 font-mono tabular-nums text-right">
                            {fmt(s.xp)}
                          </td>
                          <td className="py-2.5 text-right text-uf-muted text-xs">
                            {s.lastXpAt ? new Date(s.lastXpAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                      {Array.from({ length: openSeats }).map((_, i) => (
                        <tr key={`open-${i}`} className="border-b border-[color:var(--uf-border)] last:border-0">
                          <td className="py-2.5 pr-2 font-mono tabular-nums text-uf-muted">
                            {seatRows.length + i + 1}
                          </td>
                          <td
                            colSpan={4}
                            className="py-2.5 text-uf-muted italic text-xs"
                          >
                            ⬡ Open seat — awaiting the next qualified Captain
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {council.inactiveFlagOfficers > 0 ? (
                  <p className="text-uf-muted text-xs mt-3">
                    {council.inactiveFlagOfficers} officer
                    {council.inactiveFlagOfficers === 1 ? "" : "s"} currently hold Inactive
                    Flag Officer status (45 days without XP) — their seats are being
                    reassigned.
                  </p>
                ) : null}
              </div>

              {/* Waitlist */}
              <div className="lg:col-span-2 uf-panel p-4 md:p-5">
                <span className="uf-eyebrow mb-3 block">Promotion waitlist — top 5</span>
                {council.waitlist.length === 0 ? (
                  <div className="uf-empty text-sm">
                    No Captains have reached {fmt(council.flagOfficerMinXp)} XP yet. The
                    waitlist fills as Captains bank Prestige XP.
                  </div>
                ) : (
                  <ol className="list-none p-0 m-0 flex flex-col gap-2">
                    {council.waitlist.map((w, i) => (
                      <li
                        key={w.userId}
                        className="flex items-center gap-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2.5"
                      >
                        <span className="font-mono tabular-nums text-uf-muted w-5 shrink-0">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <Link
                            to={`/u/${w.userId}`}
                            className="block text-sm text-uf-text hover:text-uf-cyan transition-colors truncate"
                          >
                            {w.name}
                          </Link>
                          <span className="block text-[11px] text-uf-muted">
                            {w.fleet ?? "Independent"} · joined{" "}
                            {new Date(w.joinedAt).toLocaleDateString()}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block font-mono tabular-nums text-sm text-uf-cyan">
                            {fmt(w.totalXp)}
                          </span>
                          <StatusPill variant="violet" className="!text-[10px] !py-0.5">
                            Eligible
                          </StatusPill>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-uf-muted text-[11px] mt-3">
                  Ranked by total XP. When a seat opens — through inactivity decay or a new
                  slot — the daily evaluation promotes the officer at the top of this list.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------
            4 · Progression ladder + XP rates
        --------------------------------------------------------------- */}
        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 uf-panel p-4 md:p-5">
            <span className="uf-eyebrow mb-3 block">Full progression ladder</span>
            {catalog === undefined ? (
              <div className="uf-skeleton" style={{ height: 260 }} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-uf-muted text-xs border-b border-[color:var(--uf-border)]">
                      <th className="py-2 pr-2 font-medium">Tier</th>
                      <th className="py-2 pr-2 font-medium">Rank</th>
                      <th className="py-2 pr-2 font-medium text-right">Total XP</th>
                      <th className="py-2 pr-2 font-medium text-right">Holders</th>
                      <th className="py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.ranks.map((r) => (
                      <tr
                        key={r.key}
                        className="border-b border-[color:var(--uf-border)] last:border-0"
                      >
                        <td className="py-2.5 pr-2 font-mono tabular-nums text-uf-muted">
                          {r.tier}
                        </td>
                        <td className="py-2.5 pr-2">
                          <span className="flex items-center gap-2">
                            <RankInsignia storageId={r.imageStorageId} />
                            <span
                              className={
                                r.flagOfficer
                                  ? "text-[color:var(--uf-gold)] font-medium"
                                  : r.canonical
                                    ? "text-uf-text font-medium"
                                    : "text-uf-violet font-medium"
                              }
                            >
                              {r.label}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 font-mono tabular-nums text-right">
                          {fmt(r.minXp)}
                        </td>
                        <td className="py-2.5 pr-2 font-mono tabular-nums text-right text-uf-muted">
                          {r.holderCount}
                        </td>
                        <td className="py-2.5 text-xs text-uf-muted max-w-[260px]">
                          {r.key === "ensign"
                            ? "Entry rank — 100% induction checklist promotes you"
                            : r.flagOfficer
                              ? `Flag officer — hard cap of ${catalog.seatCap} active seats`
                              : r.key === "captain"
                                ? "Excess above 35,000 held as Prestige XP"
                                : r.canonical
                                  ? "Automatic on XP"
                                  : "Assigned by command"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 uf-panel p-4 md:p-5">
            <span className="uf-eyebrow mb-3 block">XP earning rates</span>
            <ul className="list-none p-0 m-0 flex flex-col gap-2.5 text-sm">
              {catalog ? (
                <>
                  {(
                    [
                      ["daily", `${catalog.rates.daily.min}–${catalog.rates.daily.max}`],
                      ["weekly", `${catalog.rates.weekly.min}–${catalog.rates.weekly.max}`],
                      ["lore", `${catalog.rates.lore.min}–${catalog.rates.lore.max}`],
                      ["story", `${catalog.rates.story.min}–${catalog.rates.story.max}`],
                      ["milestone", `${catalog.rates.milestone.max}`],
                    ] as const
                  ).map(([key, band]) => (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 border-b border-[color:var(--uf-border)] pb-2 last:border-0"
                    >
                      <span className="text-uf-muted">{catalog.rates[key].label}</span>
                      <span className="font-mono tabular-nums text-uf-cyan shrink-0">
                        {band} XP
                      </span>
                    </li>
                  ))}
                </>
              ) : null}
            </ul>
            <div className="mt-3 flex items-start gap-2 rounded-md border border-[rgba(0,229,255,0.3)] bg-[rgba(0,229,255,0.06)] px-3 py-2.5">
              <Zap className="h-4 w-4 text-uf-cyan shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-uf-muted">
                Engagement XP is hard-capped at {catalog?.dailyCap ?? 50} XP per UTC day.
                Approved lore and published stories are review-gated; paid tiers multiply
                every award.
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------
            5 · FAQ
        --------------------------------------------------------------- */}
        <div className="mt-10 uf-panel p-4 md:p-6">
          <span className="uf-eyebrow mb-4 block">Field guide — common queries</span>
          <div className="flex flex-col gap-2">
            {[
              {
                q: "How do I rank up from Ensign?",
                a: "Complete the induction checklist at 100% — profile, starship, fleet group, a reaction, a field report, and your first badge. The moment the sixth step verifies, you're auto-promoted to Lieutenant, where numerical XP tracking begins (1,500 total XP is the next threshold).",
              },
              {
                q: "What happens when I hit 35,000 XP at Captain rank?",
                a: "You join the Rear Admiral Queue with Rear Admiral Eligible status. All excess XP above 35,000 is held as Prestige XP while you wait — nothing is ever lost, and your waitlist position is ranked by total XP.",
              },
              {
                q: "How are the 10 Rear Admiral seats awarded?",
                a: "There is a hard cap of 10 active seats. A daily queue evaluation checks for open seats and promotes the highest-total-XP eligible Captain (35,000+ XP) from the waitlist. While all 10 seats are full, qualified Captains remain at Captain (Fleet) with Rear Admiral Eligible status.",
              },
              {
                q: "What happens if a Rear Admiral becomes inactive?",
                a: "45 consecutive days with zero platform XP triggers inactivity decay: the seat is revoked, you're shifted to Inactive Flag Officer status, and the top-ranked eligible Captain is promoted into the open seat. Earning XP again returns you to the waitlist.",
              },
              {
                q: "Do I lose my XP while waiting for an Admiral seat?",
                a: "Never — XP only moves forward. Everything above 35,000 is banked as Prestige XP, your total still counts for waitlist ranking, and no promotion or seat change reduces your XP.",
              },
            ].map((f) => (
              <details
                key={f.q}
                className="group rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-uf-text list-none flex items-center justify-between gap-3">
                  {f.q}
                  <span className="text-uf-cyan text-xs transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-uf-muted text-sm mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Cross-links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/missions" className="uf-btn uf-btn--primary">
            <Zap className="h-4 w-4 mr-1.5" aria-hidden />
            Run an operation
          </Link>
          <Link to="/manual" className="uf-btn uf-btn--ghost">
            <Lock className="h-4 w-4 mr-1.5" aria-hidden />
            Cadet Manual
          </Link>
          <Link to="/leaderboard" className="uf-btn uf-btn--ghost">
            <Users className="h-4 w-4 mr-1.5" aria-hidden />
            Leaderboard
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
