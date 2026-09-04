import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import {
  SiteShell,
  PageHero,
  HoloCard,
  StatusPill,
  NeonButton,
} from "@/components/uf";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { useCountdown, countdownLabel } from "@/hooks/use-countdown";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Coins, ScrollText, Trophy, Zap } from "lucide-react";
import type { ReactNode } from "react";

type ContestRow = {
  _id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  startsAt: number;
  endsAt: number;
  judgingEndsAt: number | null;
  rewardXp: number | null;
  rewardCredits: number | null;
  winnerCount: number;
  canEnter: boolean;
  entryCount: number;
};

const STATUS_PILL: Record<string, "warning" | "success" | "gold" | "default" | "info"> = {
  upcoming: "warning",
  open: "success",
  voting: "gold",
  closed: "default",
  announced: "info",
};

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Open for entries soon",
  open: "Submissions open",
  voting: "Judging in progress",
  closed: "Submissions closed",
  announced: "Winners announced",
};

export default function Contests() {
  const contests = useQuery(api.contests.listContests, {});
  usePageMeta({
    title: "Lore Contests — Star Force Base 1198",
    description:
      "Member-created lore contests. Write the next canon entry, win XP and Star Credits, and shape the galaxy.",
    noindex: false,
  });

  const sorted = [...(contests ?? [])].sort((a, b) => {
    const rank = { open: 0, upcoming: 1, voting: 2, announced: 3, closed: 4 } as const;
    const ra = rank[a.status as keyof typeof rank] ?? 5;
    const rb = rank[b.status as keyof typeof rank] ?? 5;
    if (ra !== rb) return ra - rb;
    return a.endsAt - b.endsAt;
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Lore Contests"
        title="The canon is written by the fleet."
        lead="Operators launch themed contests; any pilot can enter one submission. The best entries get canon-adjacent placement, XP, and Star Credits — and your name in the archive."
        primary={{ label: "Browse open contests", href: "#contests", variant: "primary" }}
        secondary={{ label: "Submit a story", href: "/submit", variant: "ghost" }}
      />
      <section id="contests" className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="uf-eyebrow">Mission board</span>
            <h2 className="text-3xl font-semibold mt-2">
              {contests === undefined
                ? "Loading contest feed…"
                : `${sorted.length} contest${sorted.length === 1 ? "" : "s"} on the board`}
            </h2>
          </div>
          <p className="text-uf-muted text-sm max-w-md">
            One entry per pilot per contest — but you can refine yours until
            the deadline hits.
          </p>
        </header>

        {contests === undefined ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 260 }} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="uf-empty">
            No contests on the board yet. Operators launch themed contests
            from the console — check back when the next transmission drops.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((contest, idx) => (
              <ScaleReveal key={contest._id} staggerIndex={idx}>
                <HoloCard className="h-full flex flex-col">
                  <ContestStatus c={contest} />
                  <h3 className="text-xl font-semibold mt-3">{contest.title}</h3>
                  <p className="text-uf-muted text-sm mt-2 line-clamp-3">
                    {contest.description}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <ContestStat
                      icon={<ScrollText className="h-3.5 w-3.5" />}
                      label="Entries"
                      value={contest.entryCount.toLocaleString()}
                      tone="var(--uf-cyan)"
                    />
                    <ContestStat
                      icon={<Trophy className="h-3.5 w-3.5" />}
                      label="Winners"
                      value={String(contest.winnerCount)}
                      tone="var(--uf-gold)"
                    />
                    <ContestStat
                      icon={<Coins className="h-3.5 w-3.5" />}
                      label="Reward"
                      value={
                        contest.rewardXp || contest.rewardCredits
                          ? `${contest.rewardXp ?? 0}XP${contest.rewardCredits ? `+${contest.rewardCredits}¤` : ""}`
                          : "Honor"
                      }
                      tone="var(--uf-violet)"
                    />
                  </dl>
                  <div className="mt-auto pt-4">
                    <ContestDeadline c={contest} />
                    <Link to={`/contests/${contest.slug}`} className="block mt-3">
                      <NeonButton
                        variant={contest.canEnter ? "primary" : "ghost"}
                        className="w-full"
                      >
                        {contest.canEnter
                          ? "Read the brief + enter"
                          : contest.status === "upcoming"
                            ? "Preview the brief"
                            : "View entries & results"}
                      </NeonButton>
                    </Link>
                  </div>
                </HoloCard>
              </ScaleReveal>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}

function ContestStatus({ c }: { c: ContestRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill variant={STATUS_PILL[c.status]}>{STATUS_LABEL[c.status]}</StatusPill>
      {c.rewardXp || c.rewardCredits ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-uf-muted">
          {c.rewardXp ? (
            <Zap className="h-3 w-3 text-uf-gold" aria-hidden />
          ) : (
            <Coins className="h-3 w-3 text-uf-cyan" aria-hidden />
          )}
          Prize pool
        </span>
      ) : null}
    </div>
  );
}

function ContestDeadline({ c }: { c: ContestRow }) {
  const target =
    c.status === "open"
      ? c.endsAt
      : c.status === "upcoming"
        ? c.startsAt
        : null;
  const cd = useCountdown(target);

  const text =
    c.status === "open" && !cd.expired
      ? `Submissions close in ${countdownLabel(cd)}`
      : c.status === "open"
        ? "Submission window just closed"
        : c.status === "upcoming" && !cd.expired
          ? `Opens in ${countdownLabel(cd)}`
          : c.status === "upcoming"
            ? "Launch window passed — status updating"
            : `${new Date(c.endsAt).toLocaleDateString()} · ${new Date(c.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} deadline`;

  return (
    <p className="text-uf-muted text-xs flex items-center gap-1.5" aria-live="polite">
      <Zap className="h-3 w-3 text-uf-cyan" aria-hidden />
      {text}
    </p>
  );
}

function ContestStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] px-2 py-2">
      <dt className="sr-only">{label}</dt>
      <dd className="m-0">
        <span
          className="inline-flex items-center justify-center gap-1 font-mono text-sm font-semibold tabular-nums"
          style={{ color: tone }}
        >
          {icon}
          {value}
        </span>
        <span className="block text-[9px] uppercase tracking-[0.14em] text-uf-muted mt-0.5">
          {label}
        </span>
      </dd>
    </div>
  );
}
