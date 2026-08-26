import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";

export function RecentlyAddedLore({ limit = 6 }: { limit?: number }) {
  const items = useQuery(api.content.loreRecent, { limit });
  if (!items) {
    return (
      <section aria-label="Recently added lore" className="uf-panel p-5">
        <div className="uf-skeleton" style={{ height: 120 }} />
      </section>
    );
  }
  if (!items.length) {
    return (
      <section aria-label="Recently added lore" className="uf-panel p-5">
        <div className="uf-empty">No recent lore entries.</div>
      </section>
    );
  }
  return (
    <section aria-labelledby="uf-recent-lore-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-3">
        <h3 id="uf-recent-lore-heading" className="uf-eyebrow">Recently added lore</h3>
        <StatusPill variant="info">Live</StatusPill>
      </header>
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {items.map((entry) => (
          <li key={entry._id}>
            <Link to={`/lore/${entry.slug}`} className="block">
              <HoloCard className="!p-4">
                <h4 className="text-base font-semibold">{entry.title}</h4>
                <p className="text-sm text-uf-muted mt-1">{entry.excerpt}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {entry.faction && <StatusPill variant="info">{entry.faction}</StatusPill>}
                  {entry.classification && (
                    <StatusPill variant="warning">{entry.classification}</StatusPill>
                  )}
                  {entry.entryType && <StatusPill variant="default">{entry.entryType}</StatusPill>}
                </div>
              </HoloCard>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
