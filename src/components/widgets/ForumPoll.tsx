import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "react-router";
import { Check, Vote } from "lucide-react";
import { HoloCard, StatusPill } from "../uf";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Quick-reaction poll (#39): attached to a forum thread at creation. One vote
// per pilot; every vote pays the thread author +2 XP so polls feed the
// leaderboard. Results render reactively from api.groups.pollByThread.
// ---------------------------------------------------------------------------

export function ForumPoll({ threadId }: { threadId: Id<"forumThreads"> }) {
  const poll = useQuery(api.groups.pollByThread, { threadId });
  const castVote = useMutation(api.groups.voteOnPoll);
  const { isAuthenticated } = useAuth();
  const [voting, setVoting] = useState<number | null>(null);

  if (poll === undefined || poll === null) return null;

  const total = poll.total;
  const hasVoted = poll.myVoteIndex !== null;

  const handleVote = async (optionIndex: number) => {
    if (hasVoted) return;
    setVoting(optionIndex);
    try {
      await castVote({ pollId: poll._id, optionIndex });
      toast.success("Vote locked in — the tally updates fleet-wide.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cast your vote.");
    } finally {
      setVoting(null);
    }
  };

  const bestCount = Math.max(0, ...poll.counts);
  const winnerIndexes = total > 0
    ? poll.counts.map((c, i) => (c === bestCount && bestCount > 0 ? i : -1)).filter((i) => i !== -1)
    : [];

  return (
    <HoloCard accent="cyan" className="!border-[rgba(0,229,255,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="uf-eyebrow flex items-center gap-1.5">
          <Vote className="h-3.5 w-3.5" aria-hidden />
          Quick-reaction poll
        </span>
        <span className="text-uf-muted text-xs">
          Poll by {poll.authorName} · {total} vote{total === 1 ? "" : "s"}
        </span>
      </div>
      <h3 className="text-lg font-semibold mt-2">{poll.question}</h3>

      {!isAuthenticated && !hasVoted ? (
        <p className="text-uf-muted text-sm mt-3">
          Sign in to cast your vote — votes pay the thread author +2 XP each.{" "}
          <Link to="/auth" className="text-uf-cyan underline underline-offset-2">
            Open auth
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-2 list-none p-0 m-0" role="list">
          {poll.options.map((option, idx) => {
            const count = poll.counts[idx] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const mine = poll.myVoteIndex === idx;
            const isWinner = winnerIndexes.includes(idx);
            const interactive = !hasVoted && isAuthenticated;
            return (
              <li key={idx}>
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => void handleVote(idx)}
                    disabled={voting !== null}
                    className="w-full text-left rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-3 py-2.5 text-sm text-uf-text transition-colors hover:border-[rgba(0,229,255,0.5)] hover:bg-[rgba(0,229,255,0.06)] disabled:opacity-60 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-uf-cyan text-xs">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      {option}
                    </span>
                  </button>
                ) : (
                  <div
                    className={
                      "relative overflow-hidden rounded-md border px-3 py-2.5 " +
                      (mine
                        ? "border-[rgba(0,229,255,0.55)] bg-[rgba(0,229,255,0.08)]"
                        : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)]")
                    }
                  >
                    <div
                      aria-hidden
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `${pct}%`,
                        background:
                          "linear-gradient(90deg, rgba(0,229,255,0.16), rgba(0,229,255,0.03))",
                      }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        {mine && (
                          <Check className="h-4 w-4 shrink-0 text-uf-cyan" aria-hidden />
                        )}
                        <span className="sr-only">{mine ? "Your vote: " : ""}</span>
                        <span className="truncate">{option}</span>
                        {isWinner && (
                          <StatusPill variant="gold" className="hidden sm:inline-flex">
                            Leading
                          </StatusPill>
                        )}
                      </span>
                      <span className="shrink-0 text-xs font-mono tabular-nums text-uf-muted">
                        {count} · {pct}%
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-uf-muted text-[11px] mt-3 flex items-center gap-1.5">
        {poll.isAuthor
          ? "Your poll — every vote banks you +2 XP on the leaderboard."
          : hasVoted
            ? "Vote locked. The tally updates live as pilots weigh in."
            : "One vote per pilot · feeds the forum leaderboard (+2 XP to the author per vote)."}
      </p>
    </HoloCard>
  );
}
