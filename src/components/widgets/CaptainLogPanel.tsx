import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, StatusPill } from "@/components/uf";
import { ShipWheel } from "lucide-react";

// Captain's Log (#10): the creator's latest behind-the-scenes updates,
// surfaced at the top of the Community page.
export function CaptainLogPanel({ limit = 3 }: { limit?: number }) {
  const logs = useQuery(api.captainLog.listCaptainLogs, { limit });

  return (
    <section aria-labelledby="uf-captains-log-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-4">
        <h3
          id="uf-captains-log-heading"
          className="uf-eyebrow flex items-center gap-2"
        >
          <ShipWheel className="h-4 w-4" style={{ color: "var(--uf-cyan)" }} aria-hidden />
          Captain's Log
        </h3>
        <StatusPill variant="cyan">Bridge updates</StatusPill>
      </header>
      {logs === undefined ? (
        <div className="uf-skeleton" style={{ height: 90 }} />
      ) : logs.length === 0 ? (
        <p className="text-uf-muted text-sm">
          The Captain hasn't logged in yet. The bridge is quiet — for now.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[color:var(--uf-border)] list-none p-0 m-0">
          {logs.map((l) => (
            <li key={l._id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-xs text-uf-muted tabular-nums">
                {new Date(l.publishedAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm font-semibold mt-0.5">{l.title}</p>
              <p className="text-uf-muted text-sm mt-1 whitespace-pre-wrap line-clamp-3">
                {l.body}
              </p>
              {l.author ? (
                <p className="text-xs text-uf-muted mt-1.5">
                  — {l.author.displayName}{" "}
                  <span className="text-[var(--uf-cyan)]">({l.author.rank})</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
