import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard } from "../uf/Panel";
import { NeonButton } from "../uf/NeonButton";
import { StatusPill } from "../uf/StatusPill";

export function ActivityFeed({
  limit = 6,
  showPause = true,
}: {
  limit?: number;
  showPause?: boolean;
}) {
  const items = useQuery(api.social.activityFeed, { limit });
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const handler = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const pausedLabel = paused ? "Resume updates" : "Pause updates";

  return (
    <section aria-labelledby="uf-activity-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-4 gap-2">
        <h3 id="uf-activity-heading" className="uf-eyebrow">Fleet activity</h3>
        {showPause ? (
          <button
            type="button"
            className="uf-btn uf-btn--ghost"
            aria-pressed={paused}
            onClick={() => setPaused((v) => !v)}
          >
            {pausedLabel}
          </button>
        ) : null}
      </header>
      <div role="status" aria-live="polite" className="text-uf-muted text-xs mb-3">
        {!items
          ? "Syncing fleet activity…"
          : hidden || paused
            ? `Updates ${paused ? "paused" : "idle"} (${items.length} recent).`
            : `${items.length} recent transmissions.`}
      </div>
      <ul className="flex flex-col gap-3 list-none p-0 m-0">
        {items === undefined ? (
          [0, 1, 2].map((i) => (
            <li key={i}>
              <div className="uf-skeleton" style={{ height: 56 }} />
            </li>
          ))
        ) : items.length === 0 ? (
          <li className="uf-empty">The fleet is quiet right now. Be the first to transmit.</li>
        ) : (
          items.map((item) => (
            <li key={item._id}>
              <HoloCard className="!p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">
                      <strong>Operator</strong>{" "}
                      <span className="text-uf-muted">({item.verb})</span>{" "}
                      <span className="text-uf-muted">{item.targetType}:</span>{" "}
                      {item.url ? (
                        <a href={item.url} className="text-[color:var(--uf-cyan)]">
                          {item.summary ?? item.targetId}
                        </a>
                      ) : (
                        <span>{item.summary ?? item.targetId}</span>
                      )}
                    </p>
                    <time
                      dateTime={new Date(item.createdAt).toISOString()}
                      className="text-xs text-uf-muted"
                    >
                      {new Date(item.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <StatusPill variant="info">Live</StatusPill>
                </div>
              </HoloCard>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
