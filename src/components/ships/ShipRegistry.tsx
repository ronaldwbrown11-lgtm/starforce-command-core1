import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { ShipSilhouette } from "./ShipSilhouette";
import { HoloCard, StatusPill } from "@/components/uf";

// ---------------------------------------------------------------------------
// Ship registry — every pilot who has assigned a hull, grouped under their
// ship class. Public read; drives the "Fleet Registry under your ship class"
// requirement.
// ---------------------------------------------------------------------------

export function ShipRegistry({ className }: { className?: string }) {
  const registry = useQuery(api.ships.listShipRegistry, { limit: 120 });

  if (registry === undefined) {
    return (
      <HoloCard className={className}>
        <div className="uf-skeleton" style={{ height: 96 }} />
      </HoloCard>
    );
  }

  if (registry.count === 0) {
    return (
      <HoloCard className={className}>
        <span className="uf-eyebrow">Fleet registry · pilots</span>
        <p className="text-uf-muted text-sm mt-2">
          No pilots have filed a ship assignment yet. The first hull to post
          makes history.
        </p>
      </HoloCard>
    );
  }

  // Group by hull class, preserving alphabetical class order.
  const byClass = new Map<string, typeof registry.rows>();
  for (const row of registry.rows) {
    const list = byClass.get(row.shipClass) ?? [];
    list.push(row);
    byClass.set(row.shipClass, list);
  }

  return (
    <HoloCard className={className}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Fleet registry · pilots by hull</span>
          <h2 className="text-xl font-semibold mt-1.5">Ships of the fleet</h2>
          <p className="text-uf-muted text-sm mt-1">
            Every pilot with a ship on record, grouped under their assigned
            class.
          </p>
        </div>
        <StatusPill variant="info">{registry.count} assigned</StatusPill>
      </header>

      <div className="mt-4 space-y-5">
        {[...byClass.entries()].map(([className, rows]) => (
          <section key={className} aria-label={`${className} pilots`}>
            <div className="flex items-center gap-3">
              <ShipSilhouette shipClass={className} className="h-6 w-24 shrink-0" />
              <h3 className="text-sm font-semibold text-uf-text">{className}</h3>
              <span className="text-[11px] text-uf-muted">{rows.length}</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2 list-none p-0 m-0">
              {rows.map((row) => (
                <li key={row.userId}>
                  <Link
                    to={`/profile/${row.userId}`}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-3 py-1 text-xs text-uf-text transition-colors hover:border-[rgba(0,229,255,0.4)]"
                  >
                    {row.displayName}
                    {row.shipName ? (
                      <span className="text-uf-muted">“{row.shipName}”</span>
                    ) : null}
                    {row.shipRole ? (
                      <span className="text-uf-cyan/80">{row.shipRole}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </HoloCard>
  );
}