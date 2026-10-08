import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";

export default function OperatorModeration() {
  const items = useQuery(api.operator.moderationQueue, { limit: 50 });
  const act = useMutation(api.operator.moderationAction);
  const pendingReviews = useQuery(api.siteReviews.listPending);
  const decideReview = useMutation(api.siteReviews.setDecision);
  const [pending, setPending] = useState<string | null>(null);

  async function doAction(id: Id<"moderationItems">, action: "approve" | "reject" | "escalate") {
    setPending(`${id}_${action}`);
    try {
      await act({ id, action });
      toast.success(`Recorded: ${action}`);
    } catch {
      toast.error("Action failed. Forbidden or network.");
    } finally {
      setPending(null);
    }
  }

  async function decide(id: string, action: "approve" | "reject") {
    setPending(`${id}_${action}`);
    try {
      await decideReview({ id: id as Id<"siteReviews">, action });
      toast.success(action === "approve" ? "Review is now public." : "Review rejected.");
    } catch {
      toast.error("Decision failed. Forbidden or network.");
    } finally {
      setPending(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Moderation Queue</h1>
        <p className="text-uf-muted text-sm mt-1">
          Reviewed items are audit-logged. Destructive actions require confirm.
        </p>
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 220 }} />
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">Queue is clear. No items pending review.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {items.map((m) => (
            <li key={m._id}>
              <HoloCard>
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div>
                    <span className="uf-eyebrow">Item</span>
                    <h3 className="text-lg mt-1">
                      {m.targetType} — {m.targetId}
                    </h3>
                  </div>
                  <StatusPill variant="warning">{m.status}</StatusPill>
                </div>
                <p className="text-uf-muted text-sm">
                  Reason: {m.reason ?? "no reason stated"}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <NeonButton
                    variant="primary"
                    disabled={pending === `${m._id}_approve`}
                    onClick={() => doAction(m._id, "approve")}
                  >
                    Approve
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    disabled={pending === `${m._id}_reject`}
                    onClick={async () => {
                      if (window.confirm("Reject this item? This will be audit-logged."))
                        await doAction(m._id, "reject");
                    }}
                  >
                    Reject
                  </NeonButton>
                  <NeonButton
                    variant="violet"
                    disabled={pending === `${m._id}_escalate`}
                    onClick={async () => {
                      if (window.confirm("Escalate to senior operator?"))
                        await doAction(m._id, "escalate");
                    }}
                  >
                    Escalate
                  </NeonButton>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}

      <header className="mt-10 mb-4">
        <span className="uf-eyebrow">Site reviews</span>
        <h2 className="text-2xl font-semibold mt-2">Awaiting approval</h2>
        <p className="text-uf-muted text-sm mt-1">
          Submitted on /reviews. Nothing here is public until you approve it.
        </p>
      </header>
      {pendingReviews === undefined ? (
        <div className="uf-skeleton" style={{ height: 160 }} />
      ) : pendingReviews.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No reviews waiting for review.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {pendingReviews.map((r) => (
            <li key={r._id}>
              <HoloCard>
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div className="min-w-0">
                    <span className="uf-eyebrow">{"★".repeat(r.rating)}</span>
                    <h3 className="text-lg mt-1">{r.headline}</h3>
                  </div>
                  <StatusPill variant="warning">pending</StatusPill>
                </div>
                <p className="text-uf-muted text-sm whitespace-pre-wrap">{r.body}</p>
                <p className="text-uf-muted text-xs mt-2">
                  {r.authorName}
                  {r.callSign ? ` — “${r.callSign}”` : ""}
                  {r.role ? ` · ${r.role}` : ""} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <NeonButton
                    variant="primary"
                    disabled={pending === `${r._id}_approve`}
                    onClick={() => decide(r._id, "approve")}
                  >
                    Approve
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    disabled={pending === `${r._id}_reject`}
                    onClick={async () => {
                      if (window.confirm("Reject this review? This will be audit-logged."))
                        await decide(r._id, "reject");
                    }}
                  >
                    Reject
                  </NeonButton>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
