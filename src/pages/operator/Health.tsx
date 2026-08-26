import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill, NeonButton } from "@/components/uf";

export default function OperatorHealth() {
  const h = useQuery(api.operator.systemHealth);
  const overall =
    h?.overall === "operational"
      ? "success"
      : h?.overall === "degraded"
        ? "warning"
        : "danger";
  return (
    <OperatorShell>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <span className="uf-eyebrow">Operator Console</span>
          <h1 className="text-3xl font-semibold mt-2">System Health</h1>
        </div>
        <StatusPill variant={overall}>Fleet: {h?.overall ?? "syncing"}</StatusPill>
      </header>
      {h === undefined ? (
        <div className="uf-skeleton" style={{ height: 240 }} />
      ) : (
        <div className="uf-grid uf-grid--2">
          {h.subsystems.map((s) => (
            <HoloCard key={s.key}>
              <header className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{s.label}</h3>
                <StatusPill
                  variant={
                    s.status === "ok"
                      ? "success"
                      : s.status === "warning"
                        ? "warning"
                        : "danger"
                  }
                >
                  {s.status}
                </StatusPill>
              </header>
              <p className="text-uf-muted text-sm">{s.note ?? "—"}</p>
              <NeonButton
                variant="ghost"
                className="mt-3"
                onClick={() => location.reload()}
              >
                Refresh
              </NeonButton>
            </HoloCard>
          ))}
        </div>
      )}
    </OperatorShell>
  );
}
