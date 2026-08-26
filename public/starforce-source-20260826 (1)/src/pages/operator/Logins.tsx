import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill } from "@/components/uf";

export default function OperatorLogins() {
  const items = useQuery(api.operator.listLoginAttempts, { limit: 50 });
  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Login Logs</h1>
        <p className="text-uf-muted text-sm mt-1">
          Threshold-bucketed logs. Rate-limited to 5 attempts per 15 min on /login.
        </p>
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No login attempts recorded.</div>
        </HoloCard>
      ) : (
        <HoloCard>
          <table className="uf-data-grid">
            <caption className="uf-sr-only">Recent login attempts</caption>
            <thead>
              <tr>
                <th>Time</th>
                <th>IP</th>
                <th>UA</th>
                <th>Result</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.time).toLocaleString()}</td>
                  <td>{l.ip || "—"}</td>
                  <td className="max-w-32 truncate">{l.ua || "—"}</td>
                  <td>
                    <StatusPill variant={l.result === "success" ? "success" : "danger"}>
                      {l.result}
                    </StatusPill>
                  </td>
                  <td>{l.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </HoloCard>
      )}
    </OperatorShell>
  );
}
