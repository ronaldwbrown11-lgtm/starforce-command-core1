import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "danger"> = {
  ok: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
};

export function FleetStatus({ compact = false }: { compact?: boolean }) {
  const data = useQuery(api.social.fleetStatus);
  if (!data) {
    return (
      <section aria-label="Fleet status" className="uf-panel p-5">
        <div className="uf-skeleton" style={{ height: 96 }} />
      </section>
    );
  }
  const overall =
    data.overall === "operational" ? "success" : data.overall === "degraded" ? "warning" : "danger";
  return (
    <section aria-labelledby="uf-fleet-status-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-4">
        <h3 id="uf-fleet-status-heading" className="uf-eyebrow">Fleet status</h3>
        <StatusPill variant={overall}>Fleet: {data.overall}</StatusPill>
      </header>
      {!compact && (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {data.subsystems.map((s) => (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <StatusPill variant={STATUS_VARIANT[s.status] ?? "info"}>{s.status}</StatusPill>
              <span className="font-medium">{s.label}</span>
              <span className="text-uf-muted text-xs">{s.note}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
