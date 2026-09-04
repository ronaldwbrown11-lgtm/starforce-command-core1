import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import {
  Activity,
  ChevronRight,
  FileText,
  Globe2,
  Radio,
  ScrollText,
  Users,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Live-proof band for the landing page: real fleet telemetry (online count,
// members, 7-day signal volume, archive sizes) plus a "sector chatter"
// ticker fed by the activity feed. All numbers are live Convex reads —
// nothing is faked. The ticker is a CSS marquee that pauses on hover/focus
// and degrades to a static list under prefers-reduced-motion.
// ---------------------------------------------------------------------------

export function LiveCommandStrip() {
  // Inject the scoped ticker styles once (id-guarded so multiple mounts on
  // one page don't duplicate them).
  useEffect(() => {
    if (document.getElementById("uf-chatter-styles")) return;
    const style = document.createElement("style");
    style.id = "uf-chatter-styles";
    style.textContent = CHATTER_CSS;
    document.head.appendChild(style);
  }, []);

  const counters = useQuery(api.social.homeLiveCounters, {});
  const chatter = useQuery(api.social.sectorChatter, { limit: 14 });

  const tiles: Array<{
    label: string;
    value: number | null;
    tone: string;
    icon: ReactNode;
    note: string;
  }> = [
    {
      label: "Online now",
      value: counters?.online ?? null,
      tone: "var(--uf-green)",
      icon: <Activity className="h-3.5 w-3.5" />,
      note: "Pilots on the bridge",
    },
    {
      label: "Fleet members",
      value: counters?.members ?? null,
      tone: "var(--uf-cyan)",
      icon: <Users className="h-3.5 w-3.5" />,
      note: "Registered crew",
    },
    {
      label: "Signals · 7 days",
      value: counters?.weekActivity ?? null,
      tone: "var(--uf-violet)",
      icon: <Zap className="h-3.5 w-3.5" />,
      note: "Feed transmissions",
    },
    {
      label: "Stories on file",
      value: counters?.storiesPublished ?? null,
      tone: "var(--uf-magenta)",
      icon: <FileText className="h-3.5 w-3.5" />,
      note: "Canon archive",
    },
    {
      label: "Lore entries",
      value: counters?.loreCount ?? null,
      tone: "var(--uf-amber)",
      icon: <ScrollText className="h-3.5 w-3.5" />,
      note: "Encyclopedia feeds",
    },
  ];

  return (
    <section
      aria-label="Live fleet telemetry and sector chatter"
      className="relative z-10 mx-auto mt-2 max-w-[1440px] px-4 sm:px-6 lg:px-12"
    >
      {/* ---- Telemetry tiles ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.55)] p-3 backdrop-blur-sm"
          >
            <span
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]"
              style={{ color: tile.tone }}
            >
              {tile.icon}
              {tile.label}
            </span>
            {tile.value === null ? (
              <div className="uf-skeleton mt-2 h-7 w-16" />
            ) : (
              <p
                className="font-mono text-2xl font-semibold mt-1 tabular-nums leading-tight"
                style={{ color: tile.tone }}
              >
                {tile.value.toLocaleString()}
              </p>
            )}
            <p className="text-uf-muted text-[10px] mt-0.5">{tile.note}</p>
          </div>
        ))}
      </div>

      {/* ---- Sector chatter ticker ---- */}
      {chatter !== undefined && chatter.length > 0 && (
        <div
          className="mt-3 overflow-hidden rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] backdrop-blur-sm"
          role="region"
          aria-label="Sector chatter — recent fleet activity"
        >
          <div className="flex items-stretch">
            <div className="flex shrink-0 items-center gap-2 border-r border-[color:var(--uf-border)] bg-[rgba(0,229,255,0.07)] px-3 sm:px-4 py-3">
              <span
                aria-hidden
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: "var(--uf-green)", boxShadow: "0 0 8px var(--uf-green)" }}
              >
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full animate-ping opacity-60"
                  style={{ background: "var(--uf-green)" }}
                />
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-uf-cyan font-semibold whitespace-nowrap">
                Sector chatter
              </span>
              <Radio className="h-3.5 w-3.5 text-uf-cyan" aria-hidden />
            </div>
            <div className="uf-chatter-viewport flex-1 min-w-0 overflow-hidden">
              <div className="uf-chatter-track">
                {[0, 1].map((copy) => (
                  <div
                    key={copy}
                    className="uf-chatter-copy flex shrink-0 items-center"
                    aria-hidden={copy === 1}
                  >
                    {chatter.map((item) => (
                      <ChatterItem key={`${copy}-${item.id}`} item={item} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ChatterItem({
  item,
}: {
  item: { id: string; name: string; text: string; url: string | null; ts: number };
}) {
  const inner = (
    <>
      <span className="font-semibold text-uf-text whitespace-nowrap">{item.name}</span>
      <span className="text-uf-muted whitespace-nowrap">— {item.text}</span>
      {item.url ? (
        <ChevronRight className="h-3.5 w-3.5 text-uf-cyan shrink-0" aria-hidden />
      ) : (
        <Globe2 className="h-3 w-3 text-uf-muted shrink-0" aria-hidden />
      )}
      <span
        aria-hidden
        className="mx-3 h-1 w-1 rounded-full shrink-0"
        style={{ background: "rgba(0,229,255,0.35)" }}
      />
    </>
  );
  const cls =
    "uf-chatter-item inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-[rgba(0,229,255,0.08)]";
  return item.url ? (
    <Link to={item.url} className={cls}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

// Scoped ticker styles: linear marquee that pauses on hover/focus, and
// degrades to a wrapped static list under prefers-reduced-motion. The second
// copy (for the seamless loop) is hidden in the static case.
export const CHATTER_CSS = `
.uf-chatter-viewport { mask-image: linear-gradient(90deg, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%); }
.uf-chatter-track { display: flex; width: max-content; animation: uf-chatter-scroll 48s linear infinite; }
.uf-chatter-copy { display: flex; }
.uf-chatter-track:hover, .uf-chatter-track:focus-within { animation-play-state: paused; }
@keyframes uf-chatter-scroll { to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .uf-chatter-track { width: auto; animation: none; flex-wrap: wrap; }
  .uf-chatter-copy { flex-wrap: wrap; }
  .uf-chatter-track .uf-chatter-copy:nth-child(2) { display: none; }
  .uf-chatter-item { white-space: normal; }
  .uf-chatter-viewport { mask-image: none; overflow: visible; }
}
`;
