import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useParams } from "react-router";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { useCountdown, countdownLabel } from "@/hooks/use-countdown";
import { usePageMeta } from "@/hooks/use-page-meta";
import { toast } from "sonner";
import { CalendarDays, Coins, Crown, PenLine, ScrollText, Trophy, Zap } from "lucide-react";

const MAX_TITLE = 120;
const MAX_BODY = 6000;

function entryStatusPill(status: string) {
  if (status === "winner") return { variant: "gold" as const, label: "Winner" };
  if (status === "finalist") return { variant: "violet" as const, label: "Finalist" };
  return { variant: "default" as const, label: "Submitted" };
}

export default function ContestDetail() {
  const { slug = "" } = useParams();
  const data = useQuery(api.contests.contestBySlug, { slug });
  const { isAuthenticated } = useAuth();

  const contestId: Id<"contests"> | undefined = data?.contest._id;

  const myEntry = useQuery(
    api.contests.myContestEntry,
    contestId ? { contestId } : "skip",
  );
  const submit = useMutation(api.contests.submitContestEntry);
  const removeEntry = useMutation(api.contests.deleteMyContestEntry);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  usePageMeta({
    title: data?.contest ? `${data.contest.title} — Lore Contest` : "Lore Contest",
    description: data?.contest?.description?.slice(0, 160) ?? "",
    noindex: false,
  });

  const cd = useCountdown(
    data?.contest?.status === "open"
      ? data.contest.endsAt
      : data?.contest?.status === "upcoming"
        ? data.contest.startsAt
        : null,
  );

  const deadlineCopy = useMemo(() => {
    const c = data?.contest;
    if (!c) return "";
    if (c.status === "open") {
      return cd.expired
        ? "The submission window has just closed."
        : `Submissions close in ${countdownLabel(cd)} — ${new Date(c.endsAt).toLocaleString()}.`;
    }
    if (c.status === "upcoming") {
      return cd.expired
        ? "The launch window has passed — this contest is opening."
        : `Entries open in ${countdownLabel(cd)} — ${new Date(c.startsAt).toLocaleString()}.`;
    }
    if (c.status === "voting") {
      return `Judging is underway${c.judgingEndsAt ? ` — results expected by ${new Date(c.judgingEndsAt).toLocaleDateString()}` : ""}.`;
    }
    if (c.status === "announced") {
      return "Winners have been announced — congratulations to the fleet's new chroniclers.";
    }
    return `Submissions closed ${new Date(c.endsAt).toLocaleString()}.`;
  }, [data, cd]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    try {
      await submit({
        contestId: data.contest._id,
        title: title.trim(),
        body: body.trim(),
      });
      toast.success(myEntry ? "Entry updated — the brief stays open until deadline." : "Entry transmitted. The jury can see it now.");
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit your entry.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!myEntry) return;
    if (!window.confirm("Withdraw your entry from this contest? This cannot be undone.")) return;
    setBusy(true);
    try {
      await removeEntry({ id: myEntry._id });
      toast.success("Entry withdrawn.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't withdraw your entry.");
    } finally {
      setBusy(false);
    }
  };

  const contest = data?.contest ?? null;
  const entries = data?.entries ?? [];

  return (
    <SiteShell>
      {contest === undefined ? (
        <div className="uf-section max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="uf-skeleton" style={{ height: 220 }} />
        </div>
      ) : contest === null ? (
        <div className="uf-section max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="uf-empty">
            Contest not found. <Link to="/contests" className="text-uf-cyan underline">Back to the board</Link>.
          </div>
        </div>
      ) : (
        <>
          <PageHero
            eyebrow="Lore Contest"
            title={contest.title}
            lead={contest.description}
            primary={{
              label: contest.canEnter ? "Enter the contest" : "Back to the board",
              href: contest.canEnter ? "#entry" : "/contests",
              variant: "primary",
            }}
            secondary={{ label: "All contests", href: "/contests", variant: "ghost" }}
          />
          <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
            <HoloCard className="mb-6 !border-[rgba(0,229,255,0.28)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill variant={contest.canEnter ? "success" : contest.status === "upcoming" ? "warning" : contest.status === "announced" ? "info" : "default"}>
                    {contest.canEnter
                      ? "Submissions open"
                      : contest.status === "upcoming"
                        ? "Opens soon"
                        : contest.status === "voting"
                          ? "Judging in progress"
                          : contest.status === "announced"
                            ? "Winners announced"
                            : "Submissions closed"}
                  </StatusPill>
                  <StatusPill variant="cyan">Hosted by {data?.creatorName ?? "Fleet Command"}</StatusPill>
                </div>
                <p className="text-uf-muted text-sm flex items-center gap-2" aria-live="polite">
                  <CalendarDays className="h-4 w-4 text-uf-cyan" aria-hidden />
                  {deadlineCopy}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <RewardStat icon={<ScrollText className="h-4 w-4" />} label="Entries filed" value={String(data?.entryCount ?? 0)} tone="var(--uf-cyan)" />
                <RewardStat icon={<Crown className="h-4 w-4" />} label="Winner count" value={String(contest.winnerCount)} tone="var(--uf-gold)" />
                <RewardStat
                  icon={contest.rewardCredits ? <Coins className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                  label="Prize pool"
                  value={contest.rewardXp || contest.rewardCredits ? `${contest.rewardXp ?? 0} XP${contest.rewardCredits ? ` + ${contest.rewardCredits} ¤` : ""}` : "Honor & canon placement"}
                  tone="var(--uf-violet)"
                />
              </div>
            </HoloCard>

            <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
              {/* Left: brief + entries */}
              <div className="flex flex-col gap-6 min-w-0">
                {contest.prompt && (
                  <HoloCard accent="violet">
                    <span className="uf-eyebrow">The brief</span>
                    <h2 className="text-xl font-semibold mt-2">Your mission directive</h2>
                    <p className="text-uf-text text-sm leading-relaxed mt-3 whitespace-pre-wrap">{contest.prompt}</p>
                  </HoloCard>
                )}
                {contest.rules && (
                  <HoloCard>
                    <span className="uf-eyebrow">Rules of engagement</span>
                    <p className="text-uf-muted text-sm leading-relaxed mt-3 whitespace-pre-wrap">{contest.rules}</p>
                  </HoloCard>
                )}

                <section aria-labelledby="entries-title">
                  <header className="mb-4">
                    <span className="uf-eyebrow">Transmissions received</span>
                    <h2 id="entries-title" className="text-2xl font-semibold mt-1.5">
                      {data?.entryCount ?? 0} entr{(data?.entryCount ?? 0) === 1 ? "y" : "ies"}
                    </h2>
                  </header>
                  {entries.length === 0 ? (
                    <div className="uf-empty">
                      No entries yet. The first pilot to file sets the tone for this contest.
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-3 list-none p-0 m-0">
                      {entries.map((entry) => {
                        const ps = entryStatusPill(entry.status);
                        return (
                          <li key={entry._id}>
                            <HoloCard className="!p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-base font-semibold">{entry.title}</h3>
                                {entry.status !== "submitted" && (
                                  <StatusPill variant={ps.variant}>{ps.label}</StatusPill>
                                )}
                              </div>
                              <p className="text-xs text-uf-muted mt-1.5">
                                {entry.author?.displayName ?? "Unknown pilot"}
                                {entry.author?.rank ? ` · ${entry.author.rank}` : ""}
                                {entry.author?.xp !== undefined ? ` · ${entry.author.xp.toLocaleString()} XP` : ""}
                                {" · "}
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-uf-muted leading-relaxed mt-3 whitespace-pre-wrap line-clamp-6">
                                {entry.body}
                              </p>
                            </HoloCard>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>

              {/* Right: entry station */}
              <aside id="entry" className="lg:sticky lg:top-24 flex flex-col gap-4">
                {isAuthenticated ? (
                  <HoloCard accent={contest.canEnter ? "cyan" : undefined}>
                    <span className="uf-eyebrow">Entry station</span>
                    <h2 className="text-lg font-semibold mt-2">
                      {myEntry ? "Refine your entry" : contest.canEnter ? "File your entry" : "Entry window closed"}
                    </h2>
                    {myEntry && (
                      <div className="mt-2">
                        <StatusPill variant={entryStatusPill(myEntry.status).variant}>
                          Your entry: {entryStatusPill(myEntry.status).label}
                        </StatusPill>
                      </div>
                    )}
                    {contest.canEnter ? (
                      <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
                        <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
                          Title
                          <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={MAX_TITLE}
                            placeholder={myEntry?.title ?? "A working title for your lore piece"}
                            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text placeholder:text-uf-muted/60"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
                          Your lore piece
                          <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={9}
                            maxLength={MAX_BODY}
                            placeholder={myEntry?.body ?? "Write the entry itself — faction, sector, and canon voice are up to you."}
                            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text placeholder:text-uf-muted/60 resize-y"
                          />
                        </label>
                        <p className="text-right text-[11px] text-uf-muted tabular-nums">
                          {body.length.toLocaleString()} / {MAX_BODY.toLocaleString()}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <NeonButton
                            type="submit"
                            variant="primary"
                            loading={busy}
                            disabled={!title.trim() || !body.trim()}
                          >
                            <PenLine className="h-4 w-4 mr-1" aria-hidden />
                            {myEntry ? "Update entry" : "Transmit entry"}
                          </NeonButton>
                          {myEntry && (
                            <NeonButton
                              type="button"
                              variant="danger"
                              disabled={busy}
                              onClick={handleDelete}
                            >
                              Withdraw
                            </NeonButton>
                          )}
                        </div>
                        <p className="text-uf-muted text-[11px]">
                          One entry per pilot — edit freely until the window closes.
                        </p>
                      </form>
                    ) : (
                      <p className="text-uf-muted text-sm mt-3">
                        {contest.status === "announced"
                          ? "The winners are in — read the entries above and join the next contest when it launches."
                          : "This contest's submission window has closed. Watch the Community hub for the next launch transmission."}
                      </p>
                    )}
                  </HoloCard>
                ) : (
                  <HoloCard>
                    <span className="uf-eyebrow">Entry station</span>
                    <h2 className="text-lg font-semibold mt-2">Join the fleet to enter</h2>
                    <p className="text-uf-muted text-sm mt-2">
                      Contests are open to every registered pilot — free membership included.
                      Sign in, then file your entry before the deadline.
                    </p>
                    <Link to="/auth" className="block mt-4">
                      <NeonButton variant="primary" className="w-full">Sign in / join the fleet</NeonButton>
                    </Link>
                  </HoloCard>
                )}
                <HoloCard className="!p-4">
                  <p className="text-uf-muted text-xs leading-5">
                    <Trophy className="h-3.5 w-3.5 inline text-uf-gold mr-1" aria-hidden />
                    Winners are picked by the lore jury and announced here and on
                    the activity feed. Prize XP and Star Credits pay out
                    automatically when judging closes.
                  </p>
                </HoloCard>
              </aside>
            </div>
          </section>
        </>
      )}
    </SiteShell>
  );
}

function RewardStat({
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
    <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] px-3 py-3 flex items-center gap-3">
      <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: "rgba(0,229,255,0.08)", color: tone }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-base font-semibold truncate" style={{ color: tone }}>
          {value}
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-uf-muted">{label}</p>
      </div>
    </div>
  );
}
