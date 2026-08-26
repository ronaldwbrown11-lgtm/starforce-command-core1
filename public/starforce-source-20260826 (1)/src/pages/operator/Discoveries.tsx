import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill, NeonButton } from "@/components/uf";
import { toast } from "sonner";
import { MapPin, Plus, Trash2 } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

type Row = {
  _id: Id<"discoveries">;
  title: string;
  description: string;
  x: number;
  y: number;
  sector: string | null;
  faction: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: number;
  author: { displayName: string; email: string | null } | null;
  mission: { title: string; slug: string } | null;
};

export default function OperatorDiscoveries() {
  const rows = useQuery(api.discoveries.listDiscoveriesForOperator);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [note, setNote] = useState<Record<string, string>>({});
  const decide = useMutation(api.discoveries.discoveryApprovalAction);
  const remove = useMutation(api.discoveries.deleteDiscovery);

  const filtered = useMemo(() => {
    const list = rows ?? [];
    if (filter === "all") return list;
    return list.filter((r) => r.status === filter);
  }, [rows, filter]);

  const pendingCount = useMemo(
    () => (rows ?? []).filter((r) => r.status === "pending").length,
    [rows],
  );

  const run = async (id: Id<"discoveries">, action: "approve" | "reject") => {
    try {
      await decide({ id, action, note: note[id]?.trim() || undefined });
      toast.success(action === "approve" ? "System charted — discoverer got +25 XP." : "Proposal rejected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    }
  };

  const del = async (id: Id<"discoveries">, title: string) => {
    if (!window.confirm(`Delete the proposal "${title}"? This removes it entirely.`)) return;
    try {
      await remove({ id });
      toast.success("Proposal deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <MapPin className="h-6 w-6 text-uf-cyan" aria-hidden />
          Discoveries
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Review member-proposed star systems for the galaxy chart. Approvals
          are canonized on the public Star Atlas map and award the discoverer
          +25 XP; rejections keep the proposal off the chart.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Discovery status">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                filter === f
                  ? "bg-[var(--uf-cyan)]/15 text-[var(--uf-cyan)] border border-[var(--uf-cyan)]/40"
                  : "text-uf-muted hover:text-uf-text border border-transparent"
              }`}
            >
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
        <StatusPill variant={pendingCount > 0 ? "warning" : "success"}>
          {pendingCount} awaiting review
        </StatusPill>
      </div>

      {rows === undefined ? (
        <div className="mt-4">
          <div className="uf-skeleton" style={{ height: 200 }} />
        </div>
      ) : filtered.length === 0 ? (
        <HoloCard className="mt-4">
          <div className="uf-empty">
            {filter === "pending"
              ? "No proposals waiting. Members chart systems by clicking the Star Atlas map."
              : "Nothing here yet."}
          </div>
        </HoloCard>
      ) : (
        <ul className="mt-4 flex flex-col gap-3 list-none p-0 m-0">
          {filtered.map((r) => (
            <li key={r._id}>
              <HoloCard>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg">{r.title}</h3>
                      <StatusPill variant={STATUS_VARIANT[r.status] ?? "default"}>
                        {r.status}
                      </StatusPill>
                      <StatusPill variant="info">
                        <MapPin className="h-3 w-3 mr-1" aria-hidden />
                        {r.x}, {r.y}
                      </StatusPill>
                    </div>
                    <p className="text-uf-muted text-xs mt-1">
                      Proposed {new Date(r.createdAt).toLocaleString()} by{" "}
                      <span className="text-uf-text">{r.author?.displayName ?? "unknown"}</span>
                      {r.author?.email ? ` · ${r.author.email}` : ""}
                    </p>
                    <p className="text-sm text-uf-text/85 mt-2 max-w-3xl">
                      {r.description || "No survey notes filed."}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-uf-muted">
                      {r.sector && <span>Sector: <span className="text-uf-text">{r.sector}</span></span>}
                      {r.faction && <span>Claim: <span className="text-uf-text">{r.faction}</span></span>}
                      {r.mission && (
                        <span>
                          Operation:{" "}
                          <a href={`/missions/${r.mission.slug}`} className="text-uf-cyan">
                            {r.mission.title}
                          </a>
                        </span>
                      )}
                    </div>
                    {r.reviewNote && (
                      <p className="text-xs text-uf-muted mt-2 border-l-2 border-[color:var(--uf-border)] pl-2">
                        Review note: {r.reviewNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end shrink-0">
                    {r.status === "pending" && (
                      <>
                        <div className="flex gap-2">
                          <NeonButton variant="primary" onClick={() => void run(r._id, "approve")}>
                            <Plus className="h-4 w-4 mr-1" aria-hidden /> Approve
                          </NeonButton>
                          <NeonButton variant="danger" onClick={() => void run(r._id, "reject")}>
                            Reject
                          </NeonButton>
                        </div>
                        <input
                          value={note[r._id] ?? ""}
                          onChange={(e) => setNote((n) => ({ ...n, [r._id]: e.target.value }))}
                          maxLength={400}
                          placeholder="Note to submitter (optional)"
                          className="w-56 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-2.5 py-1 text-xs text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                        />
                      </>
                    )}
                    <NeonButton variant="ghost" onClick={() => void del(r._id, r.title)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden /> Delete
                    </NeonButton>
                  </div>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
