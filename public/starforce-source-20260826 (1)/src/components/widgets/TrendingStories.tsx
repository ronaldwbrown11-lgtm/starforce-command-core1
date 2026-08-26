import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";

export function TrendingStories({ limit = 6 }: { limit?: number }) {
  const items = useQuery(api.content.trendingStories, { limit });
  if (!items) {
    return (
      <section aria-label="Trending stories" className="uf-panel p-5">
        <div className="uf-skeleton" style={{ height: 160 }} />
      </section>
    );
  }
  if (!items.length) {
    return (
      <section aria-label="Trending stories" className="uf-panel p-5">
        <div className="uf-empty">No trending transmissions yet.</div>
      </section>
    );
  }
  return (
    <section aria-labelledby="uf-trending-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-3">
        <h3 id="uf-trending-heading" className="uf-eyebrow">Trending transmissions</h3>
        <StatusPill variant="info">Live</StatusPill>
      </header>
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {items.map((s) => (
          <li key={s._id}>
            <Link to={`/stories/${s.slug}`} className="block">
              <HoloCard className="!p-4 hover:!shadow-[var(--uf-glow-cyan)]">
                <div className="flex items-start gap-3 justify-between">
                  <div>
                    <h4 className="text-base font-semibold">{s.title}</h4>
                    <p className="text-sm text-uf-muted mt-1">{s.excerpt}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(s.factions ?? []).slice(0, 2).map((tag) => (
                        <StatusPill key={tag} variant="info">{tag}</StatusPill>
                      ))}
                      {s.classification && (
                        <StatusPill variant="warning">{s.classification}</StatusPill>
                      )}
                    </div>
                  </div>
                  {s.readMinutes && (
                    <StatusPill variant="default">~{s.readMinutes} min</StatusPill>
                  )}
                </div>
              </HoloCard>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
