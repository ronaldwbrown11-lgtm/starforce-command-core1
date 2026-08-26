import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton } from "@/components/uf";
import { toast } from "sonner";

export default function OperatorSessions() {
  const items = useQuery(api.operator.listActiveSessions, { limit: 50 });
  const revoke = useMutation(api.operator.revokeActiveSession);
  const [pending, setPending] = useState<string | null>(null);
  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Sessions</h1>
        <p className="text-uf-muted text-sm mt-1">
          Active sign-in sessions. Revoking one logs the member out immediately. Audit logged.
        </p>
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No active sessions.</div>
        </HoloCard>
      ) : (
        <HoloCard>
          <table className="uf-data-grid">
            <caption className="uf-sr-only">Active sessions</caption>
            <thead>
              <tr>
                <th>Member</th>
                <th>Session</th>
                <th>Signed in</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s._id}>
                  <td>
                    <div>{s.name}</div>
                    {s.email ? (
                      <div className="text-xs text-uf-muted">{s.email}</div>
                    ) : null}
                  </td>
                  <td className="font-mono text-xs">{(s._id as string).slice(0, 10)}…</td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>{new Date(s.expirationTime).toLocaleString()}</td>
                  <td>
                    <NeonButton
                      variant="danger"
                      disabled={pending === s._id}
                      onClick={async () => {
                        if (!window.confirm("Revoke this session? Audit-logged.")) return;
                        setPending(s._id);
                        try {
                          await revoke({ id: s._id });
                          toast.success("Session revoked.");
                        } catch {
                          toast.error("Forbidden.");
                        } finally {
                          setPending(null);
                        }
                      }}
                    >
                      Revoke
                    </NeonButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HoloCard>
      )}
    </OperatorShell>
  );
}
