import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusPill } from "../uf/StatusPill";
import { Link } from "react-router";

export function RankProgress() {
  const data = useQuery(api.social.rankProgress, {});
  if (data === undefined) {
    return (
      <section aria-label="Rank progress" className="uf-panel p-5">
        <div className="uf-skeleton" style={{ height: 96 }} />
      </section>
    );
  }
  if (data === null) {
    return (
      <section aria-label="Rank progress" className="uf-panel p-5">
        <h3 className="uf-eyebrow mb-2">Rank progress</h3>
        <p className="text-uf-muted text-sm">
          Sign in to view your rank and XP. <Link to="/auth" className="text-uf-cyan">Open auth</Link>.
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="uf-rank-heading" className="uf-panel p-5">
      <header className="flex items-center justify-between mb-3">
        <h3 id="uf-rank-heading" className="uf-eyebrow">Rank progress</h3>
        <StatusPill variant="info">{data.rank}</StatusPill>
      </header>
      <div
        className="uf-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={data.percent}
        aria-label={`Progress to ${data.nextRank ?? "max"}`}
      >
        <div className="uf-progress__bar" style={{ width: `${data.percent}%` }} />
      </div>
      <p className="text-sm text-uf-muted mt-3">
        {data.xp.toLocaleString()} XP
        {data.nextRank && (
          <>
            {" "}— {data.percent}% to {data.nextRank} (
            {(data.nextThreshold ?? 0).toLocaleString()} XP)
          </>
        )}
      </p>
    </section>
  );
}
