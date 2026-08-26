import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Link } from "react-router";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Flag, ShieldAlert, CheckCircle2, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type Filter = "pending" | "approved" | "rejected" | "flagged" | "";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "flagged", label: "Flagged" },
  { id: "", label: "All" },
];

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "default"
> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  flagged: "default",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function OperatorReports() {
  const [filter, setFilter] = useState<Filter>("pending");
  const items = useQuery(api.operator.reportReviewQueue, {
    status: filter,
    limit: 60,
  });
  const act = useMutation(api.operator.reportReviewAction);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const counts = useQuery(api.operator.reportReviewQueue, {
    status: "",
    limit: 500,
  });
  const pendingCount =
    counts?.filter((r) => r.reviewStatus === "pending").length ?? 0;
  const approvedCount =
    counts?.filter((r) => r.reviewStatus === "approved").length ?? 0;
  const flaggedCount =
    counts?.filter((r) => r.reviewStatus === "flagged").length ?? 0;

  async function doAction(
    id: any,
    action: "approve" | "reject" | "flag",
    note: string,
  ) {
    setBusy(`${id}_${action}`);
    try {
      const res = await act({ id, action, note: note || undefined });
      toast.success(
        res.revoked > 0
          ? `Recorded: ${action} (−${res.revoked} XP clawed back)`
          : `Recorded: ${action}`,
      );
      setNotes((n) => ({ ...n, [id]: "" }));
    } catch {
      toast.error("Action failed. Forbidden or network.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <ClipboardCheck className="h-6 w-6 text-uf-cyan" aria-hidden />
          Field Reports
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Review report-ins filed against missions. XP is awarded on filing and
          clawed back when a report is rejected or flagged. Every action is
          audit-logged.
        </p>
      </header>

      {/* Queue stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6" aria-label="Report queue summary">
        <HoloCard className="!p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-uf-muted">
            <ShieldAlert className="h-4 w-4" aria-hidden /> Pending
          </div>
          <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-amber)" }}>
            {counts === undefined ? "—" : pendingCount}
          </p>
        </HoloCard>
        <HoloCard className="!p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-uf-muted">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Approved
          </div>
          <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-green)" }}>
            {counts === undefined ? "—" : approvedCount}
          </p>
        </HoloCard>
        <HoloCard className="!p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-uf-muted">
            <Flag className="h-4 w-4" aria-hidden /> Flagged
          </div>
          <p className="text-3xl font-semibold mt-2" style={{ color: "var(--uf-gold)" }}>
            {counts === undefined ? "—" : flaggedCount}
          </p>
        </HoloCard>
      </div>

      {/* Status filter tabs */}
      <div
        role="tablist"
        aria-label="Filter reports by review status"
        className="flex flex-wrap gap-2 mb-6"
      >
        {FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn("uf-btn", filter === f.id ? "uf-btn--primary" : "")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="uf-skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">
            {filter === "pending"
              ? "No reports awaiting review. The queue is clear."
              : `No ${filter} reports.`}
          </div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {items.map((r) => (
            <li key={r._id}>
              <HoloCard>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <span className="uf-eyebrow">Field report</span>
                    <h3 className="text-lg mt-1">
                      {r.mission ? (
                        <Link
                          to={`/missions/${r.mission.slug}`}
                          className="hover:underline"
                          style={{ textDecorationColor: "var(--uf-cyan)" }}
                        >
                          {r.mission.title}
                        </Link>
                      ) : (
                        r.title
                      )}
                    </h3>
                    <p className="text-uf-muted text-xs mt-0.5">
                      {r.author?.displayName ?? "Unknown recruit"}
                      {r.author?.rank ? ` · ${r.author.rank}` : ""} ·{" "}
                      {relativeTime(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <StatusPill variant={STATUS_VARIANT[r.reviewStatus] ?? "default"}>
                      {r.reviewStatus}
                    </StatusPill>
                    {r.xpAwarded ? (
                      <StatusPill variant="gold">
                        +{r.xpAwarded.toLocaleString()} XP
                      </StatusPill>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--uf-text-muted)" }}>
                  {r.content}
                </p>
                {r.reviewNote ? (
                  <p className="text-xs mt-2 border-l-2 pl-2" style={{ borderColor: "var(--uf-cyan)", color: "var(--uf-amber)" }}>
                    Operator note: {r.reviewNote}
                  </p>
                ) : null}
                {r.reviewStatus === "pending" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <input
                      value={notes[r._id] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [r._id]: e.target.value }))
                      }
                      placeholder="Review note (optional)"
                      aria-label="Review note"
                      className="w-full sm:w-64 border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    />
                    <NeonButton
                      variant="primary"
                      disabled={busy === `${r._id}_approve`}
                      onClick={() => doAction(r._id, "approve", notes[r._id] ?? "")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden />
                      Certify
                    </NeonButton>
                    <NeonButton
                      variant="danger"
                      disabled={busy === `${r._id}_reject`}
                      onClick={async () => {
                        if (
                          window.confirm(
                            `Reject this report${r.xpAwarded ? ` and claw back ${r.xpAwarded} XP` : ""}?`,
                          )
                        )
                          await doAction(r._id, "reject", notes[r._id] ?? "");
                      }}
                    >
                      Reject
                    </NeonButton>
                    <NeonButton
                      variant="violet"
                      disabled={busy === `${r._id}_flag`}
                      onClick={async () => {
                        if (
                          window.confirm(
                            `Flag this report for senior review${r.xpAwarded ? ` and claw back ${r.xpAwarded} XP` : ""}?`,
                          )
                        )
                          await doAction(r._id, "flag", notes[r._id] ?? "");
                      }}
                    >
                      <Flag className="h-4 w-4 mr-1" aria-hidden />
                      Flag
                    </NeonButton>
                  </div>
                ) : null}
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
