import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

// ---------------------------------------------------------------------------
// /honor — the Wall of Honor.
//
// Matches the approved design: a winged-emblem banner, a caps subtitle
// strip, and a dense grid of light metallic plaques with dark navy text.
// Each plaque, centered: rank-abbr + pilot name, full rank, the chosen
// StarCraft fighter, the custom ship name in quotes, and the auto-sequential
// hull number. Flat and text-only — the names are the decoration.
// ---------------------------------------------------------------------------

type Plaque = {
  _id: string;
  memberName: string;
  memberRank: string | null;
  memberId: string;
  designation: string;
  shipClass: string | null;
  callsign: string;
  hullNumber: string;
  awardedAt: number;
};

const RANK_ABBR: Record<string, string> = {
  Recruit: "RCT.",
  Aspirant: "ASP.",
  Pilot: "LT.",
  Ensign: "ENS.",
  "Lieutenant Junior Grade": "LT.J.G.",
  Lieutenant: "LT.",
  "Lieutenant Commander": "LT.CMDR.",
  Major: "MAJ.",
  Commander: "CDR.",
  Captain: "CPT.",
  Colonel: "COL.",
  Admiral: "ADM.",
};

/** Winged-star emblem, drawn inline — no image assets. */
function WingedEmblem() {
  return (
    <svg
      viewBox="0 0 120 48"
      className="h-10 w-auto mx-auto sm:h-12"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="hof-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2f6fb" />
          <stop offset="55%" stopColor="#c9d3e0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="hof-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="100%" stopColor="#caa02f" />
        </linearGradient>
      </defs>
      {/* wings */}
      <path
        d="M58 26 C44 8 22 6 4 14 C18 16 30 22 40 30 C46 34 52 35 58 32 Z"
        fill="url(#hof-steel)"
        stroke="#64748b"
        strokeWidth="0.8"
      />
      <path
        d="M62 26 C76 8 98 6 116 14 C102 16 90 22 80 30 C74 34 68 35 62 32 Z"
        fill="url(#hof-steel)"
        stroke="#64748b"
        strokeWidth="0.8"
      />
      {/* star */}
      <path
        d="M60 4 L64.7 15.8 L77.4 16.6 L67.6 24.7 L70.8 37 L60 30.2 L49.2 37 L52.4 24.7 L42.6 16.6 L55.3 15.8 Z"
        fill="url(#hof-gold)"
        stroke="#7c5e14"
        strokeWidth="0.9"
      />
      {/* ring */}
      <ellipse
        cx="60"
        cy="24"
        rx="14"
        ry="15.5"
        fill="none"
        stroke="url(#hof-steel)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export default function HonorWall() {
  usePageMeta({
    title: "Wall of Honor: Decorated Starfighter Commanders — Star Force Base 1198",
    description:
      "Decorated commanders of the Star Force: their rank, their StarCraft fighter, their custom ship name, and their hull number. Written once, forever.",
  });

  const rows = useQuery(api.starfighters.honorWall) as Plaque[] | undefined;

  return (
    <SiteShell>
      <div className="min-h-[70vh] bg-[#0a1120]">
        {/* ---- Banner header ---- */}
        <header className="border-b border-[rgba(148,163,184,0.18)] bg-gradient-to-b from-[#0e1729] to-[#0a1120] px-4 py-8 sm:py-10 text-center">
          <WingedEmblem />
          <h1 className="mt-3 text-xl sm:text-3xl lg:text-4xl font-bold tracking-[0.06em] text-white uppercase">
            Wall of Honor:{" "}
            <span className="text-[#dbe4f0]">Decorated Starfighter Commanders</span>
          </h1>
        </header>

        {/* ---- Subtitle strip ---- */}
        <div className="px-4 pt-5">
          <p className="mx-auto max-w-4xl rounded-sm border border-[rgba(148,163,184,0.25)] bg-[rgba(59,86,130,0.35)] px-4 py-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-[#c7d5e8]">
            Recognizing members who have earned their wings and selected their
            custom StarCraft fighters
          </p>
        </div>

        {/* ---- The wall ---- */}
        <section className="px-3 sm:px-5 py-6">
          {rows === undefined ? (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 list-none p-0 m-0">
              {Array.from({ length: 14 }).map((_, i) => (
                <li
                  key={i}
                  className="h-28 rounded-md bg-[rgba(148,163,184,0.12)] animate-pulse"
                />
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-md border border-[rgba(148,163,184,0.25)] bg-[rgba(17,26,44,0.7)] p-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe4f0]">
                The wall awaits its first plaque
              </p>
              <p className="mt-2 text-xs text-[#8fa3bf] leading-5">
                When the first wings are earned at the Wings ceremony, the
                pilot's fighter, ship name, and hull number are engraved here —
                permanently.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 list-none p-0 m-0">
              {rows.map((p) => (
                <HonorPlaque key={p._id} plaque={p} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// One plaque — light metallic steel with dark navy centered text.
// ---------------------------------------------------------------------------

function HonorPlaque({ plaque: p }: { plaque: Plaque }) {
  const abbr = p.memberRank ? RANK_ABBR[p.memberRank] ?? null : null;
  const name = p.memberName.toUpperCase();

  return (
    <li
      className="rounded-md border border-[#8b98ab] bg-gradient-to-b from-[#f0f4f9] via-[#d5dde8] to-[#b7c2d2] px-2 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_2px_6px_rgba(2,6,17,0.55)]"
    >
      {/* pilot line: rank abbr + name */}
      <p className="text-[11px] sm:text-xs font-bold leading-tight text-[#0b1220] break-words">
        {abbr ? `${abbr} ` : ""}
        {name}
      </p>
      {/* full rank */}
      {p.memberRank ? (
        <p className="mt-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3b4a63]">
          {p.memberRank}
        </p>
      ) : null}
      {/* the chosen StarCraft fighter */}
      <p className="mt-1.5 text-[10px] sm:text-[11px] font-bold uppercase leading-tight text-[#12203a] break-words">
        {p.designation}
      </p>
      {/* custom ship name */}
      <p className="mt-1 text-[10px] sm:text-[11px] font-bold text-[#0b1220] break-words">
        “{p.callsign}”
      </p>
      {/* hull number */}
      <p className="mt-1.5 font-mono text-[9px] sm:text-[10px] tracking-[0.08em] text-[#42536f]">
        {p.hullNumber}
      </p>
    </li>
  );
}
