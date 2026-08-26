import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";

export default function OperatorIdentity() {
  const items = useQuery(api.operator.listIdentityQueue, { limit: 50 });
  const act = useMutation(api.operator.identityAction);
  const [pending, setPending] = useState<string | null>(null);

  async function doAction(id: any, action: "approve" | "reject" | "request_info") {
    setPending(`${id}_${action}`);
    try {
      await act({ id, action });
      toast.success(`Recorded: ${action}`);
    } catch {
      toast.error("Forbidden or network.");
    } finally {
      setPending(null);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Identity Verification</h1>
        <p className="text-uf-muted text-sm mt-1">Manual review mode — no external KYC provider connected. Approve, request more info, or reject each applicant.</p>
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">Queue is clear.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {items.map((v) => (
            <li key={v._id}>
              <HoloCard>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="uf-eyebrow">Verification</span>
                    <h3 className="text-lg mt-1">{v.name ?? "Unknown user"}</h3>
                    {v.email ? (
                      <p className="text-uf-muted text-xs mt-0.5">{v.email}</p>
                    ) : null}
                    <p className="text-uf-muted text-xs mt-1">
                      Submitted {new Date(v.createdAt).toLocaleString()} • Updated {new Date(v.updatedAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-uf-muted mt-2">{v.notes ?? "—"}</p>
                  </div>
                  <StatusPill variant={v.status === "approved" ? "success" : v.status === "rejected" ? "danger" : "warning"}>{v.status}</StatusPill>
                </div>
                <div className="flex flex-wrap gap-2">
                  <NeonButton variant="primary" disabled={pending === `${v._id}_approve`} onClick={() => doAction(v._id, "approve")}>Approve</NeonButton>
                  <NeonButton variant="ghost" disabled={pending === `${v._id}_request_info`} onClick={() => doAction(v._id, "request_info")}>Request info</NeonButton>
                  <NeonButton variant="danger" disabled={pending === `${v._id}_reject`} onClick={async () => {
                    if (window.confirm("Reject this verification? Audit logged.")) await doAction(v._id, "reject");
                  }}>Reject</NeonButton>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
