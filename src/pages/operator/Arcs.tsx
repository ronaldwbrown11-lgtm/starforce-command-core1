import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, PenTool, Trash2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Operator → Lore Arcs. Create/rename/open/close arcs, and review member
// chapter contributions. Approvals pay the author 100 XP + 50★ and publish
// the chapter to the public /arcs page. Every action is audit-logged.
// ---------------------------------------------------------------------------

export default function OperatorArcs() {
  const arcs = useQuery(api.engagement.listAllArcsAdmin, {}) ?? [];
  const pending = useQuery(api.engagement.listPendingContributions, {}) ?? [];

  const createArc = useMutation(api.engagement.createArc);
  const updateArc = useMutation(api.engagement.updateArc);
  const deleteArc = useMutation(api.engagement.deleteArc);
  const review = useMutation(api.engagement.reviewArcContribution);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await createArc({ title, summary });
      toast.success("Arc created — it's now open for contributions.");
      setTitle("");
      setSummary("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  }

  async function handleReview(id: string, action: "approve" | "reject") {
    setBusy(`${id}:${action}`);
    try {
      await review({ id: id as any, action });
      toast.success(action === "approve" ? "Chapter approved — author paid." : "Chapter returned.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string, arcTitle: string) {
    if (!window.confirm(`Delete "${arcTitle}" and every contribution in it? This cannot be undone.`)) return;
    setBusy(`${id}:del`);
    try {
      await deleteArc({ id: id as any });
      toast.success("Arc deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleStatus(id: string, status: "open" | "active" | "closed") {
    setBusy(`${id}:st`);
    try {
      await updateArc({ id: id as any, status });
      toast.success(`Arc marked ${status}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Lore Arcs</h1>
        <p className="text-uf-muted text-sm mt-1">
          Curate collaborative storylines. Approve chapters to publish them on the public{" "}
          <a href="/arcs" className="text-uf-cyan underline">
            /arcs
          </a>{" "}
          page — approvals pay the author 100 XP + 50★ and are audit-logged.
        </p>
      </header>

      {/* ---- Pending review queue ---- */}
      <section aria-labelledby="op-arcs-queue" className="mb-10">
        <h2 id="op-arcs-queue" className="uf-eyebrow mb-3">
          Contribution review queue {pending?.length ? `(${pending.length})` : ""}
        </h2>
        {pending === undefined ? (
          <div className="uf-skeleton" style={{ height: 160 }} />
        ) : pending.length === 0 ? (
          <HoloCard>
            <div className="uf-empty">No chapters waiting. The queue is clear.</div>
          </HoloCard>
        ) : (
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {pending.map((c) => (
              <li key={c._id}>
                <HoloCard>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="uf-eyebrow">{c.arcTitle} · by {c.author}</span>
                      <h3 className="text-lg font-semibold mt-1">{c.title}</h3>
                      <p className="text-sm text-uf-muted mt-2 whitespace-pre-wrap line-clamp-4">
                        {c.body}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <NeonButton
                        variant="primary"
                        onClick={() => handleReview(c._id, "approve")}
                        disabled={busy === `${c._id}:approve`}
                      >
                        <Check className="h-4 w-4" aria-hidden /> Approve
                      </NeonButton>
                      <NeonButton
                        variant="ghost"
                        onClick={() => handleReview(c._id, "reject")}
                        disabled={busy === `${c._id}:reject`}
                      >
                        <X className="h-4 w-4" aria-hidden /> Return
                      </NeonButton>
                    </div>
                  </div>
                </HoloCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Create new arc ---- */}
      <section aria-labelledby="op-arcs-create" className="mb-10">
        <h2 id="op-arcs-create" className="uf-eyebrow mb-3">
          Open a new arc
        </h2>
        <HoloCard>
          <form onSubmit={handleCreate} className="grid gap-3">
            <label className="text-xs text-uf-muted flex flex-col gap-1">
              Arc title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
                placeholder="e.g., The Vedae Blockade"
                className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs text-uf-muted flex flex-col gap-1">
              Premise / summary members will see
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                rows={3}
                maxLength={2000}
                placeholder="Set the scene: the conflict, the stakes, what canon the chapters must respect."
                className="bg-transparent border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <div>
              <NeonButton variant="primary" type="submit" disabled={creating}>
                <PenTool className="h-4 w-4" aria-hidden /> Create arc
              </NeonButton>
            </div>
          </form>
        </HoloCard>
      </section>

      {/* ---- All arcs ---- */}
      <section aria-labelledby="op-arcs-all">
        <h2 id="op-arcs-all" className="uf-eyebrow mb-3">
          All arcs
        </h2>
        {arcs === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : arcs.length === 0 ? (
          <HoloCard>
            <div className="uf-empty">No arcs yet — create the first one above.</div>
          </HoloCard>
        ) : (
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {arcs.map((arc) => (
              <li key={arc._id}>
                <HoloCard>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{arc.title}</h3>
                        <StatusPill
                          variant={
                            arc.status === "active" ? "cyan" : arc.status === "closed" ? "danger" : "violet"
                          }
                        >
                          {arc.status}
                        </StatusPill>
                      </div>
                      <p className="text-sm text-uf-muted mt-1 line-clamp-2">{arc.summary}</p>
                      <p className="text-xs text-uf-muted mt-2 uppercase tracking-[0.16em]">
                        {arc.approvedCount} approved · {arc.pendingCount} pending
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <a href={`/arcs/${arc.slug}`} target="_blank" rel="noopener noreferrer" className="uf-btn uf-btn--ghost">
                        <ExternalLink className="h-4 w-4" aria-hidden /> View
                      </a>
                      {arc.status !== "active" && (
                        <NeonButton
                          variant="ghost"
                          onClick={() => handleStatus(arc._id, "active")}
                          disabled={busy === `${arc._id}:st`}
                        >
                          Activate
                        </NeonButton>
                      )}
                      {arc.status !== "closed" && (
                        <NeonButton
                          variant="ghost"
                          onClick={() => handleStatus(arc._id, "closed")}
                          disabled={busy === `${arc._id}:st`}
                        >
                          Close
                        </NeonButton>
                      )}
                      <NeonButton
                        variant="ghost"
                        onClick={() => handleDelete(arc._id, arc.title)}
                        disabled={busy === `${arc._id}:del`}
                        aria-label={`Delete arc ${arc.title}`}
                      >
                        {busy === `${arc._id}:del` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </NeonButton>
                    </div>
                  </div>
                </HoloCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </OperatorShell>
  );
}
