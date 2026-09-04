import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import {
  ChevronDown,
  Crown,
  Plus,
  Rocket,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ContestRow = {
  _id: Id<"contests">;
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

const STATUS_PILL_VARIANT: Record<string, "warning" | "success" | "gold" | "info" | "default"> = {
  upcoming: "warning",
  open: "success",
  voting: "gold",
  closed: "default",
  announced: "info",
};

export default function ContestsManage() {
  const contests = useQuery(api.contests.listContests, {});

  // ---- create form state ----
  const create = useMutation(api.contests.createContest);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [rules, setRules] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(Date.now()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(Date.now() + 7 * 86_400_000));
  const [rewardXp, setRewardXp] = useState("250");
  const [rewardCredits, setRewardCredits] = useState("50");
  const [winnerCount, setWinnerCount] = useState("1");
  const [creating, setCreating] = useState(false);

  const [expanded, setExpanded] = useState<Id<"contests"> | null>(null);
  const entries = useQuery(
    api.contests.listContestEntries,
    expanded ? { contestId: expanded } : "skip",
  );
  const setStatus = useMutation(api.contests.setContestStatus);
  const judge = useMutation(api.contests.judgeEntry);
  const remove = useMutation(api.contests.removeContest);
  const [busy, setBusy] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const startTs = new Date(startsAt).getTime();
      const endTs = new Date(endsAt).getTime();
      if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
        throw new Error("Pick valid launch and deadline times.");
      }
      const res = await create({
        title,
        description,
        prompt: prompt || undefined,
        rules: rules || undefined,
        startsAt: startTs,
        endsAt: endTs,
        rewardXp: Number(rewardXp) || undefined,
        rewardCredits: Number(rewardCredits) || undefined,
        winnerCount: Number(winnerCount) || undefined,
      });
      toast.success(`Contest launched — /contests/${res.slug}`);
      setTitle("");
      setDescription("");
      setPrompt("");
      setRules("");
      setStartsAt(toLocalInput(Date.now()));
      setEndsAt(toLocalInput(Date.now() + 7 * 86_400_000));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the contest.");
    } finally {
      setCreating(false);
    }
  };

  const handleSetStatus = async (id: Id<"contests">, status: string, label: string) => {
    setBusy(`status-${id}`);
    try {
      await setStatus({ id, status: status as never });
      toast.success(`Contest moved to “${label}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status change failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleJudge = async (entryId: Id<"contestSubmissions">, outcome: "winner" | "finalist" | "none") => {
    if (outcome === "winner") {
      const ok = window.confirm(
        "Marking this entry a winner pays out the prize (XP + Star Credits) once. Continue?",
      );
      if (!ok) return;
    }
    setBusy(`judge-${entryId}`);
    try {
      await judge({ id: entryId, outcome });
      toast.success(outcome === "none" ? "Entry returned to the queue." : `Entry marked ${outcome}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Judging action failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (id: Id<"contests">, slug: string) => {
    if (!window.confirm(`Delete contest “${slug}” and all of its entries? This cannot be undone.`)) return;
    setBusy(`remove-${id}`);
    try {
      await remove({ id });
      toast.success("Contest and entries removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the contest.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <OperatorShell>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Lore Contests</h1>
        <p className="text-uf-muted text-sm mb-6">
          Launch themed member-created lore contests, watch entries roll in, and
          judge winners — prizes pay out automatically. Public board: /contests.
        </p>

        {/* ---- Create form ---- */}
        <HoloCard accent="cyan" className="mb-8">
          <h2 className="uf-eyebrow mb-1 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Launch a contest
          </h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5 md:col-span-2">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. First Contact: The Frontier Survey"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5 md:col-span-2">
              Description (shown on the board card)
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={2}
                placeholder="One or two lines pitching the theme to pilots."
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text resize-y"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5 md:col-span-2">
              The brief / prompt (full mission directive on the detail page)
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Give pilots the world to write in: setting, conflict, constraints, voice."
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text resize-y"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5 md:col-span-2">
              Rules of engagement
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={2}
                placeholder="Entry limits, canon constraints, judging criteria."
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text resize-y"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Submissions open
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Submission deadline
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Reward XP per winner
              <input
                type="number"
                min={0}
                value={rewardXp}
                onChange={(e) => setRewardXp(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Star Credits per winner
              <input
                type="number"
                min={0}
                value={rewardCredits}
                onChange={(e) => setRewardCredits(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Winner count
              <input
                type="number"
                min={1}
                max={10}
                value={winnerCount}
                onChange={(e) => setWinnerCount(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <div className="md:col-span-2 flex items-center justify-end">
              <NeonButton type="submit" variant="primary" loading={creating} disabled={!title.trim() || !description.trim()}>
                <Rocket className="h-4 w-4 mr-1" aria-hidden /> Launch contest
              </NeonButton>
            </div>
          </form>
        </HoloCard>

        {/* ---- Contest list ---- */}
        <h2 className="uf-eyebrow mb-3">
          Contest board ({contests === undefined ? "…" : contests.length})
        </h2>
        {contests === undefined ? (
          <div className="uf-skeleton" style={{ height: 160 }} />
        ) : contests.length === 0 ? (
          <div className="uf-empty">
            No contests yet. Launch the first one above — members are waiting
            for a brief.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {contests.map((c: ContestRow) => {
              const open = expanded === c._id;
              const now = Date.now();
              return (
                <HoloCard key={c._id} className="!p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill variant={STATUS_PILL_VARIANT[c.status] ?? "default"}>
                          {c.status}
                        </StatusPill>
                        <StatusPill variant="cyan">{c.entryCount} entries</StatusPill>
                        <span className="text-uf-muted text-xs font-mono">/{c.slug}</span>
                      </div>
                      <h3 className="text-lg font-semibold mt-2">{c.title}</h3>
                      <p className="text-uf-muted text-sm mt-1 line-clamp-2">{c.description}</p>
                      <p className="text-uf-muted text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Timer className="h-3 w-3 text-uf-cyan" aria-hidden />
                          {new Date(c.startsAt).toLocaleString()} → {new Date(c.endsAt).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Crown className="h-3 w-3 text-uf-gold" aria-hidden />
                          {c.winnerCount} winner{c.winnerCount === 1 ? "" : "s"} · {c.rewardXp ?? 0} XP
                          {c.rewardCredits ? ` + ${c.rewardCredits} ¤` : ""}
                        </span>
                        {c.status === "open" && c.endsAt < now && (
                          <span className="text-uf-gold">Deadline passed — clock still gates entry</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="uf-btn uf-btn--ghost"
                        onClick={() => setExpanded(open ? null : c._id)}
                        aria-expanded={open}
                      >
                        {open ? "Hide entries" : "Judge entries"}
                        <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="uf-btn uf-btn--danger"
                        disabled={busy === `remove-${c._id}`}
                        onClick={() => void handleRemove(c._id, c.slug)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" aria-hidden />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--uf-border)] pt-3">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-uf-muted self-center">
                      Set status:
                    </span>
                    {(
                      [
                        ["upcoming", "Upcoming"],
                        ["open", "Open"],
                        ["voting", "Voting"],
                        ["closed", "Closed"],
                        ["announced", "Announced"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className="uf-btn uf-btn--ghost text-xs"
                        disabled={busy === `status-${c._id}` || c.status === value}
                        onClick={() => void handleSetStatus(c._id, value, label)}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="ml-auto text-uf-muted text-[11px] self-center">
                      {c.canEnter ? "Members can enter right now" : "Entry window shut by the clock"}
                    </span>
                  </div>

                  {open && (
                    <div className="mt-4 border-t border-[color:var(--uf-border)] pt-4">
                      {entries === undefined ? (
                        <div className="uf-skeleton" style={{ height: 90 }} />
                      ) : entries.length === 0 ? (
                        <div className="uf-empty">No submissions yet for this contest.</div>
                      ) : (
                        <ul className="flex flex-col gap-3 list-none p-0 m-0">
                          {entries.map((entry) => (
                            <li key={entry._id}>
                              <div className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-uf-text">{entry.title}</p>
                                    <p className="text-xs text-uf-muted">
                                      {entry.authorName} · {new Date(entry.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <StatusPill variant={entry.status === "winner" ? "gold" : entry.status === "finalist" ? "violet" : "default"}>
                                    {entry.status}
                                  </StatusPill>
                                </div>
                                <p className="text-sm text-uf-muted mt-2 whitespace-pre-wrap line-clamp-4">{entry.body}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="uf-btn uf-btn--gold text-xs"
                                    disabled={busy === `judge-${entry._id}` || entry.status === "winner"}
                                    onClick={() => void handleJudge(entry._id, "winner")}
                                  >
                                    <Trophy className="h-3.5 w-3.5 mr-1" aria-hidden /> Winner
                                  </button>
                                  <button
                                    type="button"
                                    className="uf-btn uf-btn--violet text-xs"
                                    disabled={busy === `judge-${entry._id}` || entry.status === "finalist"}
                                    onClick={() => void handleJudge(entry._id, "finalist")}
                                  >
                                    Finalist
                                  </button>
                                  {entry.status !== "submitted" && (
                                    <button
                                      type="button"
                                      className="uf-btn uf-btn--ghost text-xs"
                                      disabled={busy === `judge-${entry._id}`}
                                      onClick={() => void handleJudge(entry._id, "none")}
                                    >
                                      Clear status
                                    </button>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </HoloCard>
              );
            })}
          </div>
        )}
      </div>
    </OperatorShell>
  );
}
