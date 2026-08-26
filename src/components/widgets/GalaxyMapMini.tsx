import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { HoloCard } from "../uf/Panel";
import { StatusPill } from "../uf/StatusPill";

// Deterministic accent per index — small enough to be a tiny palette without theme coupling.
const HUES = [
  { line: "rgba(0,229,255,0.55)", glow: "var(--uf-cyan)", label: "Cyan" },
  { line: "rgba(139,92,246,0.55)", glow: "var(--uf-violet)", label: "Violet" },
  { line: "rgba(255,61,242,0.55)", glow: "var(--uf-magenta)", label: "Magenta" },
  { line: "rgba(230,168,23,0.55)", glow: "var(--uf-gold)", label: "Gold" },
  { line: "rgba(45,255,136,0.55)", glow: "var(--uf-green)", label: "Green" },
  { line: "rgba(255,77,109,0.55)", glow: "var(--uf-red)", label: "Red" },
];

export function GalaxyMapMini({
  height = 360,
}: {
  height?: number;
}) {
  const sectors = useQuery(api.content.sectors);

  if (sectors === undefined) {
    return (
      <section aria-label="Galaxy sector map" className="uf-panel p-5">
        <div className="uf-skeleton" style={{ height }} />
      </section>
    );
  }
  if (!sectors.length) {
    return (
      <section aria-label="Galaxy sector map" className="uf-panel p-5">
        <div className="uf-empty">Sector chart unavailable.</div>
      </section>
    );
  }

  const minX = Math.min(...sectors.map((s) => s.x));
  const maxX = Math.max(...sectors.map((s) => s.x));
  const minY = Math.min(...sectors.map((s) => s.y));
  const maxY = Math.max(...sectors.map((s) => s.y));
  const pad = 60;
  const vbX = minX - pad;
  const vbY = minY - pad;
  const vbW = Math.max(360, maxX - minX) + pad * 2;
  const vbH = Math.max(220, maxY - minY) + pad * 2;

  return (
    <section
      aria-labelledby="uf-galaxy-map-heading"
      className="uf-panel p-5"
      data-uf-widget="galaxy-map-mini"
    >
      <header className="flex items-center justify-between mb-3 gap-2">
        <h3 id="uf-galaxy-map-heading" className="uf-eyebrow">Galaxy map</h3>
        <div className="flex items-center gap-2">
          <StatusPill variant="info">{sectors.length} sectors</StatusPill>
          <Link to="/map" className="text-uf-cyan text-xs hover:underline">
            Open the full atlas
          </Link>
        </div>
      </header>
      <div
        className="relative overflow-hidden rounded-md"
        style={{
          background:
            "radial-gradient(closest-side at 50% 50%, rgba(0,229,255,0.08), transparent 70%), radial-gradient(closest-side at 20% 80%, rgba(139,92,246,0.06), transparent 70%), var(--uf-navy)",
          border: "1px solid var(--uf-border)",
          height,
        }}
      >
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          role="img"
          aria-label={`Galaxy map showing ${sectors.length} sectors`}
        >
          <title>Galaxy sector map</title>
          <desc>Interactive SVG of Star Force Base 1198 sectors. Each node links to that sector's lore filter.</desc>
          {/* Connecting lines between every pair of sectors. */}
          <g strokeLinecap="round">
            {sectors.map((a, i) =>
              sectors.slice(i + 1).map((b, j) => {
                const hue = HUES[(i + j) % HUES.length];
                return (
                  <line
                    key={`${a._id}-${b._id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={hue.line}
                    strokeWidth={0.8}
                  />
                );
              }),
            )}
          </g>
          {/* Sector nodes */}
          <g>
            {sectors.map((s, i) => {
              const hue = HUES[i % HUES.length];
              const r = Math.min(20, 6 + Math.sqrt((s.loreCount ?? 0)) * 2);
              // Lore entries key their `sector` field by display name (not
              // the kebab-case slug), so link by name to match the archive's
              // sector filter exactly.
              const link = `/lore?sector=${encodeURIComponent(s.name)}`;
              return (
                <a key={s._id} href={link} role="link" aria-label={`Open ${s.name} lore (${s.loreCount ?? 0} entries)`}>
                  <circle cx={s.x} cy={s.y} r={r + 4} fill={hue.glow} fillOpacity={0.10} />
                  <circle cx={s.x} cy={s.y} r={r} fill={hue.glow} fillOpacity={0.25} stroke={hue.glow} strokeWidth={1.2} />
                  <circle cx={s.x} cy={s.y} r={2.5} fill={hue.glow} />
                  <text
                    x={s.x}
                    y={s.y + r + 12}
                    fontSize={11}
                    fill="var(--uf-text)"
                    fontFamily='"Rajdhani", system-ui'
                    textAnchor="middle"
                  >
                    {s.name}
                  </text>
                  <text
                    x={s.x}
                    y={s.y + r + 24}
                    fontSize={9}
                    fill="var(--uf-muted)"
                    textAnchor="middle"
                  >
                    {(s.loreCount ?? 0)} lore
                  </text>
                </a>
              );
            })}
          </g>
        </svg>
      </div>
      <ul className="flex flex-wrap gap-2 mt-3 list-none p-0 m-0">
        {sectors.map((s, i) => (
          <li key={s._id}>
            <Link
              to={`/lore?sector=${encodeURIComponent(s.name)}`}
              className="uf-pill hover:shadow-[var(--uf-glow-cyan)]"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: HUES[i % HUES.length].glow }}
              />
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
